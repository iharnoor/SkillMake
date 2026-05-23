import { getEnv } from "./env";

export type MetricEvent =
  | "install_hit"
  | "marketplace_view"
  | "home_view"
  | "submit_started"
  | "tricks_view"
  | "powerhouse_view"
  | "search_submitted"
  | "github_click"
  | "page_dwell"
  | "scroll_depth";

export interface TrackOpts {
  /** Skill slug (skill.name). Empty for non-skill events like home_view. */
  slug?: string;
  /** Request headers — pass `request.headers` from a Route Handler, or
   *  `await headers()` from a Server Component (read BEFORE `after()`). */
  headers?: Headers;
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
 */
export async function track(event: MetricEvent, opts: TrackOpts = {}): Promise<void> {
  try {
    const env = await getEnv();
    if (!env.METRICS) return;
    const h = opts.headers;
    const country = h?.get("cf-ipcountry") ?? "??";
    let refererHost = "";
    const referer = h?.get("referer");
    if (referer) {
      try {
        refererHost = new URL(referer).host;
      } catch {
        // ignore malformed referer
      }
    }
    const ua = h?.get("user-agent") ?? "";
    const uaCat = /curl|wget|httpie/i.test(ua)
      ? "curl"
      : /bot|crawl|spider|preview|fetch/i.test(ua)
      ? "bot"
      : /Mozilla/.test(ua)
      ? "browser"
      : "other";
    const ip = h?.get("cf-connecting-ip") ?? "";
    const day = new Date().toISOString().slice(0, 10);
    const visitor = await sha8(`${ip}|${ua}|${day}`);
    env.METRICS.writeDataPoint({
      indexes: [event],
      blobs: [event, opts.slug ?? "", country, refererHost, uaCat, visitor],
      doubles: [1],
    });
  } catch {
    // metric writes must never break the response
  }
}

async function sha8(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  const view = new Uint8Array(buf, 0, 8);
  let out = "";
  for (const b of view) out += b.toString(16).padStart(2, "0");
  return out;
}
