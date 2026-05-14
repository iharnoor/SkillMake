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

const COLLECTIONS = [
  {
    href: "/powerhouse",
    label: "Powerhouse",
    description: "Research, HTML artifacts, Codex delegation, and API-to-CLI generation.",
  },
  {
    href: "/tricks",
    label: "Tricks",
    description: "Spend less, keep context cleaner, and keep agent sessions pointed.",
  },
  {
    href: "/submit",
    label: "Submit",
    description: "Send a skill through review so builders can inspect and install it.",
  },
] as const;

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
    <div className="max-w-6xl mx-auto px-6 pt-12 pb-24">
      <div className="grid lg:grid-cols-[minmax(0,1.08fr)_minmax(320px,0.92fr)] gap-8 lg:gap-12 items-end">
        <section>
          <div className="mono text-[11px] uppercase tracking-[0.2em] text-[color:var(--accent)]">
            Personally reviewed agent skills
          </div>
          <h1 className="mt-4 text-4xl sm:text-6xl lg:text-7xl leading-[0.98] font-semibold tracking-tight">
            Install better workflows into Claude, Codex, and every agent.
          </h1>
          <p className="text-[color:var(--fg-muted)] max-w-2xl text-[16px] leading-relaxed mt-5">
            Find a vetted <span className="mono text-[color:var(--fg)]">SKILL.md</span>, inspect the
            source, watch the demo when one exists, then install the exact workflow your next session
            needs.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href="#marketplace-list" className="btn-accent rounded-md px-5 py-2.5 text-sm">
              Browse skills
            </a>
            <Link href="/submit" className="btn-ghost rounded-md px-5 py-2.5 text-sm">
              Submit a skill
            </Link>
          </div>
        </section>

        <aside className="card p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="mono text-[11px] uppercase tracking-[0.2em] text-[color:var(--fg-dim)]">
              install shortcut
            </div>
            <span className="tag tag-accent">reviewed</span>
          </div>
          <div className="mt-4 mono text-[11.5px] text-[color:var(--fg-muted)] whitespace-pre-wrap break-all leading-relaxed">
            <span className="text-[color:var(--fg)]">curl --create-dirs -fsSL</span>{" "}
            skillmake.xyz/i/&lt;name&gt; -o ~/.claude/skills/&lt;name&gt;/SKILL.md
          </div>
          <pre className="mt-5 mono text-[9px] sm:text-[10px] leading-[1.16] text-[color:var(--fg-dim)] whitespace-pre overflow-hidden select-none">
            {ASCII}
          </pre>
        </aside>
      </div>

      <div className="grid md:grid-cols-3 gap-3 mt-10">
        {COLLECTIONS.map((collection) => (
          <Link
            key={collection.href}
            href={collection.href}
            className="card p-4 hover:border-[color:var(--accent)] transition"
          >
            <div className="mono text-[13px] text-[color:var(--fg)]">{collection.label}</div>
            <p className="mt-2 text-[13px] leading-relaxed text-[color:var(--fg-muted)]">
              {collection.description}
            </p>
          </Link>
        ))}
      </div>

      {/* Filter row + count, separated only by a hairline. Click a live pill
          to filter the list by audience; "all" clears the filter. */}
      <div id="marketplace-list" className="mt-14 flex items-baseline justify-between gap-4 flex-wrap border-b border-[color:var(--border)] pb-3 scroll-mt-20">
        <div className="flex items-center gap-x-5 gap-y-2 flex-wrap mono text-[12px]">
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
            className="text-[color:var(--fg-muted)] hover:text-[color:var(--accent)] transition"
          >
            tricks
          </Link>
          <Link
            href="/powerhouse"
            className="text-[color:var(--fg-muted)] hover:text-[color:var(--accent)] transition"
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
        <span className="mono text-[11px] text-[color:var(--fg-dim)] tabular-nums">
          {entries.length}
          {activeAudience
            ? ` ${activeAudience}`
            : activeCategory
              ? ` ${activeCategory.label}`
              : " approved"}
        </span>
      </div>

      <div className="mt-4">
        <MarketplaceSearch />
      </div>

      {entries.length === 0 ? (
        <div className="mono text-[12px] text-[color:var(--fg-dim)] mt-12">
          {activeAudience || activeCategory ? (
            <>
              // no {activeAudience ?? activeCategory?.label} skills yet.{" "}
              <Link href="/" className="text-[color:var(--accent)]">
                show all
              </Link>{" "}
              or{" "}
              <Link href="/submit" className="text-[color:var(--accent)]">
                submit one
              </Link>
              .
            </>
          ) : (
            <>
              // no skills yet. Be the first —{" "}
              <Link href="/submit" className="text-[color:var(--accent)]">
                submit one
              </Link>
              .
            </>
          )}
        </div>
      ) : (
        <div className="mt-6">
          <div className="hidden sm:grid grid-cols-[2.5ch_minmax(0,1.3fr)_minmax(0,0.82fr)_minmax(180px,0.7fr)] gap-x-6 mono text-[10px] uppercase tracking-[0.2em] text-[color:var(--fg-dim)] pb-2 border-b border-[color:var(--border)]">
            <span className="text-right">#</span>
            <span>name</span>
            <span>source</span>
            <span className="text-right">proof</span>
          </div>
          {entries.map((e, i) => (
            <div
              key={e.id}
              className="grid sm:grid-cols-[2.5ch_minmax(0,1.3fr)_minmax(0,0.82fr)_minmax(180px,0.7fr)] gap-x-6 gap-y-2 py-3 border-b border-[color:var(--border)] hover:bg-[color:var(--bg-elevated)]/50 transition group"
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
                  <span className="mono text-[10px] text-[color:var(--fg-dim)] uppercase tracking-wider">
                    {e.skill.category}
                  </span>
                </div>
                <div className="text-[12px] text-[color:var(--fg-muted)] line-clamp-1 mt-0.5">
                  {e.skill.description}
                </div>
              </Link>
              <div className="mono text-[11px] text-[color:var(--fg-dim)] truncate self-start mt-1">
                <div className="truncate">{hostFromUrl(e.sourceUrl)}</div>
                {e.skill.repoUrl && (
                  <a
                    href={e.skill.repoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex max-w-full items-center gap-1.5 text-[color:var(--fg-muted)] hover:text-[color:var(--accent)] transition"
                    title={`★ ${e.stars ?? 0} on ${new URL(e.skill.repoUrl).pathname.replace(/^\//, "")}`}
                  >
                    <GithubIcon className="text-[13px] shrink-0" />
                    <span className="truncate">
                      {new URL(e.skill.repoUrl).pathname.replace(/^\//, "").replace(/\/$/, "")}
                    </span>
                  </a>
                )}
              </div>
              <div className="flex flex-wrap justify-start sm:justify-end gap-1.5 self-start">
                <Signal hot href={`/i/${e.skill.name}`}>install</Signal>
                <Signal>reviewed</Signal>
                {e.skill.videoUrls.length > 0 && <Signal>{e.skill.videoUrls.length} video</Signal>}
                {e.skill.repoUrl && <Signal>source</Signal>}
                {e.stars != null && <Signal>★ {formatStars(e.stars)}</Signal>}
              </div>
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

function Signal({
  children,
  href,
  hot = false,
}: {
  children: React.ReactNode;
  href?: string;
  hot?: boolean;
}) {
  const className = hot
    ? "mono text-[10px] rounded-full border border-[color:var(--accent)] bg-[color:var(--accent)] text-[color:var(--bg)] px-2 py-1 font-semibold"
    : "mono text-[10px] rounded-full border border-[color:var(--border)] text-[color:var(--fg-muted)] px-2 py-1";
  if (href) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }
  return <span className={className}>{children}</span>;
}

function hostFromUrl(u: string): string {
  try {
    return new URL(u).host.replace(/^www\./, "");
  } catch {
    return u;
  }
}
