import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin } from "@/lib/admin-guard";
import { getSkill, saveSkillVersion } from "@/lib/storage";
import { renderSkillMarkdown } from "@/lib/skill-schema";
import { SkillEditsPayload, applyEdits, ApplyError } from "@/lib/skill-edit";
import { validateCandidate } from "@/lib/skill-validator";
import { logApiError } from "@/lib/observability";

export const runtime = "nodejs";

/**
 * SkillOpt bounded-edit endpoint.
 *
 * POST /api/admin/skills/<id>/edit
 *   body: { edits: SkillEdit[], abTrafficShare?: number, force?: boolean }
 *
 * Applies up to MAX_EDITS_PER_STEP (8) atomic edits to the current version,
 * runs them through the static validator, and saves the result as a
 * candidate. The candidate enters the A/B funnel at the given traffic share
 * (default 0.2). The dynamic cron in Phase 3 promotes it to current once the
 * conversion gate accepts.
 *
 * force=true bypasses validator failures but still records the reasons in the
 * response so the curator's override is auditable.
 *
 * Distinct from /update (the legacy whole-body replacement), which stays as a
 * curator escape hatch for rewrites that don't fit the edit budget.
 */

const Body = z.object({
  edits: SkillEditsPayload,
  abTrafficShare: z.number().min(0).max(1).optional(),
  force: z.boolean().optional(),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    logApiError({ route: "/api/admin/skills/edit", status: 400, code: "invalid_json", headers: req.headers });
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    logApiError({
      route: "/api/admin/skills/edit",
      status: 400,
      code: "invalid_payload",
      headers: req.headers,
    });
    return NextResponse.json(
      { error: "Invalid edit payload", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const parent = await getSkill(id);
  if (!parent) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let candidateSkill;
  try {
    candidateSkill = applyEdits(parent.skill, parsed.data.edits);
  } catch (e) {
    if (e instanceof ApplyError) {
      return NextResponse.json(
        { error: e.message, editIndex: e.editIndex, op: e.op },
        { status: 400 }
      );
    }
    throw e;
  }

  const generatedAt = new Date().toISOString();
  const markdown = renderSkillMarkdown(candidateSkill, parent.sourceUrl, generatedAt);

  const validation = validateCandidate({
    parent: { skill: parent.skill, markdown: parent.markdown },
    candidate: { skill: candidateSkill, markdown },
    edits: parsed.data.edits,
  });

  if (!validation.pass && !parsed.data.force) {
    return NextResponse.json(
      {
        error: "Validator rejected the candidate. Pass force=true to override.",
        reasons: validation.reasons,
        warnings: validation.warnings,
        tokenCount: validation.tokenCount,
      },
      { status: 422 }
    );
  }

  const saved = await saveSkillVersion(parent, parsed.data.edits, {
    skill: candidateSkill,
    markdown,
    model: parent.model,
    sourceUrl: parent.sourceUrl,
    abTrafficShare: parsed.data.abTrafficShare,
  });

  return NextResponse.json({
    ok: true,
    id: saved.id,
    versionId: saved.versionId,
    contentHash: saved.contentHash,
    abTrafficShare: saved.abTrafficShare,
    forced: !validation.pass && parsed.data.force === true,
    validation: {
      pass: validation.pass,
      reasons: validation.reasons,
      warnings: validation.warnings,
      tokenCount: validation.tokenCount,
    },
  });
}
