import { getEnv } from "./env";
import {
  buildMetricDataPoint,
  metricContextFromHeaders,
  type MetricEvent,
} from "./metrics-core";

export type { MetricEvent, MetricContext } from "./metrics-core";
export { buildMetricDataPoint, metricContextFromHeaders, hashSearchQuery } from "./metrics-core";

export interface TrackOpts {
  /** Skill slug, bucket, route fragment, or hashed query — depends on event. */
  slug?: string;
  /** Request headers — pass `request.headers` from a Route Handler, or
   *  `await headers()` from a Server Component (read BEFORE `after()`). */
  headers?: Headers;
  /** HTTP status for ops events (`api_error`, `convert_error`). Stored in double2. */
  status?: number;
}

/**
 * Fire-and-forget metric write to Cloudflare Analytics Engine.
 * Safe to call from any server context. Never throws.
 *
 * Blob shape (queryable via the Workers Analytics Engine SQL API):
 *   index1 = event name (also used for sampling grouping)
 *   blob1  = event name
 *   blob2  = slug (skill name) — empty for non-skill events
 *   blob3  = country (cf-ipcountry, "??" if unknown)
 *   blob4  = referer host (empty if direct)
 *   blob5  = UA category (curl | browser | bot | other)
 *   blob6  = daily visitor id — sha256(ip+ua+day) first 8 bytes hex; for uniques
 *   double1 = 1 (count)
 *   double2 = HTTP status (ops events only, when set)
 */
export async function track(event: MetricEvent, opts: TrackOpts = {}): Promise<void> {
  try {
    const env = await getEnv();
    if (!env.METRICS) return;
    const ctx = await metricContextFromHeaders(opts.headers);
    env.METRICS.writeDataPoint(buildMetricDataPoint(event, opts, ctx));
  } catch {
    // metric writes must never break the response
  }
}
