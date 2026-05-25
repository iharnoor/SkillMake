import { NextResponse, after } from "next/server";
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
import { track } from "@/lib/metrics";
import { logApiError } from "@/lib/observability";

export const runtime = "nodejs";

export async function GET() {
  const entries = await listSkills();
  return NextResponse.json({
    entries: entries.map((e) => ({
      id: e.id,
      name: e.skill.name,
      description: e.skill.description,
      category: e.skill.category,
      audience: e.skill.audience,
      videoUrls: e.skill.videoUrls,
      repoUrl: e.skill.repoUrl ?? null,
      stars: e.stars ?? null,
      sourceUrl: e.sourceUrl,
      contentHash: e.contentHash,
      createdAt: e.createdAt,
    })),
  });
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
    logApiError({ route: "/api/marketplace", status: 400, code: "invalid_json", headers: req.headers });
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = PublishBody.safeParse(body);
  if (!parsed.success) {
    logApiError({
      route: "/api/marketplace",
      status: 400,
      code: "invalid_payload",
      headers: req.headers,
    });
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

  try {
    const markdown = renderSkillMarkdown(skill, sourceUrl, generatedAt);
    // status defaults to "pending" — vetting endpoints flip it to "approved" later.
    // HydraDB indexing happens at approval time, not here, so the search index never includes unreviewed skills.
    const entry = await saveSkill({ skill, sourceUrl, markdown, model });
    after(() =>
      track("submit_completed", { slug: entry.skill.name, headers: req.headers })
    );
    return NextResponse.json({
      id: entry.id,
      contentHash: entry.contentHash,
      status: entry.status,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Save failed.";
    logApiError({
      route: "/api/marketplace",
      status: 500,
      code: "save_failed",
      message: msg,
      headers: req.headers,
    });
    return NextResponse.json({ error: "Submission failed." }, { status: 500 });
  }
}
