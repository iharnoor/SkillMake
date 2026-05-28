import { NextResponse } from "next/server";
import { after } from "next/server";
import { isAdmin } from "@/lib/admin-guard";
import { setSkillStars, setSkillStatus } from "@/lib/storage";
import { indexSkill } from "@/lib/vector";
import { fetchRepoStars } from "@/lib/github";
import { track } from "@/lib/metrics";

export const runtime = "nodejs";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const approved = await setSkillStatus(id, "approved");
  if (!approved) return NextResponse.json({ error: "Not found" }, { status: 404 });

  after(() =>
    track("skill_approved", {
      slug: approved.skill.name,
      audience: approved.skill.audience,
      category: approved.skill.category,
      headers: req.headers,
    })
  );

  // Indexing is the side-effect that flips this skill into search results.
  // If HydraDB is unreachable we still return ok — search just degrades to
  // substring fallback, and the next approval (or a manual reindex) recovers.
  let indexed = false;
  try {
    indexed = (await indexSkill(approved.id, approved.skill)).indexed;
  } catch {
    // intentional: see comment above
  }

  // Star fetch is best-effort. Approval shouldn't fail because GitHub is down
  // or rate-limiting us; null just means "stars unknown" in the UI.
  let stars: number | null = null;
  if (approved.skill.repoUrl) {
    try {
      stars = await fetchRepoStars(approved.skill.repoUrl);
      if (stars != null) await setSkillStars(approved.id, stars);
    } catch {
      // intentional: see comment above
    }
  }

  return NextResponse.json({
    ok: true,
    id: approved.id,
    status: approved.status,
    indexed,
    stars,
  });
}
