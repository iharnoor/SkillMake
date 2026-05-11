import Link from "next/link";
import { after } from "next/server";
import { headers } from "next/headers";
import { listSkills } from "@/lib/storage";
import { MarketplaceSearch } from "@/components/MarketplaceSearch";
import { AUDIENCES, type Audience } from "@/lib/skill-schema";
import { formatStars } from "@/lib/github";
import { GithubIcon } from "@/components/GithubIcon";
import { track } from "@/lib/metrics";

export const dynamic = "force-dynamic";

const LIVE_AUDIENCES: Audience[] = ["creators"];

const ASCII = String.raw` ____  _    _ _ _                 _
/ ___|| | _(_) | |_ __ ___   __ _| | _____
\___ \| |/ / | | | '_ \` _ \ / _\` | |/ / _ \
 ___) |   <| | | | | | | | | (_| |   <  __/
|____/|_|\_\_|_|_|_| |_| |_|\__,_|_|\_\___|`;

export default async function Home() {
  // Read headers BEFORE `after()` — request-time APIs can't be called inside
  // an after() callback from a Server Component.
  const h = await headers();
  after(() => track("home_view", { headers: h }));

  const all = await listSkills();
  // Sort by ★ stars desc, ties and starless skills fall back to createdAt desc.
  // Starless entries (workflow skills, no canonical repo) end up at the bottom
  // of the list. Same primary signal as deepwiki/skills.sh.
  const entries = [...all].sort((a, b) => {
    const sa = a.stars ?? -1;
    const sb = b.stars ?? -1;
    if (sb !== sa) return sb - sa;
    return b.createdAt.localeCompare(a.createdAt);
  });

  return (
    <div className="max-w-5xl mx-auto px-6 pt-12 pb-24">
      {/* Hero — ASCII title + a single-sentence pitch + one primary CTA. */}
      <pre className="mono text-[10px] leading-[1.15] text-[color:var(--fg)] whitespace-pre overflow-x-auto select-none">
        {ASCII}
      </pre>

      <div className="mt-7 flex items-end justify-between gap-6 flex-wrap">
        <p className="text-[color:var(--fg-muted)] max-w-xl text-[15px] leading-relaxed">
          A curated marketplace of agent-installable{" "}
          <span className="mono text-[color:var(--fg)]">SKILL.md</span> files. Every one personally
          reviewed before it goes live.
        </p>
        <Link
          href="/submit"
          className="btn-accent rounded-md px-5 py-2.5 text-sm whitespace-nowrap"
        >
          + Submit a skill
        </Link>
      </div>

      <div className="mt-5 mono text-[11.5px] text-[color:var(--fg-dim)] whitespace-pre-wrap break-all">
        <span className="text-[color:var(--fg-muted)]">install · </span>
        curl --create-dirs -fsSL skillmake.xyz/i/&lt;name&gt; -o ~/.claude/skills/&lt;name&gt;/SKILL.md
      </div>

      {/* Filter row + count, separated only by a hairline. */}
      <div className="mt-14 flex items-baseline justify-between gap-4 flex-wrap border-b border-[color:var(--border)] pb-3">
        <div className="flex items-center gap-5 mono text-[12px]">
          <span className="text-[color:var(--fg)]">all</span>
          {AUDIENCES.filter((a) => a !== "general").map((a) => {
            const live = LIVE_AUDIENCES.includes(a);
            return (
              <span
                key={a}
                className={
                  live
                    ? "text-[color:var(--accent)]"
                    : "text-[color:var(--fg-dim)]"
                }
                title={live ? "" : "coming soon"}
              >
                {a}
                {!live && <span className="text-[10px] ml-1 opacity-60">·soon</span>}
              </span>
            );
          })}
        </div>
        <span className="mono text-[11px] text-[color:var(--fg-dim)] tabular-nums">
          {entries.length} approved
        </span>
      </div>

      <div className="mt-4">
        <MarketplaceSearch />
      </div>

      {entries.length === 0 ? (
        <div className="mono text-[12px] text-[color:var(--fg-dim)] mt-12">
          // no skills yet. Be the first —{" "}
          <Link href="/submit" className="text-[color:var(--accent)]">submit one</Link>.
        </div>
      ) : (
        <div className="mt-6">
          <div className="grid grid-cols-[2.5ch_1fr_1fr_8ch] gap-x-6 mono text-[10px] uppercase tracking-[0.2em] text-[color:var(--fg-dim)] pb-2 border-b border-[color:var(--border)]">
            <span className="text-right">#</span>
            <span>name</span>
            <span>source</span>
            <span className="text-right">github</span>
          </div>
          {entries.map((e, i) => (
            <div
              key={e.id}
              className="grid grid-cols-[2.5ch_1fr_1fr_8ch] gap-x-6 py-3 border-b border-[color:var(--border)] hover:bg-[color:var(--bg-elevated)]/50 transition group"
            >
              <span className="mono text-[12px] text-[color:var(--fg-dim)] tabular-nums text-right self-start mt-1">
                {i + 1}
              </span>
              <Link href={`/marketplace/${e.id}`} className="min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="mono text-[14px] text-[color:var(--fg)] group-hover:text-[color:var(--accent)] transition truncate">
                    {e.skill.name}
                  </span>
                  <span className="mono text-[10px] text-[color:var(--fg-dim)] uppercase tracking-wider">
                    {e.skill.audience}
                  </span>
                </div>
                <div className="text-[12px] text-[color:var(--fg-muted)] line-clamp-1 mt-0.5">
                  {e.skill.description}
                </div>
              </Link>
              <span className="mono text-[11px] text-[color:var(--fg-dim)] truncate self-start mt-1">
                {hostFromUrl(e.sourceUrl)}
                {e.skill.videoUrls.length > 0 && (
                  <span className="ml-2 text-[color:var(--fg-muted)]">
                    ▶ {e.skill.videoUrls.length}
                  </span>
                )}
              </span>
              {e.skill.repoUrl ? (
                <a
                  href={e.skill.repoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mono text-[12px] tabular-nums self-start mt-1 inline-flex items-center justify-end gap-1.5 text-[color:var(--fg)] hover:text-[color:var(--accent)] transition"
                  title={`★ ${e.stars ?? 0} on ${new URL(e.skill.repoUrl).pathname.replace(/^\//, "")}`}
                >
                  <GithubIcon className="text-[14px] opacity-70 group-hover:opacity-100" />
                  {e.stars != null ? formatStars(e.stars) : "—"}
                </a>
              ) : (
                <span className="mono text-[12px] tabular-nums self-start mt-1 text-right text-[color:var(--fg-dim)]">
                  —
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* DeepWiki-style closing line: positions the product without a marketing wall. */}
      <div className="mt-20 mono text-[11px] text-[color:var(--fg-dim)] text-center">
        Think <span className="text-[color:var(--fg-muted)]">SKILL.md</span> for the rest of the agent
        stack — by hand, not by scrape.
      </div>
    </div>
  );
}

function hostFromUrl(u: string): string {
  try {
    return new URL(u).host.replace(/^www\./, "");
  } catch {
    return u;
  }
}
