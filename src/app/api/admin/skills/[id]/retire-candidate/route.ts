import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-guard";
import { getSkill, retireCandidate } from "@/lib/storage";
import { logApiError } from "@/lib/observability";

export const runtime = "nodejs";

/**
 * Curator override: retire the active candidate for a skill without promoting
 * it. The candidate row stays in KV (queryable for audit / negative-feedback
 * reuse by the optimizer), the family:<name>:candidate pointer is cleared.
 *
 * POST /api/admin/skills/<id>/retire-candidate
 */

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const entry = await getSkill(id);
  if (!entry) {
    logApiError({ route: "/api/admin/skills/retire-candidate", status: 404, code: "not_found", headers: req.headers });
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const retired = await retireCandidate(entry.skill.name);
  if (!retired) {
    return NextResponse.json(
      { error: "No active candidate to retire for skill " + entry.skill.name },
      { status: 409 }
    );
  }
  return NextResponse.json({
    ok: true,
    retired: { id: retired.id, versionId: retired.versionId, contentHash: retired.contentHash },
  });
}
