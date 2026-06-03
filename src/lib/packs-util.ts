import type { PromptItem, PromptPack } from "./packs";

/**
 * Pure pack helpers — no data import, so they're unit-testable under
 * `node --experimental-strip-types` (which can't resolve packs.ts's JSON
 * import). `packs.ts` re-exports these as its public surface.
 */

/** Days within which a prompt's `addedAt` counts as "new". */
export const NEW_WINDOW_DAYS = 7;

/** True when `addedAt` is within the freshness window. Undated → never new. */
export function isNew(addedAt?: string, days = NEW_WINDOW_DAYS): boolean {
  if (!addedAt) return false;
  const t = new Date(addedAt).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t <= days * 86_400_000;
}

/** Human relative time for the provenance line, e.g. "today", "4 days ago".
 *  Computed per request (pack pages are force-dynamic, so this never goes
 *  stale at the edge). Returns "" for missing/invalid dates. */
export function relativeTime(addedAt?: string): string {
  if (!addedAt) return "";
  const t = new Date(addedAt).getTime();
  if (Number.isNaN(t)) return "";
  const days = Math.floor((Date.now() - t) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 14) return "last week";
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 60) return "last month";
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)}y ago`;
}

/** Prompts sorted newest-first by `addedAt`. Stable: undated entries keep their
 *  file order and sort after every dated one. Pure — returns a new array. */
export function sortPromptsByRecency(prompts: PromptItem[]): PromptItem[] {
  return prompts
    .map((p, i) => ({ p, i }))
    .sort((a, b) => {
      const ta = a.p.addedAt ? new Date(a.p.addedAt).getTime() : NaN;
      const tb = b.p.addedAt ? new Date(b.p.addedAt).getTime() : NaN;
      const aHas = !Number.isNaN(ta);
      const bHas = !Number.isNaN(tb);
      if (aHas && bHas) return tb - ta || a.i - b.i;
      if (aHas) return -1;
      if (bHas) return 1;
      return a.i - b.i;
    })
    .map((x) => x.p);
}

/** Most recent `addedAt` across a pack's prompts, or null if none are dated.
 *  Powers the "updated {when}" stamp on the pack header. */
export function packLastUpdated(pack: PromptPack): string | null {
  let max = 0;
  for (const p of pack.prompts) {
    if (!p.addedAt) continue;
    const t = new Date(p.addedAt).getTime();
    if (!Number.isNaN(t) && t > max) max = t;
  }
  return max ? new Date(max).toISOString() : null;
}
