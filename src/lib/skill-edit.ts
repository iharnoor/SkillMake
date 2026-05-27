/**
 * Bounded skill edits — the SkillOpt "gradient step" applied to a SKILL.md.
 *
 * Each op is atomic and reversible. The edit budget (MAX_EDITS_PER_STEP) is
 * the textual analog of a learning rate — remove the cap and the optimizer
 * destabilizes.
 *
 * Forbidden on this surface (require a new submission, not an edit):
 *   - replace_name              breaks /i/<name> install URL
 *   - replace_apiReference.signature   changes the contract, not refinement
 *   - replace_category, replace_audience   changes marketplace placement
 */

import { z } from "zod";
import type { Skill } from "./skill-schema.ts";

export const MAX_EDITS_PER_STEP = 8;

// ─── Op schemas ──────────────────────────────────────────────────────────

const SkillEditSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("add_gotcha"), value: z.string().min(8).max(280) }),
  z.object({ op: z.literal("delete_gotcha"), index: z.number().int().nonnegative() }),
  z.object({
    op: z.literal("replace_gotcha"),
    index: z.number().int().nonnegative(),
    value: z.string().min(8).max(280),
  }),
  z.object({
    op: z.literal("add_keyConcept"),
    value: z.object({
      term: z.string().min(2).max(80),
      explanation: z.string().min(10).max(500),
    }),
  }),
  z.object({
    op: z.literal("replace_keyConcept"),
    index: z.number().int().nonnegative(),
    value: z.object({
      term: z.string().min(2).max(80),
      explanation: z.string().min(10).max(500),
    }),
  }),
  z.object({ op: z.literal("delete_keyConcept"), index: z.number().int().nonnegative() }),
  z.object({ op: z.literal("replace_description"), value: z.string().min(20).max(220) }),
  z.object({
    op: z.literal("replace_whenToUse_item"),
    index: z.number().int().nonnegative(),
    value: z.string().min(8).max(200),
  }),
  z.object({
    op: z.literal("replace_apiReference_example"),
    index: z.number().int().nonnegative(),
    value: z.string().max(2400),
  }),
]);

export type SkillEdit = z.infer<typeof SkillEditSchema>;

export const SkillEditsPayload = z
  .array(SkillEditSchema)
  .min(1, "at least one edit required")
  .max(MAX_EDITS_PER_STEP, `bounded to ${MAX_EDITS_PER_STEP} ops per step (learning rate)`);

// ─── Apply ───────────────────────────────────────────────────────────────

export class ApplyError extends Error {
  readonly editIndex: number;
  readonly op: string;
  constructor(message: string, editIndex: number, op: string) {
    super(message);
    this.name = "ApplyError";
    this.editIndex = editIndex;
    this.op = op;
  }
}

/**
 * Apply a bounded set of edits to a parent Skill, returning the candidate.
 * Throws ApplyError if an op references an out-of-bounds index. The validator
 * (skill-validator.ts) is responsible for protected-section + schema checks
 * on the result.
 */
export function applyEdits(parent: Skill, edits: SkillEdit[]): Skill {
  // Shallow-clone arrays we mutate; leave others alone.
  const skill: Skill = {
    ...parent,
    whenToUse: [...parent.whenToUse],
    keyConcepts: parent.keyConcepts.map((c) => ({ ...c })),
    apiReference: parent.apiReference.map((a) => ({ ...a })),
    gotchas: [...parent.gotchas],
    videoUrls: [...parent.videoUrls],
    protectedSections: [...(parent.protectedSections ?? [])],
  };

  edits.forEach((edit, i) => {
    switch (edit.op) {
      case "add_gotcha":
        skill.gotchas.push(edit.value);
        break;
      case "delete_gotcha":
        assertIndex(skill.gotchas, edit.index, i, edit.op);
        skill.gotchas.splice(edit.index, 1);
        break;
      case "replace_gotcha":
        assertIndex(skill.gotchas, edit.index, i, edit.op);
        skill.gotchas[edit.index] = edit.value;
        break;
      case "add_keyConcept":
        skill.keyConcepts.push(edit.value);
        break;
      case "replace_keyConcept":
        assertIndex(skill.keyConcepts, edit.index, i, edit.op);
        skill.keyConcepts[edit.index] = edit.value;
        break;
      case "delete_keyConcept":
        assertIndex(skill.keyConcepts, edit.index, i, edit.op);
        skill.keyConcepts.splice(edit.index, 1);
        break;
      case "replace_description":
        skill.description = edit.value;
        break;
      case "replace_whenToUse_item":
        assertIndex(skill.whenToUse, edit.index, i, edit.op);
        skill.whenToUse[edit.index] = edit.value;
        break;
      case "replace_apiReference_example":
        assertIndex(skill.apiReference, edit.index, i, edit.op);
        skill.apiReference[edit.index] = { ...skill.apiReference[edit.index], example: edit.value };
        break;
    }
  });

  return skill;
}

function assertIndex(arr: unknown[], index: number, editIndex: number, op: string) {
  if (index < 0 || index >= arr.length) {
    throw new ApplyError(
      `op '${op}' at edit #${editIndex} references index ${index}, but array length is ${arr.length}`,
      editIndex,
      op
    );
  }
}

// Tag op kinds that touch each protected section. Used by the validator to
// reject edits that target a protected section, without needing to apply the
// edit first.
export const OP_TO_SECTION: Record<SkillEdit["op"], string | null> = {
  add_gotcha: "gotchas",
  delete_gotcha: "gotchas",
  replace_gotcha: "gotchas",
  add_keyConcept: "keyConcepts",
  delete_keyConcept: "keyConcepts",
  replace_keyConcept: "keyConcepts",
  replace_whenToUse_item: "whenToUse",
  replace_apiReference_example: "apiReference",
  replace_description: null,
};
