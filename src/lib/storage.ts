import crypto from "node:crypto";
import type { Skill } from "./skill-schema";
import { getEnv } from "./env";

export type EntryStatus = "pending" | "approved" | "rejected";

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
  return { ...entry, status, skill: normalizedSkill };
}

/**
 * Storage abstraction: KV when MARKETPLACE_KV binding exists (Cloudflare Pages
 * runtime or `wrangler dev`), file-backed JSON otherwise (`npm run dev`).
 *
 * KV layout:
 *   skill:<id>      → MarketplaceEntry (JSON)
 *   index:all       → { ids: string[] }
 */

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
      await fs.writeFile(file, JSON.stringify({ entries: [] }, null, 2), "utf-8");
    }
  }
  private async readAll(): Promise<MarketplaceEntry[]> {
    const fs = await import("node:fs/promises");
    await this.ensure();
    const { file } = await this.paths();
    const raw = await fs.readFile(file, "utf-8");
    return (JSON.parse(raw) as { entries: MarketplaceEntry[] }).entries;
  }
  private async writeAll(entries: MarketplaceEntry[]): Promise<void> {
    const fs = await import("node:fs/promises");
    const { file } = await this.paths();
    await fs.writeFile(file, JSON.stringify({ entries }, null, 2), "utf-8");
  }
  async list(): Promise<MarketplaceEntry[]> {
    const all = await this.readAll();
    return all.map(normalize).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  async get(id: string): Promise<MarketplaceEntry | null> {
    const all = await this.readAll();
    const found = all.find((e) => e.id === id);
    return found ? normalize(found) : null;
  }
  async put(entry: MarketplaceEntry): Promise<void> {
    const all = await this.readAll();
    const i = all.findIndex((e) => e.id === entry.id);
    if (i >= 0) all[i] = entry;
    else all.push(entry);
    await this.writeAll(all);
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
