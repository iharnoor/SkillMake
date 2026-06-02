import { NextResponse, after } from "next/server";
import { z } from "zod";
import { listSkills } from "@/lib/storage";
import { searchSkills } from "@/lib/vector";
import type { Audience } from "@/lib/skill-schema";
import { track, hashSearchQuery } from "@/lib/metrics";
import { logApiError } from "@/lib/observability";

export const runtime = "nodejs";

const Body = z.object({
  query: z.string().min(1).max(500),
  max: z.number().int().min(1).max(20).optional(),
});

type SearchCategory =
  | "framework"
  | "library"
  | "api"
  | "platform"
  | "tool"
  | "language"
  | "concept"
  | "job-search"
  | "prompt-pack"
  | "other";

interface BaseResult {
  id: string;
  name: string;
  description: string;
  category: SearchCategory;
  audience: Audience;
  videoUrls: string[];
  score: number;
}
type SearchResult = BaseResult & { mode: "semantic" | "fallback" };

function toResult(
  e: Awaited<ReturnType<typeof listSkills>>[number],
  score: number,
  mode: SearchResult["mode"]
): SearchResult {
  return {
    id: e.id,
    name: e.skill.name,
    description: e.skill.description,
    category: e.skill.category,
    audience: e.skill.audience,
    videoUrls: e.skill.videoUrls,
    score,
    mode,
  };
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    logApiError({ route: "/api/search", status: 400, code: "invalid_json", headers: req.headers });
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    logApiError({ route: "/api/search", status: 400, code: "invalid_query", headers: req.headers });
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }
  const { query, max = 10 } = parsed.data;

  after(async () =>
    track("search_submitted", {
      slug: await hashSearchQuery(query),
      headers: req.headers,
    })
  );

  try {
    const [all, hits] = await Promise.all([listSkills(), searchSkills(query, max)]);
    if (hits) {
      const approvedById = new Map(all.map((e) => [e.id, e]));
      return NextResponse.json({
        mode: "semantic",
        results: hits
          .map((h) => {
            // Approved list ensures rejected/pending skills never leak via search,
            // even if HydraDB still has stale records for them.
            const e = approvedById.get(h.id);
            return e ? toResult(e, h.score, "semantic") : null;
          })
          .filter((r): r is SearchResult => r !== null),
      });
    }

    // Fallback: substring scan over already-approved-only list.
    const q = query.toLowerCase();
    const scored = all
      .map((e) => {
        const haystack = `${e.skill.name} ${e.skill.description} ${e.skill.whenToUse.join(" ")}`.toLowerCase();
        const score = haystack.includes(q) ? 0.5 : 0;
        return { e, score };
      })
      .filter((x) => x.score > 0)
      .slice(0, max);
    return NextResponse.json({
      mode: "fallback",
      results: scored.map((x) => toResult(x.e, x.score, "fallback")),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Search failed.";
    logApiError({
      route: "/api/search",
      status: 500,
      code: "search_failed",
      message: msg,
      headers: req.headers,
    });
    return NextResponse.json({ error: "Search failed." }, { status: 500 });
  }
}
