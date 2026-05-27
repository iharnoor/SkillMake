/**
 * Bounded skill edits — the SkillOpt "gradient step" applied to a SKILL.md.
 *
 * Storage carries SkillEdit[] opaquely; the apply/validate logic lives here.
 * Each op is atomic and reversible. The edit budget (MAX_EDITS_PER_STEP) is
 * the textual analog of a learning rate — remove the cap and the optimizer
 * destabilizes.
 *
 * Forbidden on this surface (require a new submission, not an edit):
 *   - replace_name              breaks /i/<name> install URL
 *   - replace_apiReference.signature   changes the contract, not refinement
 *   - replace_category, replace_audience   changes marketplace placement
 *
 * Full Zod schemas + apply() logic land in Phase 1c. This file declares the
 * type so storage.ts can carry edits on MarketplaceEntry without a cycle.
 */

export type SkillEdit =
  | { op: "add_gotcha"; value: string }
  | { op: "delete_gotcha"; index: number }
  | { op: "replace_gotcha"; index: number; value: string }
  | { op: "add_keyConcept"; value: { term: string; explanation: string } }
  | { op: "replace_keyConcept"; index: number; value: { term: string; explanation: string } }
  | { op: "delete_keyConcept"; index: number }
  | { op: "replace_description"; value: string }
  | { op: "replace_whenToUse_item"; index: number; value: string }
  | { op: "replace_apiReference_example"; index: number; value: string };

export const MAX_EDITS_PER_STEP = 8;
