import { NextResponse } from "next/server";
import { z } from "zod";
import { listSkills, getApprovedSkill } from "@/lib/storage";
import { searchSkills } from "@/lib/vector";
import type { Audience } from "@/lib/skill-schema";

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

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = Body.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  const { query, max = 10 } = parsed.data;

  const hits = await searchSkills(query, max);
  if (hits) {
    const detailed: (SearchResult | null)[] = await Promise.all(
      hits.map(async (h): Promise<SearchResult | null> => {
        // getApprovedSkill ensures rejected/pending skills never leak via search,
        // even if HydraDB still has stale records for them.
        const e = await getApprovedSkill(h.id);
        if (!e) return null;
        return {
          id: e.id,
          name: e.skill.name,
          description: e.skill.description,
          category: e.skill.category,
          audience: e.skill.audience,
          videoUrls: e.skill.videoUrls,
          score: h.score,
          mode: "semantic",
        };
      })
    );
    return NextResponse.json({
      mode: "semantic",
      results: detailed.filter((r): r is SearchResult => r !== null),
    });
  }

  // Fallback: substring scan over already-approved-only list.
  const all = await listSkills();
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
    results: scored.map((x) => ({
      id: x.e.id,
      name: x.e.skill.name,
      description: x.e.skill.description,
      category: x.e.skill.category,
      audience: x.e.skill.audience,
      videoUrls: x.e.skill.videoUrls,
      score: x.score,
      mode: "fallback" as const,
    })),
  });
}
