import assert from "node:assert/strict";
import test from "node:test";
import {
  isNew,
  relativeTime,
  sortPromptsByRecency,
  packLastUpdated,
  NEW_WINDOW_DAYS,
} from "./packs-util.ts";
import type { PromptItem } from "./packs.ts";

const daysAgo = (n: number) =>
  new Date(Date.now() - n * 86_400_000).toISOString();

const item = (id: string, addedAt?: string): PromptItem =>
  ({ id, title: id, category: "x", prompt: "p", addedAt }) as PromptItem;

test("isNew: within window is new, outside/missing/invalid is not", () => {
  assert.equal(isNew(daysAgo(0)), true);
  assert.equal(isNew(daysAgo(NEW_WINDOW_DAYS - 1)), true);
  assert.equal(isNew(daysAgo(NEW_WINDOW_DAYS + 1)), false);
  assert.equal(isNew(undefined), false);
  assert.equal(isNew("not-a-date"), false);
});

test("isNew: boundary at exactly the window edge counts as new", () => {
  // addedAt exactly NEW_WINDOW_DAYS old → diff ≈ window, still <= window.
  assert.equal(isNew(daysAgo(NEW_WINDOW_DAYS)), true);
});

test("relativeTime: buckets and empty cases", () => {
  assert.equal(relativeTime(daysAgo(0)), "today");
  assert.equal(relativeTime(daysAgo(1)), "yesterday");
  assert.equal(relativeTime(daysAgo(4)), "4 days ago");
  assert.equal(relativeTime(daysAgo(10)), "last week");
  assert.equal(relativeTime(daysAgo(18)), "2 weeks ago");
  assert.equal(relativeTime(daysAgo(21)), "3 weeks ago");
  assert.equal(relativeTime(undefined), "");
  assert.equal(relativeTime("nope"), "");
});

test("sortPromptsByRecency: newest first, undated keep file order and sort last", () => {
  const prompts = [
    item("old", daysAgo(30)),
    item("undated-1"),
    item("new", daysAgo(1)),
    item("undated-2"),
    item("mid", daysAgo(10)),
  ];
  const ids = sortPromptsByRecency(prompts).map((p) => p.id);
  assert.deepEqual(ids, ["new", "mid", "old", "undated-1", "undated-2"]);
});

test("sortPromptsByRecency: pure (does not mutate input)", () => {
  const prompts = [item("a", daysAgo(2)), item("b", daysAgo(1))];
  const before = prompts.map((p) => p.id);
  sortPromptsByRecency(prompts);
  assert.deepEqual(
    prompts.map((p) => p.id),
    before
  );
});

test("packLastUpdated: max date, or null when all undated", () => {
  const pack = { prompts: [item("a", daysAgo(5)), item("b", daysAgo(2)), item("c")] } as never;
  const updated = packLastUpdated(pack);
  assert.equal(updated, new Date(Date.parse(daysAgo(2))).toISOString());

  const undated = { prompts: [item("a"), item("b")] } as never;
  assert.equal(packLastUpdated(undated), null);
});
