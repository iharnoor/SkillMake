import assert from "node:assert/strict";
import test from "node:test";
import {
  SkillSchema,
  renderSkillMarkdown,
  extractProtectedBlocks,
  type Skill,
} from "./skill-schema.ts";
import { validateCandidate, renderAndValidate } from "./skill-validator.ts";
import type { SkillEdit } from "./skill-edit.ts";

const baseSkill: Skill = SkillSchema.parse({
  name: "caveman",
  description: "Use when minimizing output tokens so the agent replies in technical fragments instead of prose.",
  whenToUse: [
    "Cutting Claude output tokens on a long coding session",
    "Replying with technical fragments not prose",
  ],
  keyConcepts: [
    { term: "Filler removal", explanation: "Drop hedges, restatements, and politeness — keep facts and code." },
    { term: "Fragment grammar", explanation: "Speak in fragments. Skip articles when context is clear." },
    { term: "Code-first response", explanation: "Lead with the code, follow with one-line context only when essential." },
  ],
  apiReference: [],
  gotchas: [
    "Don't apply to writing for end users; the fragments read terse to non-engineers.",
    "Keep apologies — the fragmenting is style, not a license to skip accountability.",
  ],
  category: "tool",
  audience: "general",
  videoUrls: [],
});

const SOURCE = "https://github.com/example/caveman";
const GENERATED = "2026-05-27T00:00:00.000Z";

function render(skill: Skill): string {
  return renderSkillMarkdown(skill, SOURCE, GENERATED);
}

test("renderSkillMarkdown wraps protected sections in markers", () => {
  const protectedSkill: Skill = { ...baseSkill, protectedSections: ["gotchas", "keyConcepts"] };
  const md = render(protectedSkill);
  assert.match(md, /<!-- @protected:gotchas -->/);
  assert.match(md, /<!-- \/@protected:gotchas -->/);
  assert.match(md, /<!-- @protected:keyConcepts -->/);
  assert.doesNotMatch(md, /<!-- @protected:whenToUse -->/);
});

test("extractProtectedBlocks roundtrips through renderSkillMarkdown", () => {
  const protectedSkill: Skill = { ...baseSkill, protectedSections: ["gotchas"] };
  const md = render(protectedSkill);
  const blocks = extractProtectedBlocks(md);
  assert.equal(blocks.size, 1);
  assert.ok(blocks.get("gotchas"));
  // The block body should include both gotcha bullets.
  const body = blocks.get("gotchas")!;
  assert.match(body, /Don't apply to writing for end users/);
  assert.match(body, /Keep apologies/);
});

test("validateCandidate passes a clean 1-op edit", () => {
  const parentMd = render(baseSkill);
  const candidate: Skill = {
    ...baseSkill,
    gotchas: [...baseSkill.gotchas, "Also: don't use during onboarding tutorials."],
  };
  const candidateMd = render(candidate);
  const result = validateCandidate({
    parent: { skill: baseSkill, markdown: parentMd },
    candidate: { skill: candidate, markdown: candidateMd },
    edits: [{ op: "add_gotcha", value: "Also: don't use during onboarding tutorials." }],
  });
  assert.equal(result.pass, true, JSON.stringify(result.reasons));
});

test("validateCandidate rejects edits that exceed MAX_EDITS_PER_STEP", () => {
  const parentMd = render(baseSkill);
  const tooMany: SkillEdit[] = Array.from({ length: 9 }, () => ({
    op: "add_gotcha",
    value: "filler gotcha ".repeat(2).trim(),
  } as SkillEdit));
  const candidate: Skill = {
    ...baseSkill,
    gotchas: [...baseSkill.gotchas, ...tooMany.map((e) => (e as { value: string }).value)],
  };
  const candidateMd = render(candidate);
  const result = validateCandidate({
    parent: { skill: baseSkill, markdown: parentMd },
    candidate: { skill: candidate, markdown: candidateMd },
    edits: tooMany,
  });
  assert.equal(result.pass, false);
  assert.ok(result.reasons.some((r) => r.includes("edit_budget")));
});

test("validateCandidate rejects edits that touch a protected section", () => {
  const protectedParent: Skill = { ...baseSkill, protectedSections: ["gotchas"] };
  const parentMd = render(protectedParent);
  const candidate: Skill = {
    ...protectedParent,
    gotchas: [...protectedParent.gotchas, "snuck a new gotcha in"],
  };
  // Re-rendered candidate would change the protected block bytes; validator
  // catches both at the edit level AND at the byte-identity level.
  const candidateMd = render(candidate);
  const result = validateCandidate({
    parent: { skill: protectedParent, markdown: parentMd },
    candidate: { skill: candidate, markdown: candidateMd },
    edits: [{ op: "add_gotcha", value: "snuck a new gotcha in" }],
  });
  assert.equal(result.pass, false);
  assert.ok(result.reasons.some((r) => r.includes("protected_section")));
  assert.ok(result.reasons.some((r) => r.includes("protected_byte_identity")));
});

test("validateCandidate fails when rendered markdown exceeds the token cap", () => {
  const bloat = "x".repeat(7000);
  const candidate: Skill = {
    ...baseSkill,
    gotchas: [...baseSkill.gotchas, bloat],
  };
  const parentMd = render(baseSkill);
  const candidateMd = render(candidate);
  const result = validateCandidate({
    parent: { skill: baseSkill, markdown: parentMd },
    candidate: { skill: candidate, markdown: candidateMd },
    edits: [{ op: "add_gotcha", value: bloat }],
  });
  // Note: the gotcha schema caps individual gotchas at 280 chars, so the
  // SkillSchema check will fail first — but the validator also reports the
  // token-count concern when applicable. We only require pass=false here.
  assert.equal(result.pass, false);
});

test("validateCandidate warns on incoherent whenToUse but does not fail", () => {
  const candidate: Skill = {
    ...baseSkill,
    whenToUse: [
      "Quilting patterns require careful color selection",
      "Replying with technical fragments not prose",
    ],
  };
  const parentMd = render(baseSkill);
  const candidateMd = render(candidate);
  const result = validateCandidate({
    parent: { skill: baseSkill, markdown: parentMd },
    candidate: { skill: candidate, markdown: candidateMd },
    edits: [{ op: "replace_whenToUse_item", index: 0, value: candidate.whenToUse[0] }],
  });
  assert.equal(result.pass, true, JSON.stringify(result.reasons));
  assert.ok(result.warnings.some((w) => w.includes("coherence_warn")));
});

test("renderAndValidate composes render + validate", () => {
  const candidate: Skill = {
    ...baseSkill,
    description: "Use when shrinking agent output tokens by replacing prose with technical fragments and code-first replies.",
  };
  const parentMd = render(baseSkill);
  const result = renderAndValidate(
    { skill: baseSkill, markdown: parentMd },
    candidate,
    [{ op: "replace_description", value: candidate.description }],
    SOURCE,
    GENERATED
  );
  assert.equal(result.pass, true, JSON.stringify(result.reasons));
  assert.ok(result.markdown.includes(candidate.description));
});
