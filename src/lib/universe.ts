import { listSkills } from "./storage";

/** Lightweight projection of a skill for the 3D universe. Keeps the client
 *  payload small (~155 skills) while carrying enough to render a full detail
 *  panel without a second fetch. */
export interface UniverseSkill {
  name: string;
  description: string;
  category: string;
  audience: string;
  stars: number | null;
  concepts: { term: string; explanation: string }[];
  whenToUse: string[];
  gotchas: string[];
  sourceUrl: string;
  /** Names of the most-related skills (shared concepts/tokens, same category
   *  bonus). Drives the orbit lines + "explore deeper" hops. */
  related: string[];
}

interface SeedShape {
  sourceUrl?: string;
  skill?: {
    name?: string;
    description?: string;
    whenToUse?: string[];
    keyConcepts?: { term: string; explanation: string }[];
    gotchas?: string[];
    category?: string;
    audience?: string;
  };
}

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "for", "with", "use", "when", "skill",
  "skills", "agent", "agents", "your", "you", "this", "that", "into", "from",
]);

function tokens(s: UniverseSkill): Set<string> {
  const out = new Set<string>();
  for (const part of s.name.split("-")) if (part.length > 2 && !STOPWORDS.has(part)) out.add(part);
  for (const c of s.concepts) {
    for (const w of c.term.toLowerCase().split(/[^a-z0-9]+/)) {
      if (w.length > 3 && !STOPWORDS.has(w)) out.add(w);
    }
  }
  return out;
}

function computeRelated(all: UniverseSkill[]): void {
  const toks = all.map(tokens);
  for (let i = 0; i < all.length; i++) {
    const scored: { name: string; score: number }[] = [];
    for (let j = 0; j < all.length; j++) {
      if (i === j) continue;
      let overlap = 0;
      for (const t of toks[i]) if (toks[j].has(t)) overlap++;
      let score = overlap * 2;
      if (all[i].category === all[j].category) score += 1;
      if (all[i].audience === all[j].audience) score += 0.5;
      if (score > 1) scored.push({ name: all[j].name, score });
    }
    scored.sort((a, b) => b.score - a.score);
    // Guarantee at least a few hops even for loosely-connected skills by
    // padding with same-category neighbors.
    const related = scored.slice(0, 6).map((s) => s.name);
    if (related.length < 4) {
      for (const other of all) {
        if (related.length >= 4) break;
        if (other.name !== all[i].name && other.category === all[i].category && !related.includes(other.name)) {
          related.push(other.name);
        }
      }
    }
    all[i].related = related;
  }
}

async function loadSeeds(): Promise<UniverseSkill[]> {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const dir = path.join(process.cwd(), "scripts", "seeds");
  let files: string[] = [];
  try {
    files = (await fs.readdir(dir)).filter((f) => f.endsWith(".json"));
  } catch {
    return [];
  }
  const out: UniverseSkill[] = [];
  for (const f of files) {
    try {
      const raw = JSON.parse(await fs.readFile(path.join(dir, f), "utf-8")) as SeedShape;
      const s = raw.skill;
      if (!s?.name || !s.description) continue;
      out.push({
        name: s.name,
        description: s.description,
        category: s.category ?? "other",
        audience: s.audience ?? "creators",
        stars: null,
        concepts: (s.keyConcepts ?? []).slice(0, 6),
        whenToUse: (s.whenToUse ?? []).slice(0, 4),
        gotchas: (s.gotchas ?? []).slice(0, 6),
        sourceUrl: raw.sourceUrl ?? "",
        related: [],
      });
    } catch {
      // skip malformed seed
    }
  }
  return out;
}

export async function loadUniverseSkills(): Promise<UniverseSkill[]> {
  let fromStore: UniverseSkill[] = [];
  try {
    const entries = await listSkills();
    fromStore = entries
      .filter((e) => e.versionStatus !== "retired" && e.versionStatus !== "candidate")
      .map((e) => ({
        name: e.skill.name,
        description: e.skill.description,
        category: e.skill.category,
        audience: e.skill.audience,
        stars: e.stars ?? null,
        concepts: e.skill.keyConcepts.slice(0, 6),
        whenToUse: e.skill.whenToUse.slice(0, 4),
        gotchas: e.skill.gotchas.slice(0, 6),
        sourceUrl: e.sourceUrl,
        related: [],
      }));
  } catch {
    fromStore = [];
  }

  const byName = new Map<string, UniverseSkill>();
  for (const s of fromStore) if (!byName.has(s.name)) byName.set(s.name, s);
  if (byName.size < 12) {
    // Local dev (empty KV/file store): hydrate the galaxy from the seed corpus.
    for (const s of await loadSeeds()) if (!byName.has(s.name)) byName.set(s.name, s);
  }

  const all = [...byName.values()];
  computeRelated(all);
  return all;
}
