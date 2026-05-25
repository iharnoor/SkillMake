import { track } from "./metrics";

export interface ApiLogContext {
  route: string;
  status: number;
  code?: string;
  message?: string;
  headers?: Headers;
}

/** Structured error log for Workers Observability (JSON one-liner). */
export function logApiError(ctx: ApiLogContext): void {
  console.error(
    JSON.stringify({
      level: "error",
      route: ctx.route,
      status: ctx.status,
      ...(ctx.code ? { code: ctx.code } : {}),
      ...(ctx.message ? { message: ctx.message.slice(0, 200) } : {}),
    })
  );
  if (ctx.status >= 400) {
    void track("api_error", {
      slug: apiErrorSlug(ctx.route),
      status: ctx.status,
      headers: ctx.headers,
    });
  }
}

export function logApiWarn(ctx: Omit<ApiLogContext, "status"> & { status?: number }): void {
  console.warn(
    JSON.stringify({
      level: "warn",
      route: ctx.route,
      status: ctx.status ?? 0,
      ...(ctx.code ? { code: ctx.code } : {}),
      ...(ctx.message ? { message: ctx.message.slice(0, 200) } : {}),
    })
  );
}

const TRUSTED_TRACK_HOSTS = new Set([
  "skillmake.xyz",
  "www.skillmake.xyz",
  "localhost",
  "127.0.0.1",
]);

/** Block drive-by POST spam to /api/track; same-origin beacons pass. */
export function isTrustedTrackRequest(req: Request): boolean {
  const secFetchSite = req.headers.get("sec-fetch-site");
  if (secFetchSite === "same-origin") return true;

  const origin = req.headers.get("origin");
  if (origin && isTrustedHost(origin)) return true;

  const referer = req.headers.get("referer");
  if (referer && isTrustedHost(referer)) return true;

  return false;
}

function isTrustedHost(url: string): boolean {
  try {
    return TRUSTED_TRACK_HOSTS.has(new URL(url).host);
  } catch {
    return false;
  }
}

function apiErrorSlug(route: string): string {
  return route.replace(/^\/api\//, "").replace(/\//g, "_") || "unknown";
}
