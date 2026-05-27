import crypto from "node:crypto";
import type { Skill } from "./skill-schema";
import type { SkillEdit } from "./skill-edit";
import { getEnv } from "./env";

export type EntryStatus = "pending" | "approved" | "rejected";

/**
 * VersionStatus is parallel to EntryStatus and tracks where a row sits in the
 * SkillOpt lifecycle:
 *   - current   → served to all (or majority of) /i/<name> hits
 *   - candidate → behind the A/B share for /i/<name>; not yet promoted
 *   - retired   → previous version, kept queryable for rollback + audit
 *
 * Existing entries written before versioning have `versionStatus: undefined`,
 * which `normalize()` treats as "current".
 */
export type VersionStatus = "current" | "candidate" | "retired";

export interface MarketplaceEntry {
  id: string;
  skill: Skill;
  sourceUrl: string;
  markdown: string;
  contentHash: string;
  createdAt: string;
  model: string;
  status: EntryStatus;
  // Cached star count for skill.repoUrl. Refreshed on approval; null/undefined
  // when there is no repo or the GitHub fetch failed.
  stars?: number;
  starsUpdatedAt?: string;
  // SkillOpt versioning (all optional — old entries default to versionId=1,
  // versionStatus="current" through normalize()).
  versionId?: number;
  versionStatus?: VersionStatus;
  parentContentHash?: string | null;
  edits?: SkillEdit[];
  /** Fraction of /i/<name> traffic routed to this version (0..1). Only
   *  meaningful when versionStatus === "candidate". */
  abTrafficShare?: number;
}

interface IndexShape {
  ids: string[];
}

// Single-key snapshot of the entire approved+pending+rejected catalog.
// Reading the snapshot costs 1 KV get instead of 1+N (one per entry), and
// CF caches it at the edge for SNAPSHOT_CACHE_TTL seconds, so a hot region
// usually serves list() with zero KV operations. Writes invalidate by
// deleting the key; the next list() lazily rebuilds it.
const SNAPSHOT_KEY = "index:snapshot:v1";
const SNAPSHOT_CACHE_TTL = 3600; // edge-cache for 1h

interface SnapshotShape {
  v: 1;
  entries: MarketplaceEntry[];
  builtAt: string;
}

function normalize(entry: MarketplaceEntry): MarketplaceEntry {
  // Read-time defaults for entries written before these fields existed.
  // Treat pre-schema entries as already-approved so they don't disappear from
  // the public marketplace just because the shape grew.
  const status: EntryStatus = entry.status ?? "approved";
  const skill = entry.skill;
  const normalizedSkill = {
    ...skill,
    videoUrls: skill.videoUrls ?? [],
    audience: skill.audience ?? "creators",
  };
  // SkillOpt: any entry without an explicit versionStatus is the only version
  // of its family and behaves as the current.
  const versionId = entry.versionId ?? 1;
  const versionStatus: VersionStatus = entry.versionStatus ?? "current";
  return { ...entry, status, skill: normalizedSkill, versionId, versionStatus };
}

/**
 * Storage abstraction: KV when MARKETPLACE_KV binding exists (Cloudflare Pages
 * runtime or `wrangler dev`), file-backed JSON otherwise (`npm run dev`).
 *
 * KV layout:
 *   skill:<id>                  → MarketplaceEntry (JSON)
 *   index:all                   → { ids: string[] }
 *   index:snapshot:v1           → snapshot of all entries, edge-cached
 *
 * SkillOpt versioning (Phase 1a):
 *   family:<name>:current       → { id: string }   pointer to live version
 *   family:<name>:candidate     → { id: string }   present iff A/B in flight
 *   family:<name>:history       → { ids: string[] } ordered, oldest first
 *
 * The family namespace keys off `skill.name` (the kebab-case slug), which is
 * already unique across approved entries. Each version still lives in
 * `skill:<id>` so existing callers (getSkill, findApprovedByName fallback,
 * the snapshot list) keep working without migration.
 */

interface FamilyPointer {
  id: string;
}

interface FamilyHistory {
  ids: string[]; // ordered oldest → newest; includes retired entries
}

function familyKey(name: string): string {
  return `family:${name}`;
}

