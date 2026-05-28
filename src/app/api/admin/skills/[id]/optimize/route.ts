import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin } from "@/lib/admin-guard";
import { getSkill } from "@/lib/storage";
import { optimizeSkill } from "@/lib/skill-optimizer";
import { logApiError } from "@/lib/observability";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * Manual one-shot optimizer trigger. Useful for curator-driven runs ("optimize
 * caveman now") and for piloting the cron behavior against a single skill
 * before flipping SKILLOPT_AUTONOMOUS=true globally.
 *
 * POST /api/admin/skills/<id>/optimize
 *   body (optional): { allowZeroTelemetry?: boolean, modelId?: string }
 *
 * Unlike the cron, this bypasses the 28-day cooldown — curators can iterate
 * fast during piloting. Each run still goes through the static gate.
 */

const Body = z.object({
  allowZeroTelemetry: z.boolean().optional(),
  modelId: z.string().optional(),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;

  let body: unknown = {};
  if (req.headers.get("content-length") !== "0") {
    try {
      body = await req.json();
    } catch {
      // empty body is fine
    }
  }
  const parsed = Body.safeParse(body);
  const options = parsed.success ? parsed.data : {};

  const entry = await getSkill(id);
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const result = await optimizeSkill(entry, {
      source: "admin-manual",
      allowZeroTelemetry: options.allowZeroTelemetry ?? true, // manual runs default permissive
      modelId: options.modelId,
    });

    return NextResponse.json({
      ok: true,
      skill: entry.skill.name,
      result: {
        status: result.status,
        reason: result.reason ?? null,
        proposedEditCount: result.proposedEdits?.length ?? 0,
        proposedEdits: result.proposedEdits,
        validation: result.validation,
        promoted: result.promoted
          ? {
              id: result.promoted.id,
              versionId: result.promoted.versionId,
              contentHash: result.promoted.contentHash,
              tokenCount: result.validation?.tokenCount,
            }
          : null,
        retired: result.retired
          ? { id: result.retired.id, versionId: result.retired.versionId }
          : null,
        telemetry: result.telemetry,
        modelId: result.modelId,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logApiError({
      route: "/api/admin/skills/optimize",
      status: 500,
      code: "optimize_failed",
      message: msg,
      headers: req.headers,
    });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
