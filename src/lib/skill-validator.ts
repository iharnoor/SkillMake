/**
 * SkillOpt static validation gate.
 *
 * Runs synchronously on every candidate insert. Returns { pass, reasons }.
 * A "fail" can still be force-merged by a curator (the override is logged),
 * matching the paper's researcher-override pattern. The cron in Phase 3 only
 * promotes candidates that passed this gate AND won the dynamic conversion
 * comparison.
 *
 * Checks (in order, each contributes a reason on fail):
 *   1. Schema shape (Zod pass-through)
 *   2. Edit budget — edits.length ≤ MAX_EDITS_PER_STEP
 *   3. Edits don't touch protectedSections
 *   4. Token count of rendered markdown (warn at 1200, fail at 1500)
 *   5. Description ↔ whenToUse coherence (router-vs-body alignment)
 *   6. Protected-section byte-identity between parent and candidate markdown
 */

import {
  SkillSchema,
  renderSkillMarkdown,
  extractProtectedBlocks,
  type Skill,
  type ProtectedSectionId,
} from "./skill-schema.ts";
import type { SkillEdit } from "./skill-edit.ts";
import { MAX_EDITS_PER_STEP } from "./skill-edit.ts";

export interface ValidationInput {
  parent: { skill: Skill; markdown: string };
  candidate: { skill: Skill; markdown: string };
  edits: SkillEdit[];
}

export interface ValidationResult {
  pass: boolean;
  warnings: string[];
  reasons: string[]; // hard fails
  tokenCount: number;
}

// Rough char-to-token approximation. The paper's "median ~920 tokens" target
// uses a real tokenizer; we use chars/4 which is accurate enough for gating
// (off by ~15% worst case). Worth replacing with @anthropic-ai/tokenizer if
// budget pressure starts mattering.
const TARGET_TOKENS = 920;
const WARN_TOKENS = 1200;
const FAIL_TOKENS = 1500;

export function validateCandidate(input: ValidationInput): ValidationResult {
  const reasons: string[] = [];
  const warnings: string[] = [];
  const { parent, candidate, edits } = input;

  // 1. Schema shape — Zod pass-through.
  const schemaCheck = SkillSchema.safeParse(candidate.skill);
  if (!schemaCheck.success) {
    reasons.push(
      `schema: ${schemaCheck.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`
    );
  }

  // 2. Edit budget.
  if (edits.length > MAX_EDITS_PER_STEP) {
    reasons.push(
      `edit_budget: ${edits.length} edits exceed MAX_EDITS_PER_STEP (${MAX_EDITS_PER_STEP}). ` +
        "Bounded edits beat full rewrites — the cap is the learning rate."
    );
  }

  // 3. Edits don't touch protected sections.
  const protectedIds = new Set<ProtectedSectionId>(candidate.skill.protectedSections ?? []);
  for (const edit of edits) {
    const touched = touchedSection(edit);
    if (touched && protectedIds.has(touched)) {
      reasons.push(
        `protected_section: op '${edit.op}' touches '${touched}' which is in protectedSections`
      );
    }
  }

  // 4. Token count.
  const tokenCount = estimateTokens(candidate.markdown);
  if (tokenCount > FAIL_TOKENS) {
    reasons.push(
      `token_count: rendered markdown is ~${tokenCount} tokens (cap ${FAIL_TOKENS}, target ${TARGET_TOKENS}). ` +
        "Compactness wins — drop low-signal lines or split into two skills."
    );
  } else if (tokenCount > WARN_TOKENS) {
    warnings.push(
      `token_count_warn: ~${tokenCount} tokens (target ${TARGET_TOKENS}). Still under the cap but trending bloated.`
    );
  }

  // 5. Description ↔ whenToUse coherence.
  const incoherent = checkCoherence(candidate.skill.description, candidate.skill.whenToUse);
  if (incoherent.length > 0) {
    warnings.push(
      `coherence_warn: whenToUse items don't share a keyword with the description: ${incoherent.join(
        ", "
      )}. Router (description) and agent body (whenToUse) may disagree.`
    );
  }

  // 6. Protected-section byte-identity at the rendered-markdown level.
  if (protectedIds.size > 0) {
    const parentBlocks = extractProtectedBlocks(parent.markdown);
    const candidateBlocks = extractProtectedBlocks(candidate.markdown);
    for (const id of protectedIds) {
      const parentBody = parentBlocks.get(id);
      const candidateBody = candidateBlocks.get(id);
      if (parentBody !== candidateBody) {
        reasons.push(
          `protected_byte_identity: section '${id}' bytes differ between parent and candidate. ` +
            "Fast edits cannot overwrite slow lessons — see protectedSections."
        );
      }
    }
  }

  return {
    pass: reasons.length === 0,
    reasons,
    warnings,
    tokenCount,
  };
}

/** Re-render the candidate from the edited Skill object. Useful when the
 *  caller wants the validator to compute candidate.markdown itself. */
export function renderAndValidate(
  parent: { skill: Skill; markdown: string },
  candidateSkill: Skill,
  edits: SkillEdit[],
  sourceUrl: string,
  generatedAt: string
): ValidationResult & { markdown: string } {
  const markdown = renderSkillMarkdown(candidateSkill, sourceUrl, generatedAt);
  const result = validateCandidate({
    parent,
    candidate: { skill: candidateSkill, markdown },
    edits,
  });
  return { ...result, markdown };
}

function touchedSection(edit: SkillEdit): ProtectedSectionId | null {
  switch (edit.op) {
    case "add_gotcha":
    case "delete_gotcha":
    case "replace_gotcha":
      return "gotchas";
    case "add_keyConcept":
    case "delete_keyConcept":
    case "replace_keyConcept":
      return "keyConcepts";
    case "replace_whenToUse_item":
      return "whenToUse";
    case "replace_apiReference_example":
      return "apiReference";
    case "replace_description":
      return null; // description lives in YAML frontmatter, not a protectable section
  }
}

function estimateTokens(markdown: string): number {
  // chars/4 ≈ tokens. Cheap, close enough for gating.
  return Math.ceil(markdown.length / 4);
}

function checkCoherence(description: string, whenToUse: string[]): string[] {
  const keywords = extractKeywords(description);
  if (keywords.size === 0) return [];
  const incoherent: string[] = [];
  for (let i = 0; i < whenToUse.length; i++) {
    const trigger = whenToUse[i];
    const triggerWords = extractKeywords(trigger);
    let overlap = false;
    for (const w of triggerWords) {
      if (keywords.has(w)) {
        overlap = true;
        break;
      }
    }
    if (!overlap) incoherent.push(`#${i}`);
  }
  return incoherent;
}

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "of", "in", "on", "at", "to", "for",
  "with", "is", "are", "was", "were", "be", "been", "being", "use", "when",
  "you", "your", "this", "that", "it", "its", "as", "by", "from", "if",
  "then", "so", "do", "does", "can", "will", "have", "has", "had", "not",
  "no", "yes", "any", "all", "some", "one", "two", "more", "most", "less",
  "user", "agent", "want", "wants", "need", "needs", "should", "want", "to",
]);

function extractKeywords(text: string): Set<string> {
  const words = text.toLowerCase().match(/[a-z][a-z0-9]{2,}/g) ?? [];
  return new Set(words.filter((w) => !STOPWORDS.has(w)));
}
