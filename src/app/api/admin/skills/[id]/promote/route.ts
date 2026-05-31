import { NextResponse } from "next/server";
import { after } from "next/server";
import { isAdmin } from "@/lib/admin-guard";
import { getSkill, promoteCandidate } from "@/lib/storage";
import { logApiError } from "@/lib/observability";
import { track } from "@/lib/metrics";

export const runtime = "nodejs";

/**
 * Curator override: promote the active candidate for a skill to current.
 *
 * POST /api/admin/skills/<id>/promote
 *   (the id can belong to either the current or the candidate — we resolve
 *    by skill.name and flip whichever candidate exists in that family)
 *
 * The dynamic validation cron normally promotes automatically once the
 * conversion gate accepts. This endpoint exists for two paths:
 *   - low-traffic skills that never reach the 200-install threshold and
 *     fall back to skill-judge but a curator wants to ship anyway
 *   - emergency override when telemetry is clearly favorable and the cron
 *     hasn't caught up
 *
 * Either way the action lands in the audit log alongside cron promotions.
 */

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const entry = await getSkill(id);
  if (!entry) {
    logApiError({ route: "/api/admin/skills/promote", status: 404, code: "not_found", headers: req.headers });
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const result = await promoteCandidate(entry.skill.name);
  if (!result) {
    return NextResponse.json(
      { error: "No active candidate to promote for skill " + entry.skill.name },
      { status: 409 }
    );
  }
  after(() =>
    track("skill_version_promoted", {
      slug: result.promoted.skill.name,
      audience: result.promoted.skill.audience,
      category: result.promoted.skill.category,
      headers: req.headers,
    })
  );

  return NextResponse.json({
    ok: true,
    promoted: { id: result.promoted.id, versionId: result.promoted.versionId },
    retired: result.retired ? { id: result.retired.id, versionId: result.retired.versionId } : null,
  });
}
