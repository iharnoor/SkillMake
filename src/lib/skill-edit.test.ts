import assert from "node:assert/strict";
import test from "node:test";
import {
  applyEdits,
  ApplyError,
  SkillEditsPayload,
  MAX_EDITS_PER_STEP,
  OP_TO_SECTION,
} from "./skill-edit.ts";
import { SkillSchema, type Skill } from "./skill-schema.ts";

const baseSkill: Skill = SkillSchema.parse({
  name: "caveman",
  description: "Use when minimizing output tokens so the agent replies in technical fragments instead of prose.",
  whenToUse: [
    "Cutting Claude output tokens on a long coding session",
    "Replying with technical fragments not prose",
  ],
  keyConcepts: [
    { term: "Filler removal", explanation: "Drop hedges, restatements, and politeness." },
    { term: "Fragment grammar", explanation: "Speak in fragments. Skip articles when context is clear." },
    { term: "Code-first", explanation: "Lead with code, follow with one-line context." },
  ],
  apiReference: [
    { signature: "agent.style.set('caveman')", purpose: "Switch the agent into caveman mode.", example: "agent.style.set('caveman');" },
  ],
  gotchas: [
    "Don't apply to writing for end users; reads terse to non-engineers.",
    "Keep apologies — fragmenting is style, not a license to skip accountability.",
  ],
  category: "tool",
  audience: "general",
  videoUrls: [],
});

test("applyEdits: add_gotcha appends", () => {
  const after = applyEdits(baseSkill, [{ op: "add_gotcha", value: "Don't use during onboarding flows." }]);
  assert.equal(after.gotchas.length, baseSkill.gotchas.length + 1);
  assert.equal(after.gotchas.at(-1), "Don't use during onboarding flows.");
});

test("applyEdits: delete_gotcha removes by index", () => {
  const after = applyEdits(baseSkill, [{ op: "delete_gotcha", index: 0 }]);
  assert.equal(after.gotchas.length, baseSkill.gotchas.length - 1);
  assert.equal(after.gotchas[0], baseSkill.gotchas[1]);
});

test("applyEdits: replace_gotcha swaps in place", () => {
  const after = applyEdits(baseSkill, [{ op: "replace_gotcha", index: 1, value: "Rewritten gotcha number two." }]);
  assert.equal(after.gotchas[1], "Rewritten gotcha number two.");
  assert.equal(after.gotchas[0], baseSkill.gotchas[0]);
});

test("applyEdits: replace_description updates description", () => {
  const newDesc = "Use when an agent should drop filler and reply with code-first technical fragments under tight token budgets.";
  const after = applyEdits(baseSkill, [{ op: "replace_description", value: newDesc }]);
  assert.equal(after.description, newDesc);
});

test("applyEdits: replace_whenToUse_item is index-bounded", () => {
  assert.throws(
    () => applyEdits(baseSkill, [{ op: "replace_whenToUse_item", index: 99, value: "out of bounds" }]),
    (err: Error) => err instanceof ApplyError && err.editIndex === 0
  );
});

test("applyEdits: replace_apiReference_example keeps signature, swaps example", () => {
  const after = applyEdits(baseSkill, [
    { op: "replace_apiReference_example", index: 0, value: "agent.style.set('caveman', { strict: true });" },
  ]);
  assert.equal(after.apiReference[0].signature, baseSkill.apiReference[0].signature);
  assert.equal(after.apiReference[0].purpose, baseSkill.apiReference[0].purpose);
  assert.equal(after.apiReference[0].example, "agent.style.set('caveman', { strict: true });");
});

test("applyEdits: leaves parent unmodified (pure function)", () => {
  const before = JSON.stringify(baseSkill);
  applyEdits(baseSkill, [{ op: "add_gotcha", value: "scratch" }]);
  assert.equal(JSON.stringify(baseSkill), before);
});

test("applyEdits: multi-op step composes correctly", () => {
  const after = applyEdits(baseSkill, [
    { op: "add_gotcha", value: "Skip when speaking to end users in product UI." },
    { op: "replace_gotcha", index: 0, value: "Rewritten first gotcha." },
    { op: "add_keyConcept", value: { term: "Politeness budget", explanation: "Allocate exactly one apology per session." } },
  ]);
  assert.equal(after.gotchas.length, baseSkill.gotchas.length + 1);
  assert.equal(after.gotchas[0], "Rewritten first gotcha.");
  assert.equal(after.keyConcepts.at(-1)?.term, "Politeness budget");
});

test("SkillEditsPayload caps at MAX_EDITS_PER_STEP", () => {
  const ok = Array.from({ length: MAX_EDITS_PER_STEP }, () => ({
    op: "add_gotcha" as const,
    value: "filler gotcha extra context",
  }));
  assert.equal(SkillEditsPayload.safeParse(ok).success, true);
  const tooMany = [...ok, { op: "add_gotcha" as const, value: "one more" }];
  assert.equal(SkillEditsPayload.safeParse(tooMany).success, false);
});

test("OP_TO_SECTION maps every op kind", () => {
  const ops = [
    "add_gotcha", "delete_gotcha", "replace_gotcha",
    "add_keyConcept", "delete_keyConcept", "replace_keyConcept",
    "replace_whenToUse_item", "replace_apiReference_example",
    "replace_description",
  ] as const;
  for (const op of ops) {
    assert.ok(op in OP_TO_SECTION, `op ${op} missing from OP_TO_SECTION`);
  }
  // replace_description is the only op without a protectable section binding.
  assert.equal(OP_TO_SECTION.replace_description, null);
});
