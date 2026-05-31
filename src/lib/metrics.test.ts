import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMetricDataPoint,
  hashSearchQuery,
  encodeVersionedSlug,
  parseVersionedSlug,
} from "./metrics-core.ts";

test("buildMetricDataPoint writes standard product event shape", () => {
  const point = buildMetricDataPoint(
    "install_hit",
    { slug: "hyperframes" },
    {
      country: "US",
      refererHost: "google.com",
      uaCat: "curl",
      visitor: "abc12345",
    }
  );
  assert.deepEqual(point.indexes, ["install_hit"]);
  assert.deepEqual(point.blobs, [
    "install_hit",
    "hyperframes",
    "US",
    "google.com",
    "curl",
    "abc12345",
  ]);
  assert.deepEqual(point.doubles, [1]);
});

test("buildMetricDataPoint appends audience + category for catalog events", () => {
  const point = buildMetricDataPoint(
    "skill_added",
    { slug: "firecrawl-mcp", audience: "claude-code", category: "mcp" },
    {
      country: "US",
      refererHost: "",
      uaCat: "browser",
      visitor: "feedface",
    }
  );
  assert.deepEqual(point.blobs, [
    "skill_added",
    "firecrawl-mcp",
    "US",
    "",
    "browser",
    "feedface",
    "claude-code",
    "mcp",
  ]);
});

test("buildMetricDataPoint omits audience/category blobs when not provided", () => {
  // Backwards compat: install_hit and other non-catalog events keep 6 blobs.
  const point = buildMetricDataPoint(
    "marketplace_view",
    { slug: "caveman" },
    { country: "US", refererHost: "", uaCat: "browser", visitor: "abc12345" }
  );
  assert.equal(point.blobs.length, 6);
});

test("buildMetricDataPoint stores HTTP status in double2 for ops events", () => {
  const point = buildMetricDataPoint(
    "api_error",
    { slug: "convert", status: 500 },
    {
      country: "??",
      refererHost: "",
      uaCat: "browser",
      visitor: "deadbeef",
    }
  );
  assert.deepEqual(point.doubles, [1, 500]);
});

test("hashSearchQuery is stable and does not echo raw query text", async () => {
  const a = await hashSearchQuery("React Server Components");
  const b = await hashSearchQuery("React Server Components");
  const c = await hashSearchQuery("react server components");
  assert.equal(a, b);
  assert.equal(a, c);
  assert.match(a, /^[0-9a-f]{16}$/);
  assert.doesNotMatch(a, /react/i);
});

test("encodeVersionedSlug uses first 8 chars of contentHash", () => {
  assert.equal(encodeVersionedSlug("caveman", "abcdef0123456789"), "caveman@abcdef01");
  assert.equal(encodeVersionedSlug("hyperframes", "deadbeefcafef00d"), "hyperframes@deadbeef");
});

test("parseVersionedSlug round-trips encodeVersionedSlug", () => {
  const slug = encodeVersionedSlug("ralph-loop", "fedcba9876543210");
  const parsed = parseVersionedSlug(slug);
  assert.equal(parsed.name, "ralph-loop");
  assert.equal(parsed.versionHash, "fedcba98");
});

test("parseVersionedSlug treats legacy unversioned slugs as name-only", () => {
  // install_hit rows written before Phase 1b have no @hash suffix; they
  // should still attribute to their skill name.
  const parsed = parseVersionedSlug("caveman");
  assert.equal(parsed.name, "caveman");
  assert.equal(parsed.versionHash, null);
});

test("parseVersionedSlug handles names containing @ defensively (split on first)", () => {
  // skill names are kebab-case-only by Zod (no @), but be paranoid anyway.
  const parsed = parseVersionedSlug("weird-name@abc12345");
  assert.equal(parsed.name, "weird-name");
  assert.equal(parsed.versionHash, "abc12345");
});
