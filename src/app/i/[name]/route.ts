import { findApprovedByName } from "@/lib/storage";

export const runtime = "nodejs";

/**
 * Agent-friendly install shortcut: name → SKILL.md.
 *
 *   curl -fsSL https://skillmake.xyz/i/hyperframes \
 *     -o ~/.claude/skills/hyperframes/SKILL.md
 *
 * No id lookup required. We resolve to the latest approved entry sharing that
 * name and stream the markdown back with a sensible filename + content hash
 * header so callers can verify integrity if they want to.
 */

export async function GET(_req: Request, ctx: { params: Promise<{ name: string }> }) {
  const { name } = await ctx.params;
  const entry = await findApprovedByName(name);
  if (!entry) return new Response("Not found", { status: 404 });
  return new Response(entry.markdown, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "content-disposition": `attachment; filename="${entry.skill.name}.skill.md"`,
      // Hash changes if content changes, so caching is safe but we keep it
      // moderate — agents may re-install to pick up curator-approved updates.
      "cache-control": "public, max-age=300, must-revalidate",
      "x-content-hash": entry.contentHash,
      "x-skill-id": entry.id,
    },
  });
}
