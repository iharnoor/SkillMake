import { NextResponse } from "next/server";
import { listSkills, type MarketplaceEntry } from "@/lib/storage";
import { optimizeSkill, isEligibleForOptimization } from "@/lib/skill-optimizer";
import { getEnv } from "@/lib/env";
import { logApiError } from "@/lib/observability";

export const runtime = "nodejs";
export const maxDuration = 300; // optimizer cron may iterate many skills

/**
 * Autonomous SkillOpt cron. Runs weekly (see wrangler.jsonc triggers.crons).
 *
 * Iterates approved skills, skips any optimized within the last 28 days, runs
 * the full optimize pipeline (telemetry → propose → validate → promote).
 * Bounded to MAX_PER_RUN to keep wall-clock + Anthropic spend predictable.
 *
 * Gates:
 *   - SKILLOPT_AUTONOMOUS=true must be set; default off
 *   - Anthropic and Cloudflare Analytics tokens must be present
 *   - Cloudflare invokes this with the scheduled-trigger user agent;
 *     a curl from the open web won't run (cf-cron-event header check)
 *
 * Returns a compact JSON summary so the curator can inspect what the run
 * actually did. The Worker logs include per-skill detail.
 */

const MAX_PER_RUN = 8;

interface RunSummary {
  ranAt: string;
  enabled: boolean;
  considered: number;
  attempted: number;
  promoted: string[];
  rejected: { name: string; reason: string }[];
  noTelemetry: string[];
  failed: { name: string; reason: string }[];
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}

async function handle(req: Request): Promise<Response> {
  const env = await getEnv();
  const enabled = env.SKILLOPT_AUTONOMOUS === "true";
  const ranAt = new Date().toISOString();

  if (!enabled) {
    return NextResponse.json({
      ranAt,
      enabled: false,
      considered: 0,
      attempted: 0,
      promoted: [],
      rejected: [],
      noTelemetry: [],
      failed: [],
      message: "SKILLOPT_AUTONOMOUS != 'true' — set the env var to enable the cron",
    });
  }

  // Require either a Cloudflare cron header (production) or admin auth (manual
  // trigger). Public unauthenticated requests do not run the optimizer.
  const isCronTrigger = req.headers.get("cf-cron-event") !== null
    || req.headers.get("user-agent")?.includes("cron") === true;
  if (!isCronTrigger) {
    const { isAdmin } = await import("@/lib/admin-guard");
    if (!(await isAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const all = await listSkills();
  const eligible: MarketplaceEntry[] = [];
  for (const e of all) {
    if (isEligibleForOptimization(e)) eligible.push(e);
  }

  const summary: RunSummary = {
    ranAt,
    enabled: true,
    considered: all.length,
    attempted: 0,
    promoted: [],
    rejected: [],
    noTelemetry: [],
    failed: [],
  };

  // Take the N oldest-optimized skills first so the workload distributes
  // across runs over time.
  eligible.sort((a, b) =>
    (a.lastOptimizedAt ?? "").localeCompare(b.lastOptimizedAt ?? "")
  );

  const batch = eligible.slice(0, MAX_PER_RUN);

  for (const entry of batch) {
    summary.attempted += 1;
    try {
      const result = await optimizeSkill(entry, { source: "cron" });
      switch (result.status) {
        case "promoted":
          summary.promoted.push(entry.skill.name);
          console.log(JSON.stringify({
            level: "info",
            event: "skillopt.promoted",
            skill: entry.skill.name,
            from: entry.contentHash,
            to: result.promoted?.contentHash,
            tokenCount: result.validation?.tokenCount,
            edits: result.proposedEdits?.length,
          }));
          break;
        case "no_telemetry":
          summary.noTelemetry.push(entry.skill.name);
          break;
        case "rejected_by_gate":
          summary.rejected.push({ name: entry.skill.name, reason: result.reason ?? "unknown" });
          console.warn(JSON.stringify({
            level: "warn",
            event: "skillopt.rejected_by_gate",
            skill: entry.skill.name,
            reasons: result.validation?.reasons,
            warnings: result.validation?.warnings,
          }));
          break;
        case "no_edits_proposed":
        case "apply_failed":
          summary.failed.push({ name: entry.skill.name, reason: result.reason ?? result.status });
          break;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      summary.failed.push({ name: entry.skill.name, reason: msg });
      logApiError({
        route: "/api/cron/optimize-skills",
        status: 500,
        code: "optimize_failed",
        message: `${entry.skill.name}: ${msg}`,
        headers: req.headers,
      });
    }
  }

  return NextResponse.json(summary);
}
