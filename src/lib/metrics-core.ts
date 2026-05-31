export type MetricEvent =
  | "install_hit"
  | "marketplace_view"
  | "home_view"
  | "skill_submission_started"
  | "skill_submitted"
  | "convert_success"
  | "convert_error"
  | "tricks_view"
  | "mcps_view"
  | "powerhouse_view"
  | "search_submitted"
  | "github_click"
  | "page_dwell"
  | "scroll_depth"
  | "skill_added"
  | "skill_submission_rejected"
  | "skill_version_promoted"
  | "api_error";

export interface MetricContext {
  country: string;
  refererHost: string;
  uaCat: string;
  visitor: string;
}

export function buildMetricDataPoint(
  event: MetricEvent,
  opts: { slug?: string; status?: number; audience?: string; category?: string },
  ctx: MetricContext
) {
  const blobs: string[] = [
    event,
    opts.slug ?? "",
    ctx.country,
    ctx.refererHost,
    ctx.uaCat,
    ctx.visitor,
  ];
  // Catalog lifecycle events carry the
  // skill's audience + category so dashboards can slice "MCPs added" vs
  // other added skills without re-joining against storage.
  if (opts.audience != null || opts.category != null) {
    blobs.push(opts.audience ?? "", opts.category ?? "");
  }
  return {
    indexes: [event],
    blobs,
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

/**
 * SkillOpt slug encoding for install_hit (and any per-version event):
 *
 *   blob2 = `<skill-name>@<contentHash[:8]>`
 *
 * The Analytics Engine schema is unchanged; the version is encoded inside
 * blob2 by convention. Old slug-only dashboards still work via
 * `SPLIT(blob2, '@')[1]` (the part before the @). Per-version dashboards
 * read both sides.
 */
export function encodeVersionedSlug(name: string, contentHash: string): string {
  return `${name}@${contentHash.slice(0, 8)}`;
}

/**
 * Inverse of encodeVersionedSlug. Returns the bare name when no `@` is
 * present so legacy install_hit rows (written before versioning landed) are
 * still attributable to their skill.
 */
export function parseVersionedSlug(slug: string): { name: string; versionHash: string | null } {
  const at = slug.indexOf("@");
  if (at < 0) return { name: slug, versionHash: null };
  return { name: slug.slice(0, at), versionHash: slug.slice(at + 1) };
}

async function sha8(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  const view = new Uint8Array(buf, 0, 8);
  let out = "";
  for (const b of view) out += b.toString(16).padStart(2, "0");
  return out;
}
