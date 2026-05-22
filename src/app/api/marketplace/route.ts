import { NextResponse } from "next/server";
import { z } from "zod";
import { listSkills, saveSkill } from "@/lib/storage";
import {
  SkillSchema,
  renderSkillMarkdown,
  VideoUrl,
  GithubRepoUrl,
  AUDIENCES,
} from "@/lib/skill-schema";
import { findDuplicate } from "@/lib/vector";
import { getInstallAnalytics } from "@/lib/install-analytics";

export const runtime = "nodejs";

export async function GET() {
  const [entries, installAnalytics] = await Promise.all([listSkills(), getInstallAnalytics()]);
  return NextResponse.json({
    entries: entries.map((e) => {
      const installSummary = installAnalytics.summaries.get(e.skill.name);
      return {
        id: e.id,
        name: e.skill.name,
        description: e.skill.description,
        category: e.skill.category,
        audience: e.skill.audience,
        videoUrls: e.skill.videoUrls,
        repoUrl: e.skill.repoUrl ?? null,
        stars: e.stars ?? null,
        installs: installAnalytics.available ? installSummary?.installs ?? 0 : null,
        installTrend: installAnalytics.available ? installSummary?.trend ?? zeroTrend() : null,
        sourceUrl: e.sourceUrl,
        contentHash: e.contentHash,
        createdAt: e.createdAt,
      };
    }),
  });
}

function zeroTrend(): number[] {
  return Array.from({ length: 8 }, () => 0);
}

const PublishBody = z.object({
  skill: SkillSchema,
  sourceUrl: z.string().url(),
  model: z.string().min(1).max(120),
  generatedAt: z.string(),
  force: z.boolean().optional(),
  videoUrls: z.array(VideoUrl).max(6).optional(),
  audience: z.enum(AUDIENCES).optional(),
  repoUrl: GithubRepoUrl.optional(),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = PublishBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid skill payload" }, { status: 400 });
  }
  const { sourceUrl, model, generatedAt, force, videoUrls, audience, repoUrl } = parsed.data;
  // Overlay creator-supplied attachments onto the model-generated skill.
  const skill = {
    ...parsed.data.skill,
    videoUrls: videoUrls ?? parsed.data.skill.videoUrls,
    audience: audience ?? parsed.data.skill.audience,
    repoUrl: repoUrl ?? parsed.data.skill.repoUrl,
  };

  if (!force) {
    try {
      const dup = await findDuplicate(skill);
      if (dup) {
        return NextResponse.json(
          {
            warning: "duplicate",
            duplicate: dup,
            message:
              "A semantically similar skill already exists. Inspect it, or re-publish with force=true to override.",
          },
          { status: 409 }
        );
      }
    } catch {
      // dedup is best-effort; continue if HydraDB is down or unconfigured
    }
  }

  const markdown = renderSkillMarkdown(skill, sourceUrl, generatedAt);
  // status defaults to "pending" — vetting endpoints flip it to "approved" later.
  // HydraDB indexing happens at approval time, not here, so the search index never includes unreviewed skills.
  const entry = await saveSkill({ skill, sourceUrl, markdown, model });

  return NextResponse.json({
    id: entry.id,
    contentHash: entry.contentHash,
    status: entry.status,
  });
}
