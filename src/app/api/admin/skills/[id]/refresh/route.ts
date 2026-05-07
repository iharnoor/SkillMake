import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin } from "@/lib/admin-guard";
import { getSkill, setSkillStars, updateEntry } from "@/lib/storage";
import { GithubRepoUrl, VideoUrl, renderSkillMarkdown } from "@/lib/skill-schema";
import { fetchRepoStars } from "@/lib/github";

export const runtime = "nodejs";

/**
 * Curator-only: optionally update an entry's repoUrl, then re-fetch the
 * GitHub star count. Lets you backfill stars onto existing approved skills
 * without re-running the whole submit pipeline.
 *
 * If repoUrl is supplied, the skill markdown is *not* re-rendered (would
 * change contentHash and break the install URL). Stars are stored as entry
 * metadata, separate from the skill body.
 */

const Body = z
  .object({
    repoUrl: GithubRepoUrl.optional(),
    videoUrls: z.array(VideoUrl).max(6).optional(),
  })
  .optional();

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    // empty body is fine — caller may just want to refetch existing repoUrl
  }
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const entry = await getSkill(id);
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // If repoUrl or videoUrls is provided, write through. We re-render markdown
  // so YAML frontmatter + Tutorials section stay in sync — id stays stable
  // (it's frozen at creation), but contentHash isn't recomputed: the hash badge
  // is informational and changing it would invalidate any link to
  // /api/marketplace/<id>/raw cached upstream.
  const repoChanged =
    parsed.data?.repoUrl !== undefined && parsed.data.repoUrl !== entry.skill.repoUrl;
  const videosChanged = parsed.data?.videoUrls !== undefined;
  if (repoChanged || videosChanged) {
    const updated = {
      ...entry,
      skill: {
        ...entry.skill,
        ...(repoChanged ? { repoUrl: parsed.data!.repoUrl } : {}),
        ...(videosChanged ? { videoUrls: parsed.data!.videoUrls! } : {}),
      },
    };
    updated.markdown = renderSkillMarkdown(updated.skill, updated.sourceUrl, updated.createdAt);
    await updateEntry(updated);
    if (repoChanged) entry.skill.repoUrl = parsed.data!.repoUrl;
    if (videosChanged) entry.skill.videoUrls = parsed.data!.videoUrls!;
  }

  let stars: number | null = null;
  if (entry.skill.repoUrl) {
    try {
      stars = await fetchRepoStars(entry.skill.repoUrl);
      if (stars != null) await setSkillStars(entry.id, stars);
    } catch {
      // best-effort
    }
  }

  return NextResponse.json({
    ok: true,
    id: entry.id,
    repoUrl: entry.skill.repoUrl ?? null,
    videoUrls: entry.skill.videoUrls,
    stars,
  });
}
