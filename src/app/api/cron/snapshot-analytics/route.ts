import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { captureInstallSnapshot } from "@/lib/install-history";
import { safeStringCompare } from "@/lib/admin";
import { logApiError } from "@/lib/observability";

export const runtime = "nodejs";

/**
 * Install-history snapshot cron. Persists each completed day's install count
 * into MARKETPLACE_KV before Cloudflare Analytics Engine's ~90d retention drops
 * it, so the "all-time" total survives. Idempotent + self-healing: backfills the
 * full retained window on first run and catches up after any missed run.
 *
 * OpenNext does not bridge Cloudflare scheduled triggers to Next.js routes
 * (same constraint as /api/cron/optimize-skills), so this is driven by a daily
 * GitHub Actions cron hitting the URL. See .github/workflows/snapshot-analytics.yml.
 *
 * Auth — any of:
 *   - cf-cron-event header (native Cloudflare scheduled trigger, if ever wired)
 *   - Authorization: Bearer <ADMIN_TOKEN>  (CI / manual)
 *   - a logged-in admin session cookie     (manual trigger from the dashboard)
 */
export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}

async function handle(req: Request): Promise<Response> {
  const env = await getEnv();

  const isCronTrigger =
    req.headers.get("cf-cron-event") !== null ||
    req.headers.get("user-agent")?.includes("cron") === true;

  let authed = isCronTrigger;

  if (!authed) {
    const auth = req.headers.get("authorization");
    const bearer = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
    if (bearer && env.ADMIN_TOKEN && (await safeStringCompare(bearer, env.ADMIN_TOKEN))) {
      authed = true;
    }
  }

  if (!authed) {
    const { isAdmin } = await import("@/lib/admin-guard");
    if (!(await isAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await captureInstallSnapshot();
    console.log(JSON.stringify({ level: "info", event: "analytics.snapshot", ...result }));
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logApiError({
      route: "/api/cron/snapshot-analytics",
      status: 500,
      code: "snapshot_failed",
      message: msg,
      headers: req.headers,
    });
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
