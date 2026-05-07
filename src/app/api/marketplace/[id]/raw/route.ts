import { getApprovedSkill } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const entry = await getApprovedSkill(id);
  if (!entry) return new Response("Not found", { status: 404 });
  return new Response(entry.markdown, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "content-disposition": `attachment; filename="${entry.skill.name}.skill.md"`,
      "cache-control": "public, max-age=31536000, immutable",
      "x-content-hash": entry.contentHash,
    },
  });
}
