export type MetricEvent =
  | "install_hit"
  | "marketplace_view"
  | "home_view"
  | "submit_started"
  | "submit_completed"
  | "convert_success"
  | "convert_error"
  | "tricks_view"
  | "powerhouse_view"
  | "search_submitted"
  | "github_click"
  | "page_dwell"
  | "scroll_depth"
  | "api_error";

export interface MetricContext {
  country: string;
  refererHost: string;
  uaCat: string;
  visitor: string;
}

export function buildMetricDataPoint(
  event: MetricEvent,
  opts: { slug?: string; status?: number },
  ctx: MetricContext
) {
  return {
    indexes: [event],
    blobs: [event, opts.slug ?? "", ctx.country, ctx.refererHost, ctx.uaCat, ctx.visitor],
    doubles: opts.status != null ? [1, opts.status] : [1],
  };
}

export async function metricContextFromHeaders(h?: Headers): Promise<MetricContext> {
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
  return { country, refererHost, uaCat, visitor };
}

/** Hash search queries before storing — avoids PII in Analytics Engine. */
export async function hashSearchQuery(query: string): Promise<string> {
  const normalized = query.toLowerCase().trim().slice(0, 500);
  return sha8(`search|${normalized}`);
}

async function sha8(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  const view = new Uint8Array(buf, 0, 8);
  let out = "";
  for (const b of view) out += b.toString(16).padStart(2, "0");
  return out;
}
