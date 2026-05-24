import { z } from "zod";
import { track } from "@/lib/metrics";

export const runtime = "nodejs";

const Body = z.object({
  event: z.enum(["github_click", "page_dwell", "scroll_depth"]),
  slug: z.string().max(64).optional(),
});

const SLUG_RULES: Record<z.infer<typeof Body>["event"], RegExp> = {
  github_click: /^[a-z0-9][a-z0-9._/-]{0,63}$/,
  page_dwell: /^(0-5s|5-15s|15-30s|30-60s|60-300s|300s\+)$/,
  scroll_depth: /^(0|25|50|75|100)$/,
};

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(null, { status: 204 });
  }
  const parsed = Body.safeParse(body);
  if (!parsed.success) return new Response(null, { status: 204 });

  const { event, slug = "" } = parsed.data;
  if (slug && !SLUG_RULES[event].test(slug)) {
    return new Response(null, { status: 204 });
  }

  await track(event, { slug, headers: req.headers });
  return new Response(null, { status: 204 });
}
