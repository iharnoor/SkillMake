import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMetricDataPoint,
  buildPostHogProperties,
  hashSearchQuery,
  encodeVersionedSlug,
  normalizePostHogHost,
  parseVersionedSlug,
  phDistinctId,
  POSTHOG_CLIENT_EVENTS,
  type MetricContext,
} from "./metrics-core.ts";

const CTX: MetricContext = {
  country: "US",
  refererHost: "google.com",
  uaCat: "browser",
  visitor: "abc12345",
};

function headersWith(cookie: string): Headers {
  return new Headers({ cookie });
}

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

test("phDistinctId falls back to visitor hash when no headers", () => {
  const { id, fromCookie } = phDistinctId(undefined, CTX);
  assert.equal(id, "abc12345");
  assert.equal(fromCookie, false);
});

test("phDistinctId reuses the posthog cookie distinct_id when present", () => {
  const cookieVal = encodeURIComponent(JSON.stringify({ distinct_id: "person-xyz" }));
  const { id, fromCookie } = phDistinctId(
    headersWith(`ph_phc_test123_posthog=${cookieVal}; other=1`),
    CTX
  );
  assert.equal(id, "person-xyz");
  assert.equal(fromCookie, true);
});

test("phDistinctId falls back when cookie JSON lacks distinct_id", () => {
  const cookieVal = encodeURIComponent(JSON.stringify({ session_id: "s1" }));
  const { id, fromCookie } = phDistinctId(headersWith(`ph_phc_k_posthog=${cookieVal}`), CTX);
  assert.equal(id, "abc12345");
  assert.equal(fromCookie, false);
});

test("phDistinctId falls back when the posthog cookie is malformed JSON", () => {
  const { id, fromCookie } = phDistinctId(headersWith("ph_phc_k_posthog=not%7Bjson"), CTX);
  assert.equal(id, "abc12345");
  assert.equal(fromCookie, false);
});

test("phDistinctId falls back when no ph_*_posthog cookie is set", () => {
  const { id, fromCookie } = phDistinctId(headersWith("session=1; theme=dark"), CTX);
  assert.equal(id, "abc12345");
  assert.equal(fromCookie, false);
});

test("POSTHOG_CLIENT_EVENTS skips client-captured events and keeps server ones", () => {
  assert.ok(POSTHOG_CLIENT_EVENTS.has("github_click"));
  assert.ok(POSTHOG_CLIENT_EVENTS.has("scroll_depth"));
  assert.ok(!POSTHOG_CLIENT_EVENTS.has("install_hit"));
  assert.ok(!POSTHOG_CLIENT_EVENTS.has("convert_error"));
});

test("buildPostHogProperties flags non-browser events as events-only (no person profile)", () => {
  const props = buildPostHogProperties({ slug: "caveman" }, { ...CTX, uaCat: "curl" }, false);
  assert.equal(props.$process_person_profile, false);
  assert.equal(props.skill_slug, "caveman");
  assert.equal(props.country, "US");
  assert.equal(props.$lib, "skillmake-server");
});

test("buildPostHogProperties omits the person-profile flag for cookie-backed browsers", () => {
  const props = buildPostHogProperties({ slug: "caveman" }, CTX, true);
  assert.ok(!("$process_person_profile" in props));
});

test("buildPostHogProperties carries status, audience, and category when set", () => {
  const props = buildPostHogProperties(
    { status: 500, audience: "claude-code", category: "mcp" },
    CTX,
    true
  );
  assert.equal(props.http_status, 500);
  assert.equal(props.skill_audience, "claude-code");
  assert.equal(props.skill_category, "mcp");
  assert.ok(!("skill_slug" in props));
});

test("normalizePostHogHost trims a single trailing slash so /capture/ never doubles", () => {
  assert.equal(normalizePostHogHost("https://us.i.posthog.com/"), "https://us.i.posthog.com");
  assert.equal(normalizePostHogHost("https://eu.i.posthog.com"), "https://eu.i.posthog.com");
});
