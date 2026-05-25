import assert from "node:assert/strict";
import test from "node:test";
import { buildMetricDataPoint, hashSearchQuery } from "./metrics-core.ts";

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