class KvStore {
  constructor(private kv: KVNamespace) {}

  async list(): Promise<MarketplaceEntry[]> {
    // Fast path: single edge-cached KV get for the snapshot.
    try {
      const snap = await this.kv.get<SnapshotShape>(SNAPSHOT_KEY, {
        type: "json",
        cacheTtl: SNAPSHOT_CACHE_TTL,
      });
      if (snap && snap.v === 1 && Array.isArray(snap.entries)) {
        return snap.entries
          .map(normalize)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      }
    } catch {
      // KV read failed (rate limit, transient error). Fall through to rebuild,
      // which will likely also fail — caller gets an empty list rather than a 500.
    }
    return this.rebuildSnapshot();
  }

  // Rebuilds the snapshot from per-id keys. Costs 1+N KV gets — rare path,
  // hit only on first read after a write or after edge-cache expiry.
  private async rebuildSnapshot(): Promise<MarketplaceEntry[]> {
    let idx: IndexShape;
    try {
      idx = (await this.kv.get<IndexShape>("index:all", "json")) ?? { ids: [] };
    } catch {
      return [];
    }
    let entries: (MarketplaceEntry | null)[];
    try {
      entries = await Promise.all(
        idx.ids.map((id) => this.kv.get<MarketplaceEntry>(`skill:${id}`, "json"))
      );
    } catch {
      return [];
    }
    const valid = entries.filter((e): e is MarketplaceEntry => Boolean(e));
    try {
      await this.kv.put(
        SNAPSHOT_KEY,
        JSON.stringify({ v: 1, entries: valid, builtAt: new Date().toISOString() } satisfies SnapshotShape)
      );
    } catch {
      // Best-effort cache write; serving the response matters more.
    }
    return valid
      .map(normalize)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async get(id: string): Promise<MarketplaceEntry | null> {
    try {
      const raw = await this.kv.get<MarketplaceEntry>(`skill:${id}`, {
        type: "json",
        cacheTtl: SNAPSHOT_CACHE_TTL,
      });
      return raw ? normalize(raw) : null;
    } catch {
      return null;
    }
  }

  async put(entry: MarketplaceEntry): Promise<void> {
    await this.kv.put(`skill:${entry.id}`, JSON.stringify(entry));
    const idx = (await this.kv.get<IndexShape>("index:all", "json")) ?? { ids: [] };
    if (!idx.ids.includes(entry.id)) idx.ids.push(entry.id);
    await this.kv.put("index:all", JSON.stringify(idx));
    // Invalidate the snapshot so the next list() picks up the change.
    try {
      await this.kv.delete(SNAPSHOT_KEY);
    } catch {
      // If invalidation fails, the edge cache TTL will eventually rebuild.
    }
  }

  async getFamilyPointer(name: string, kind: "current" | "candidate"): Promise<string | null> {
    const ptr = await this.kv.get<FamilyPointer>(`${familyKey(name)}:${kind}`, "json");
    return ptr?.id ?? null;
  }

  async putFamilyPointer(name: string, kind: "current" | "candidate", id: string): Promise<void> {
    await this.kv.put(`${familyKey(name)}:${kind}`, JSON.stringify({ id } satisfies FamilyPointer));
  }

  async deleteFamilyPointer(name: string, kind: "current" | "candidate"): Promise<void> {
    try {
      await this.kv.delete(`${familyKey(name)}:${kind}`);
    } catch {
      // best-effort
    }
  }

  async getFamilyHistory(name: string): Promise<string[]> {
    const hist = await this.kv.get<FamilyHistory>(`${familyKey(name)}:history`, "json");
    return hist?.ids ?? [];
  }

  async appendFamilyHistory(name: string, id: string): Promise<void> {
    const hist = (await this.kv.get<FamilyHistory>(`${familyKey(name)}:history`, "json")) ?? { ids: [] };
    if (!hist.ids.includes(id)) hist.ids.push(id);
    await this.kv.put(`${familyKey(name)}:history`, JSON.stringify(hist));
  }
}

class FileStore {
  private file: string;
  constructor() {
    this.file = "";
  }
  private async paths() {
    const path = await import("node:path");
    if (!this.file) {
      const dir = path.join(process.cwd(), "data");
      this.file = path.join(dir, "skills.json");
    }
    return { file: this.file };
  }
  private async ensure() {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const { file } = await this.paths();
    await fs.mkdir(path.dirname(file), { recursive: true });
    try {
      await fs.access(file);
    } catch {
      await fs.writeFile(
        file,
        JSON.stringify({ entries: [], families: {} }, null, 2),
        "utf-8"
      );
    }
  }
  private async readAll(): Promise<{
    entries: MarketplaceEntry[];
    families: Record<string, { current?: string; candidate?: string; history?: string[] }>;
  }> {
    const fs = await import("node:fs/promises");
    await this.ensure();
    const { file } = await this.paths();
    const raw = await fs.readFile(file, "utf-8");
    const parsed = JSON.parse(raw) as {
      entries?: MarketplaceEntry[];
      families?: Record<string, { current?: string; candidate?: string; history?: string[] }>;
    };
    return { entries: parsed.entries ?? [], families: parsed.families ?? {} };
  }
  private async writeAll(state: {
    entries: MarketplaceEntry[];
    families: Record<string, { current?: string; candidate?: string; history?: string[] }>;
  }): Promise<void> {
    const fs = await import("node:fs/promises");
    const { file } = await this.paths();
    await fs.writeFile(file, JSON.stringify(state, null, 2), "utf-8");
  }
  async list(): Promise<MarketplaceEntry[]> {
    const { entries } = await this.readAll();
    return entries.map(normalize).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  async get(id: string): Promise<MarketplaceEntry | null> {
    const { entries } = await this.readAll();
    const found = entries.find((e) => e.id === id);
    return found ? normalize(found) : null;
  }
  async put(entry: MarketplaceEntry): Promise<void> {
    const state = await this.readAll();
    const i = state.entries.findIndex((e) => e.id === entry.id);
    if (i >= 0) state.entries[i] = entry;
    else state.entries.push(entry);
    await this.writeAll(state);
  }
  async getFamilyPointer(name: string, kind: "current" | "candidate"): Promise<string | null> {
    const { families } = await this.readAll();
    return families[name]?.[kind] ?? null;
  }
  async putFamilyPointer(name: string, kind: "current" | "candidate", id: string): Promise<void> {
    const state = await this.readAll();
    state.families[name] = { ...(state.families[name] ?? {}), [kind]: id };
    await this.writeAll(state);
  }
  async deleteFamilyPointer(name: string, kind: "current" | "candidate"): Promise<void> {
    const state = await this.readAll();
    if (!state.families[name]) return;
    delete state.families[name][kind];
    await this.writeAll(state);
  }
  async getFamilyHistory(name: string): Promise<string[]> {
    const { families } = await this.readAll();
    return families[name]?.history ?? [];
  }
  async appendFamilyHistory(name: string, id: string): Promise<void> {
    const state = await this.readAll();
    const fam = state.families[name] ?? {};
    const history = fam.history ?? [];
    if (!history.includes(id)) history.push(id);
    state.families[name] = { ...fam, history };
    await this.writeAll(state);
  }
}

async function store(): Promise<KvStore | FileStore> {
  const env = await getEnv();
  if (env.MARKETPLACE_KV) return new KvStore(env.MARKETPLACE_KV);
  return new FileStore();
}

export async function listSkills(): Promise<MarketplaceEntry[]> {
  const all = await (await store()).list();
  return all.filter((e) => e.status === "approved");
}

export async function listAllSkills(): Promise<MarketplaceEntry[]> {
  return (await store()).list();
}

export async function listSkillsByStatus(status: EntryStatus): Promise<MarketplaceEntry[]> {
  const all = await (await store()).list();
  return all.filter((e) => e.status === status);
}

export async function getSkill(id: string): Promise<MarketplaceEntry | null> {
  return (await store()).get(id);
}

export async function getApprovedSkill(id: string): Promise<MarketplaceEntry | null> {
  const e = await (await store()).get(id);
  return e && e.status === "approved" ? e : null;
}

/** Resolve a skill by its `name` slug. If multiple approved entries share the
 *  name (e.g. an old version still around), return the most recently created.
 *  Used by the agent-friendly /i/<name> install shortcut. */
export async function findApprovedByName(name: string): Promise<MarketplaceEntry | null> {
  const all = await (await store()).list();
  const matches = all.filter((e) => e.status === "approved" && e.skill.name === name);
  if (matches.length === 0) return null;
  matches.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return matches[0];
}

export async function saveSkill(
  input: Omit<MarketplaceEntry, "id" | "contentHash" | "createdAt" | "status"> & {
    status?: EntryStatus;
  }
): Promise<MarketplaceEntry> {
  const contentHash = sha256Hex(input.markdown).slice(0, 16);
  const id = `${input.skill.name}-${contentHash.slice(0, 8)}`;
  const entry: MarketplaceEntry = {
    id,
    contentHash,
    createdAt: new Date().toISOString(),
    status: input.status ?? "pending",
    skill: input.skill,
    sourceUrl: input.sourceUrl,
    markdown: input.markdown,
    model: input.model,
  };
  await (await store()).put(entry);
  return entry;
}

/** Put a fully-formed entry directly. Use when you've mutated multiple fields
 *  at once (e.g. repoUrl + markdown re-render) and don't want to chain
 *  setX helpers. Caller is responsible for keeping the entry's contentHash
 *  consistent with its markdown. */
export async function updateEntry(entry: MarketplaceEntry): Promise<MarketplaceEntry> {
  const s = await store();
  const normalized = normalize(entry);
  await s.put(normalized);
  return normalized;
}

export async function setSkillStatus(id: string, status: EntryStatus): Promise<MarketplaceEntry | null> {
  const s = await store();
  const entry = await s.get(id);
  if (!entry) return null;
  const updated: MarketplaceEntry = { ...entry, status };
  await s.put(updated);
  return updated;
}

export async function setSkillStars(
  id: string,
  stars: number | null
): Promise<MarketplaceEntry | null> {
  const s = await store();
  const entry = await s.get(id);
  if (!entry) return null;
  const updated: MarketplaceEntry = {
    ...entry,
    stars: stars ?? undefined,
    starsUpdatedAt: stars != null ? new Date().toISOString() : entry.starsUpdatedAt,
  };
  await s.put(updated);
  return updated;
}

// ─────────────────────────────────────────────────────────────────────────
// SkillOpt: family-level versioning
// ─────────────────────────────────────────────────────────────────────────

/**
 * Read the live version of a skill by name. Tries the family:<name>:current
 * pointer first (set by promoteCandidate). Falls back to the old name-scan
 * behavior for entries written before versioning landed.
 */
export async function getCurrentSkillByName(name: string): Promise<MarketplaceEntry | null> {
  const s = await store();
  const ptrId = await s.getFamilyPointer(name, "current");
  if (ptrId) {
    const entry = await s.get(ptrId);
    if (entry && entry.status === "approved") return entry;
  }
  // Fallback: legacy unversioned entries — scan by name.
  return findApprovedByName(name);
}

/** Read the candidate version of a skill, if any. */
export async function getCandidateSkillByName(name: string): Promise<MarketplaceEntry | null> {
  const s = await store();
  const ptrId = await s.getFamilyPointer(name, "candidate");
  if (!ptrId) return null;
  return s.get(ptrId);
}

/** Read every recorded version of a skill, oldest first. */
export async function listVersionsByName(name: string): Promise<MarketplaceEntry[]> {
  const s = await store();
  const ids = await s.getFamilyHistory(name);
  if (ids.length === 0) {
    // Legacy fallback: synthesize a single-version history from name scan.
    const sole = await findApprovedByName(name);
    return sole ? [sole] : [];
  }
  const entries = await Promise.all(ids.map((id) => s.get(id)));
  return entries.filter((e): e is MarketplaceEntry => Boolean(e));
}

/**
 * Save a new version of an existing skill as a candidate. The new entry gets
 * its own contentHash-derived id; the parent stays the current. Promotion
 * happens via promoteCandidate() once the A/B gate accepts.
 */
export async function saveSkillVersion(
  parent: MarketplaceEntry,
  edits: SkillEdit[],
  input: {
    markdown: string;
    skill: Skill;
    model: string;
    sourceUrl?: string;
    abTrafficShare?: number;
  }
): Promise<MarketplaceEntry> {
  const s = await store();
  const contentHash = sha256Hex(input.markdown).slice(0, 16);
  const id = `${input.skill.name}-${contentHash.slice(0, 8)}`;
  const versions = await s.getFamilyHistory(input.skill.name);
  const entry: MarketplaceEntry = {
    id,
    contentHash,
    createdAt: new Date().toISOString(),
    status: "approved", // candidates are gated by versionStatus, not EntryStatus
    skill: input.skill,
    sourceUrl: input.sourceUrl ?? parent.sourceUrl,
    markdown: input.markdown,
    model: input.model,
    versionId: versions.length + 1,
    versionStatus: "candidate",
    parentContentHash: parent.contentHash,
    edits,
    abTrafficShare: input.abTrafficShare ?? 0.2,
    stars: parent.stars,
    starsUpdatedAt: parent.starsUpdatedAt,
  };
  await s.put(entry);
  await s.appendFamilyHistory(input.skill.name, id);
  await s.putFamilyPointer(input.skill.name, "candidate", id);
  return entry;
}

/**
 * Atomic flip: candidate becomes current, previous current becomes retired.
 * Returns the new current entry and the now-retired one, or null if no
 * candidate exists.
 */
export async function promoteCandidate(
  name: string
): Promise<{ promoted: MarketplaceEntry; retired: MarketplaceEntry | null } | null> {
  const s = await store();
  const candidateId = await s.getFamilyPointer(name, "candidate");
  if (!candidateId) return null;
  const candidate = await s.get(candidateId);
  if (!candidate) {
    await s.deleteFamilyPointer(name, "candidate");
    return null;
  }
  const currentId = await s.getFamilyPointer(name, "current");
  const current = currentId ? await s.get(currentId) : null;

  // Flip statuses.
  const newCurrent: MarketplaceEntry = {
    ...candidate,
    versionStatus: "current",
    abTrafficShare: undefined,
  };
  await s.put(newCurrent);
  if (current) {
    const newRetired: MarketplaceEntry = { ...current, versionStatus: "retired" };
    await s.put(newRetired);
  }
  await s.putFamilyPointer(name, "current", candidate.id);
  await s.deleteFamilyPointer(name, "candidate");
  return { promoted: newCurrent, retired: current ?? null };
}

/**
 * Reject the active candidate. Marks it retired (kept queryable for audit /
 * negative-feedback reuse) and clears the candidate pointer.
 */
export async function retireCandidate(name: string): Promise<MarketplaceEntry | null> {
  const s = await store();
  const candidateId = await s.getFamilyPointer(name, "candidate");
  if (!candidateId) return null;
  const candidate = await s.get(candidateId);
  if (!candidate) {
    await s.deleteFamilyPointer(name, "candidate");
    return null;
  }
  const retired: MarketplaceEntry = {
    ...candidate,
    versionStatus: "retired",
    abTrafficShare: undefined,
  };
  await s.put(retired);
  await s.deleteFamilyPointer(name, "candidate");
  return retired;
}

/**
 * Ensure a family:<name>:current pointer exists for a legacy entry. Called
 * lazily so we don't need a separate migration job — first read repairs the
 * index in place.
 */
export async function ensureFamilyIndexed(entry: MarketplaceEntry): Promise<void> {
  const s = await store();
  const existing = await s.getFamilyPointer(entry.skill.name, "current");
  if (existing) return;
  await s.putFamilyPointer(entry.skill.name, "current", entry.id);
  await s.appendFamilyHistory(entry.skill.name, entry.id);
}

function sha256Hex(input: string): string {
  if (typeof crypto.createHash === "function") {
    return crypto.createHash("sha256").update(input).digest("hex");
  }
  // Workers fallback: use SubtleCrypto sync? No — fall back to a fast non-crypto hash for dev only.
  // In practice node:crypto is polyfilled by nodejs_compat on Workers.
  let h = 0n;
  for (const ch of input) h = (h * 1099511628211n + BigInt(ch.charCodeAt(0))) & 0xffffffffffffffffn;
  return h.toString(16).padStart(16, "0").repeat(4);
}
