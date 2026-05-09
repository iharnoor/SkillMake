import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin } from "@/lib/admin-guard";
import { getSkill, setSkillStars, updateEntry } from "@/lib/storage";
import { SkillSchema, renderSkillMarkdown } from "@/lib/skill-schema";
import { fetchRepoStars } from "@/lib/github";
import { indexSkill } from "@/lib/vector";

export const runtime = "nodejs";

/**
 * Curator-only: replace an existing entry's skill body in place.
 *
 * Use to edit a curator-authored seed after it's already approved — new
 * gotchas, tightened wording, FAL_KEY-required notices — without delete +
 * re-seed (which would mint a new id and break the install URL).
 *
 * The id, sourceUrl, createdAt, contentHash and model fields stay frozen.
 * The skill body is overwritten, markdown is re-rendered with the original
 * createdAt so the YAML `generated:` timestamp is preserved, and the entry
 * is re-indexed in HydraDB. Star count is refreshed if the new repoUrl differs.
 */

const Body = z.object({
  skill: SkillSchema,
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid skill payload", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const entry = await getSkill(id);
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (parsed.data.skill.name !== entry.skill.name) {
    return NextResponse.json(
      { error: "skill.name is frozen — refusing to rename in place" },
      { status: 400 }
    );
  }

  const updated = {
    ...entry,
    skill: parsed.data.skill,
  };
  updated.markdown = renderSkillMarkdown(updated.skill, updated.sourceUrl, updated.createdAt);
  await updateEntry(updated);

  let indexed = false;
  try {
    indexed = (await indexSkill(updated.id, updated.skill)).indexed;
  } catch {
    // best-effort
  }

  let stars: number | null = null;
  if (updated.skill.repoUrl) {
    try {
      stars = await fetchRepoStars(updated.skill.repoUrl);
      if (stars != null) await setSkillStars(updated.id, stars);
    } catch {
      // best-effort
    }
  }

  return NextResponse.json({
    ok: true,
    id: updated.id,
    indexed,
    stars,
  });
}
