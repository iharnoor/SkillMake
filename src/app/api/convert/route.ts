import { NextResponse, after } from "next/server";
import { z } from "zod";
import { extractDocs, ExtractError } from "@/lib/extract";
import { convertToSkill } from "@/lib/convert";
import { renderSkillMarkdown } from "@/lib/skill-schema";
import { track } from "@/lib/metrics";
import { logApiError } from "@/lib/observability";

export const runtime = "nodejs";
export const maxDuration = 120;

const BodySchema = z.object({
  url: z.string().url(),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    logApiError({ route: "/api/convert", status: 400, code: "invalid_json", headers: req.headers });
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    logApiError({ route: "/api/convert", status: 400, code: "invalid_url", headers: req.headers });
    return NextResponse.json({ error: "URL required." }, { status: 400 });
  }

  try {
    const extracted = await extractDocs(parsed.data.url);
    const { skill, model } = await convertToSkill(extracted);
    const generatedAt = new Date().toISOString();
    const markdown = renderSkillMarkdown(skill, extracted.finalUrl, generatedAt);
    after(() =>
      track("convert_success", { slug: skill.name, headers: req.headers })
    );
    return NextResponse.json({
      skill,
      markdown,
      sourceUrl: extracted.finalUrl,
      sourceTitle: extracted.title,
      model,
      generatedAt,
    });
  } catch (e) {
    if (e instanceof ExtractError) {
      logApiError({
        route: "/api/convert",
        status: 400,
        code: e.code,
        message: e.message,
        headers: req.headers,
      });
      after(() =>
        track("convert_error", {
          slug: e.code,
          status: 400,
          headers: req.headers,
        })
      );
      return NextResponse.json({ error: e.message, code: e.code }, { status: 400 });
    }
    const msg = e instanceof Error ? e.message : "Conversion failed.";
    const isAuthErr = /api[_ ]?key|unauthorized|401/i.test(msg);
    const status = isAuthErr ? 503 : 500;
    logApiError({
      route: "/api/convert",
      status,
      code: isAuthErr ? "auth" : "internal",
      message: msg,
      headers: req.headers,
    });
    after(() =>
      track("convert_error", {
        slug: isAuthErr ? "auth" : "internal",
        status,
        headers: req.headers,
      })
    );
    return NextResponse.json(
      {
        error: isAuthErr
          ? "AI provider not configured. Set AI_GATEWAY_API_KEY or ANTHROPIC_API_KEY in .env.local."
          : msg,
      },
      { status }
    );
  }
}
