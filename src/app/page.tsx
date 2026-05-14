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

const LIVE_AUDIENCES: Audience[] = ["creators", "engineers"];
const LIVE_CATEGORIES = [
  { slug: "job-search", label: "job search" },
] as const;

const ASCII = String.raw` ____  _    _ _ _                 _
/ ___|| | _(_) | |_ __ ___   __ _| | _____
\___ \| |/ / | | | '_ \` _ \ / _\` | |/ / _ \
 ___) |   <| | | | | | | | | (_| |   <  __/
|____/|_|\_\_|_|_|_| |_| |_|\__,_|_|\_\___|`;

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ audience?: string; category?: string }>;
}) {
  // Read headers BEFORE `after()` — request-time APIs can't be called inside
  // an after() callback from a Server Component.
  const h = await headers();
  after(() => track("home_view", { headers: h }));

  // Audience pill click → ?audience=<name>. Only LIVE audiences accept a click,
  // so unknown / not-yet-live values fall back to the unfiltered view.
  const params = await searchParams;
  const requested = params.audience as Audience | undefined;
  const activeAudience: Audience | null =
    requested && LIVE_AUDIENCES.includes(requested) ? requested : null;
  const activeCategory =
    LIVE_CATEGORIES.find((c) => c.slug === params.category) ?? null;

  const all = await listSkills();
  // Sort by ★ stars desc, ties and starless skills fall back to createdAt desc.
  // Starless entries (workflow skills, no canonical repo) end up at the bottom
  // of the list. Same primary signal as deepwiki/skills.sh.
  const entries = [...all]
    .filter((e) => (activeAudience ? e.skill.audience === activeAudience : true))
    .filter((e) => (activeCategory ? e.skill.category === activeCategory.slug : true))
    .sort((a, b) => {
      const sa = a.stars ?? -1;
      const sb = b.stars ?? -1;
      if (sb !== sa) return sb - sa;
      return b.createdAt.localeCompare(a.createdAt);
    });

  return (
    <div className="max-w-5xl mx-auto px-6 pt-12 pb-24">
      <div className="absolute inset-x-0 top-14 h-[300px] hero-glow" />

      <div className="relative">
        <pre className="mono text-[10px] leading-[1.15] text-[color:var(--fg)] whitespace-pre overflow-x-auto select-none" aria-label="SkillMake ASCII art">
          {ASCII}
        </pre>

        <div className="mt-7 flex items-end justify-between gap-6 flex-wrap">
          <p className="text-[color:var(--fg-muted)] max-w-xl text-[15px] leading-relaxed">
            A curated marketplace of agent-installable{" "}
            <span className="mono text-[color:var(--fg)] font-medium">SKILL.md</span> files. Every one personally
            reviewed before it goes live.
          </p>
          <Link
            href="/submit"
            className="btn-accent rounded-lg px-5 py-2.5 text-sm whitespace-nowrap"
          >
            + Submit a skill
          </Link>
        </div>

        <div className="mt-5 input-shell rounded-lg px-4 py-2.5 inline-flex items-center gap-2 max-w-full">
          <span className="mono text-[11.5px] text-[color:var(--fg-muted)] shrink-0">install ·</span>
          <code className="mono text-[11.5px] text-[color:var(--fg-dim)] whitespace-pre-wrap break-all">
            curl --create-dirs -fsSL skillmake.xyz/i/&lt;name&gt; -o ~/.claude/skills/&lt;name&gt;/SKILL.md
          </code>
        </div>
      </div>

      <div className="mt-14 flex items-baseline justify-between gap-4 flex-wrap pb-3">
        <div className="flex items-center gap-5 mono text-[12px]">
          <Link
            href="/"
            className={
              activeAudience === null
                ? "text-[color:var(--fg)] underline underline-offset-4 decoration-1"
                : "text-[color:var(--fg-muted)] hover:text-[color:var(--fg)] transition"
            }
          >
            all
          </Link>
          {AUDIENCES.filter((a) => a !== "general" && LIVE_AUDIENCES.includes(a)).map((a) => {
            const selected = activeAudience === a;
            return (
              <Link
                key={a}
                href={`/?audience=${a}`}
                className={
                  selected
                    ? "text-[color:var(--accent)] underline underline-offset-4 decoration-1"
                    : "text-[color:var(--accent)]/80 hover:text-[color:var(--accent)] transition"
                }
              >
                {a}
              </Link>
            );
          })}
          {LIVE_CATEGORIES.map((category) => {
            const selected = activeCategory?.slug === category.slug;
            return (
              <Link
                key={category.slug}
                href={`/?category=${category.slug}`}
                className={
                  selected
                    ? "text-[color:var(--accent)] underline underline-offset-4 decoration-1"
                    : "text-[color:var(--accent)]/80 hover:text-[color:var(--accent)] transition"
                }
              >
                {category.label}
              </Link>
            );
          })}
          <Link
            href="/tricks"
            className="text-[color:var(--accent)]/80 hover:text-[color:var(--accent)] transition"
          >
            tricks
          </Link>
          <Link
            href="/powerhouse"
            className="text-[color:var(--accent)]/80 hover:text-[color:var(--accent)] transition"
          >
            powerhouse
          </Link>
          {AUDIENCES.filter((a) => a !== "general" && !LIVE_AUDIENCES.includes(a)).map((a) => (
            <span
              key={a}
              className="text-[color:var(--fg-dim)]"
              title="coming soon"
            >
              {a}
              <span className="text-[10px] ml-1 opacity-60">·soon</span>
            </span>
          ))}
        </div>
        <span className="mono text-[11px] text-[color:var(--fg-dim)] tabular-nums flex items-center gap-1.5">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[color:var(--accent)] opacity-60" />
          {entries.length}
          {activeAudience
            ? ` ${activeAudience}`
            : activeCategory
              ? ` ${activeCategory.label}`
              : " approved"}
        </span>
      </div>
      <div className="section-divider" />

      <div className="mt-4">
        <MarketplaceSearch />
      </div>

      {entries.length === 0 ? (
        <div className="card p-8 mt-12 text-center">
          <div className="mono text-[28px] text-[color:var(--fg-dim)] mb-4 opacity-30">⌕</div>
          {activeAudience || activeCategory ? (
            <div className="space-y-2">
              <p className="mono text-[13px] text-[color:var(--fg-muted)]">
                No {activeAudience ?? activeCategory?.label} skills yet.
              </p>
              <div className="flex items-center justify-center gap-3 mt-4">
                <Link href="/" className="btn-ghost rounded-lg px-4 py-2 text-sm">
                  Show all
                </Link>
                <Link href="/submit" className="btn-accent rounded-lg px-4 py-2 text-sm">
                  Submit one
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="mono text-[13px] text-[color:var(--fg-muted)]">
                No skills yet. Be the first.
              </p>
              <Link href="/submit" className="btn-accent rounded-lg px-5 py-2.5 text-sm inline-block mt-3">
                + Submit a skill
              </Link>
            </div>
          )}
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
              className="grid grid-cols-[2.5ch_1fr_1fr_8ch] gap-x-6 py-3.5 border-b border-[color:var(--border)] row-hover group"
            >
              <span className="mono text-[12px] text-[color:var(--fg-dim)] tabular-nums text-right self-start mt-1">
                {i + 1}
              </span>
              <Link href={`/marketplace/${e.id}`} className="min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="mono text-[14px] text-[color:var(--fg)] group-hover:text-[color:var(--accent)] transition truncate">
                    {e.skill.name}
                  </span>
                  <span className="tag text-[9px] py-0.5 px-1.5">{e.skill.audience}</span>
                  <span className="tag text-[9px] py-0.5 px-1.5">{e.skill.category}</span>
                </div>
                <div className="text-[12.5px] text-[color:var(--fg-muted)] line-clamp-1 mt-1">
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
                  <GithubIcon className="text-[14px] opacity-70 group-hover:opacity-100 transition-opacity" />
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

      <div className="mt-20 section-divider" />
      <div className="mt-6 mono text-[11px] text-[color:var(--fg-dim)] text-center">
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
