import { getEnv } from "./env";
import {
  buildMetricDataPoint,
  metricContextFromHeaders,
  type MetricContext,
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
  /** Skill audience — set on catalog events (skill_approved/rejected/promoted). Stored in blob7. */
  audience?: string;
  /** Skill category — set on catalog events. Stored in blob8. Use to slice MCPs vs other skills. */
  category?: string;
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
 *   blob7  = skill audience — catalog events only (skill_approved/rejected/promoted)
 *   blob8  = skill category — catalog events only; filter by 'mcp' for MCP-only counts
 *   double1 = 1 (count)
 *   double2 = HTTP status (ops events only, when set)
 */
export async function track(event: MetricEvent, opts: TrackOpts = {}): Promise<void> {
  try {
    const env = await getEnv();
    const ctx = await metricContextFromHeaders(opts.headers);
    env.METRICS?.writeDataPoint(buildMetricDataPoint(event, opts, ctx));
    await mirrorGoogleAnalyticsEvent(env, event, opts, ctx);
  } catch {
    // metric writes must never break the response
  }
}

async function mirrorGoogleAnalyticsEvent(
  env: Awaited<ReturnType<typeof getEnv>>,
  event: MetricEvent,
  opts: TrackOpts,
  ctx: MetricContext
): Promise<void> {
  if (!env.GOOGLE_ANALYTICS_MEASUREMENT_ID || !env.GOOGLE_ANALYTICS_API_SECRET) return;
  if (event === "github_click" || event === "page_dwell" || event === "scroll_depth") return;

  const params: Record<string, string | number> = {
    country: ctx.country,
    referer_host: ctx.refererHost,
    ua_category: ctx.uaCat,
  };
  if (opts.slug) params.skill_slug = opts.slug;
  if (opts.status != null) params.http_status = opts.status;
  if (opts.audience) params.skill_audience = opts.audience;
  if (opts.category) params.skill_category = opts.category;

  const url = new URL("https://www.google-analytics.com/mp/collect");
  url.searchParams.set("measurement_id", env.GOOGLE_ANALYTICS_MEASUREMENT_ID);
  url.searchParams.set("api_secret", env.GOOGLE_ANALYTICS_API_SECRET);

  await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      client_id: ctx.visitor,
      events: [{ name: event, params }],
    }),
  }).catch(() => {});
}
