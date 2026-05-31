import { NextResponse, after } from "next/server";
import { z } from "zod";
import { isAdmin } from "@/lib/admin-guard";
import { saveSkill, setSkillStars } from "@/lib/storage";
import { SkillSchema, renderSkillMarkdown } from "@/lib/skill-schema";
import { fetchRepoStars } from "@/lib/github";
import { indexSkill } from "@/lib/vector";
import { track } from "@/lib/metrics";

export const runtime = "nodejs";

/**
 * Curator-authored seed path. Bypasses the AI extraction pipeline and the
 * pending-review queue: the body IS the final skill, and it lands as approved.
 *
 * Use this for hand-written skills (workflow knowledge, multi-tool patterns)
 * where there is no single docs URL to scrape from. Anything submitted by
 * non-curators must still go through /api/marketplace + /admin review.
 */

const SeedBody = z.object({
  skill: SkillSchema,
  sourceUrl: z.string().url(),
  model: z.string().min(1).max(120).optional(),
});

export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = SeedBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid skill payload", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const { skill, sourceUrl, model = "manual" } = parsed.data;
  const generatedAt = new Date().toISOString();
  const markdown = renderSkillMarkdown(skill, sourceUrl, generatedAt);

  const entry = await saveSkill({
    skill,
    sourceUrl,
    markdown,
    model,
    status: "approved",
  });
  after(() =>
    track("skill_added", {
      slug: entry.skill.name,
      audience: entry.skill.audience,
      category: entry.skill.category,
      headers: req.headers,
    })
  );

  // Index + star fetch are best-effort; same rationale as in /approve.
  let indexed = false;
  try {
    indexed = (await indexSkill(entry.id, entry.skill)).indexed;
  } catch {
    // intentional
  }

  let stars: number | null = null;
  if (entry.skill.repoUrl) {
    try {
      stars = await fetchRepoStars(entry.skill.repoUrl);
      if (stars != null) await setSkillStars(entry.id, stars);
    } catch {
      // intentional
    }
  }

  return NextResponse.json({
    ok: true,
    id: entry.id,
    contentHash: entry.contentHash,
    status: entry.status,
    indexed,
    stars,
  });
}
