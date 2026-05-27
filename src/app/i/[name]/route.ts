import { after } from "next/server";
import { getCurrentSkillByName } from "@/lib/storage";
import { track } from "@/lib/metrics";
import { encodeVersionedSlug } from "@/lib/metrics-core";

export const runtime = "nodejs";

/**
 * Agent-friendly install shortcut: name → SKILL.md.
 *
 *   curl -fsSL https://skillmake.xyz/i/hyperframes \
 *     -o ~/.claude/skills/hyperframes/SKILL.md
 *
 * No id lookup required. We resolve to the live version via the family
 * pointer (falling back to a name scan for legacy unversioned entries) and
 * stream the markdown back with a sensible filename + content hash header so
 * callers can verify integrity if they want to.
 *
 * SkillOpt: install_hit's blob2 carries `<slug>@<hash8>` so the dynamic
 * validation cron can split installs per version. Dashboards aggregating by
 * slug still work via SPLIT(blob2, '@')[1].
 */

export async function GET(req: Request, ctx: { params: Promise<{ name: string }> }) {
  const { name } = await ctx.params;
  const entry = await getCurrentSkillByName(name);
  if (!entry) return new Response("Not found", { status: 404 });
  const versionedSlug = encodeVersionedSlug(name, entry.contentHash);
  after(() => track("install_hit", { slug: versionedSlug, headers: req.headers }));
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
