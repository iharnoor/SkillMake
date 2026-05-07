import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ADMIN_COOKIE, verifySession } from "@/lib/admin";
import { getEnv } from "@/lib/env";

// We use the legacy `middleware.ts` filename (deprecated in Next 16 in favour
// of `proxy.ts`) on purpose: @opennextjs/cloudflare currently rejects
// Node-runtime middleware/proxy and Next 16 forbids declaring `runtime` on
// `proxy.ts`. Legacy `middleware.ts` with `runtime: "edge"` is the only path
// that builds for Cloudflare Workers today. All code below is intentionally
// edge-compatible (Web Crypto only, no node:crypto).

const PUBLIC_PATHS = new Set<string>([
  "/admin/login",
  "/api/admin/login",
  "/api/admin/logout",
]);

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();

  const env = await getEnv();
  if (!env.ADMIN_TOKEN) {
    if (pathname.startsWith("/api/admin/")) {
      return NextResponse.json({ error: "ADMIN_TOKEN not configured" }, { status: 503 });
    }
    return NextResponse.redirect(new URL("/admin/login?reason=unconfigured", req.url));
  }

  const cookie = req.cookies.get(ADMIN_COOKIE)?.value;
  const ok = await verifySession(env.ADMIN_TOKEN, cookie);
  if (ok) return NextResponse.next();

  if (pathname.startsWith("/api/admin/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL("/admin/login", req.url);
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

// Next 16 only accepts "experimental-edge" here; the bare "edge" value errors
// at build time with "the edge runtime for rendering is currently experimental".
export const config = {
  runtime: "experimental-edge",
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
