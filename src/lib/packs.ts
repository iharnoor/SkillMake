import raw from "../../data/packs.json";

/**
 * Prompt Packs — a curated vertical that sits alongside the skill marketplace.
 *
 * Unlike skills (user-submitted, AI-distilled, KV-backed, versioned), packs are
 * hand-curated editorial collections of ready-to-paste prompts for a specific
 * generative model. The source of truth is the bundled `data/packs.json`, which
 * is statically imported so it ships in the edge bundle — no KV, no fs reads at
 * request time (those don't work on the Cloudflare Workers runtime).
 *
 * The first pack mirrors the Nano Banana (Gemini image/video) gallery at
 * nanobananaprompt.org/prompts/. Add Midjourney, Veo, etc. by appending to the
 * JSON — the routes pick them up automatically.
 */
export interface PromptItem {
  /** kebab-case id, unique within the pack; used as the card anchor. */
  id: string;
  title: string;
  /** Display category chip, e.g. "Portrait", "Video", "Food". */
  category: string;
  /** Which model the prompt is tuned for, e.g. "Nano Banana Pro". */
  model?: string;
  /** Human attribution, e.g. "Suzanne · Anthropic". Renders the provenance line
   *  on the card. Optional — absent entries render with no provenance line. */
  author?: string;
  /** ISO date (YYYY-MM-DD) the prompt was added/surfaced. Drives the recency
   *  sort and the "new" badge. Optional — undated entries sort after dated ones
   *  (keeping file order) and never count as new. */
  addedAt?: string;
  /** The full, copy-paste-ready prompt text (may be multi-line JSON). For very
   *  long source material (e.g. leaked system prompts) this is a curated
   *  excerpt and `sourceUrl` points at the complete file. */
  prompt: string;
  /** Optional one-liner on how to adapt or why it works. */
  tip?: string;
  /** Optional link to the full / canonical source for this specific item.
   *  Used when `prompt` is an excerpt (system-prompt leaks) so the card can
   *  offer a "view full ↗" affordance distinct from the pack-level source. */
  sourceUrl?: string;
  /** Optional label for `sourceUrl`, e.g. "view full prompt". */
  sourceLabel?: string;
  /** Set when `prompt` is a truncated excerpt rather than the whole thing. */
  excerpt?: boolean;
}

export interface PromptPack {
  /** URL slug — /packs/<slug>. */
  slug: string;
  title: string;
  tagline: string;
  description: string;
  /** Audience tag (mirrors the skill audience taxonomy where it overlaps). */
  audience: string;
  /** Coarse content category, e.g. "image-gen". */
  category: string;
  /** Human-readable attribution, e.g. "nanobananaprompt.org". */
  source: string;
  /** Canonical source URL for attribution + outbound link. */
  sourceUrl: string;
  /** Optional brand accent (hex) for the pack hero. */
  accent?: string;
  prompts: PromptItem[];
}

interface PacksFile {
  generatedAt: string;
  packs: PromptPack[];
}

const data = raw as unknown as PacksFile;

export function listPacks(): PromptPack[] {
  return data.packs;
}

export function getPack(slug: string): PromptPack | null {
  return data.packs.find((p) => p.slug === slug) ?? null;
}

// Pure, data-free helpers live in packs-util.ts so they're unit-testable under
// node's type-stripper (which can't resolve this module's JSON import).
export {
  NEW_WINDOW_DAYS,
  isNew,
  relativeTime,
  sortPromptsByRecency,
  packLastUpdated,
} from "./packs-util";

/** Distinct category chips in a pack, in first-seen order. */
export function packCategories(pack: PromptPack): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of pack.prompts) {
    if (!seen.has(p.category)) {
      seen.add(p.category);
      out.push(p.category);
    }
  }
  return out;
}
