import Link from "next/link";
import { after } from "next/server";
import { headers } from "next/headers";
import { listSkills, type MarketplaceEntry } from "@/lib/storage";
import { MarketplaceSearch } from "@/components/MarketplaceSearch";
import { AUDIENCES, type Audience } from "@/lib/skill-schema";
import { formatStars } from "@/lib/github";
import { GithubIcon } from "@/components/GithubIcon";
import { GithubLink } from "@/components/OutboundLink";
import { track } from "@/lib/metrics";

export const dynamic = "force-dynamic";

const LIVE_AUDIENCES: Audience[] = ["creators", "engineers"];
const LIVE_CATEGORIES = [
  { slug: "job-search", label: "job search" },
] as const;
const COLLECTION_FILTERS = [
  { slug: "tricks", label: "tricks" },
  { slug: "powerhouse", label: "powerhouse" },
] as const;

type CollectionSlug = (typeof COLLECTION_FILTERS)[number]["slug"];

interface DisplayEntry {
  id: string;
  name: string;
  description: string;
  audience: string;
  category: string;
  source: string;
  href: string;
  repoUrl?: string;
  stars?: number | null;
  createdAt?: string;
  videoCount: number;
}

const ASCII = String.raw` ____  _    _ _ _                 _
/ ___|| | _(_) | |_ __ ___   __ _| | _____
\___ \| |/ / | | | '_ \` _ \ / _\` | |/ / _ \
 ___) |   <| | | | | | | | | (_| |   <  __/
|____/|_|\_\_|_|_|_| |_| |_|\__,_|_|\_\___|`;

const FEATURED_LINKS = [
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
  searchParams: Promise<{ audience?: string; category?: string; collection?: string }>;
}) {
  // Read headers BEFORE `after()` — request-time APIs can't be called inside
  // an after() callback from a Server Component.
  const h = await headers();

  // Audience pill click → ?audience=<name>. Only LIVE audiences accept a click,
  // so unknown / not-yet-live values fall back to the unfiltered view.
  const params = await searchParams;
  const requested = params.audience as Audience | undefined;
  const activeAudience: Audience | null =
    requested && LIVE_AUDIENCES.includes(requested) ? requested : null;
  const activeCategory =
    LIVE_CATEGORIES.find((c) => c.slug === params.category) ?? null;
  const activeCollection =
    COLLECTION_FILTERS.find((c) => c.slug === params.collection) ?? null;

  // Filter the URL was on when home_view fired — empty slug = unfiltered.
  const homeFilter = activeAudience
    ? activeAudience
    : activeCategory
      ? activeCategory.slug
      : activeCollection
        ? activeCollection.slug
        : "";
  after(() => track("home_view", { slug: homeFilter, headers: h }));

  const all = await listSkills();
  const entries = buildDisplayEntries(
    activeCollection
      ? collectionEntries(activeCollection.slug, all)
      : [...all]
          .filter((e) => (activeAudience ? e.skill.audience === activeAudience : true))
          .filter((e) => (activeCategory ? e.skill.category === activeCategory.slug : true))
  );
  if (!activeCollection) {
    entries.sort((a, b) => {
      const stars = (b.stars ?? -1) - (a.stars ?? -1);
      if (stars !== 0) return stars;
      const created = (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
      if (created !== 0) return created;
      return b.name.localeCompare(a.name);
    });
  }

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
        {FEATURED_LINKS.map((collection) => (
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
                && activeCategory === null
                && activeCollection === null
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
          {COLLECTION_FILTERS.map((collection) => {
            const selected = activeCollection?.slug === collection.slug;
            return (
              <Link
                key={collection.slug}
                href={`/?collection=${collection.slug}`}
                className={
                  selected
                    ? "text-[color:var(--accent)] underline underline-offset-4 decoration-1"
                    : "text-[color:var(--accent)]/80 hover:text-[color:var(--accent)] transition"
                }
              >
                {collection.label}
              </Link>
            );
          })}
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
              : activeCollection
                ? ` ${activeCollection.label}`
              : " approved"}
        </span>
      </div>

      <div className="mt-4">
        <MarketplaceSearch />
      </div>

      {entries.length === 0 ? (
        <div className="mono text-[12px] text-[color:var(--fg-dim)] mt-12">
          {activeAudience || activeCategory || activeCollection ? (
            <>
              // no {activeAudience ?? activeCategory?.label ?? activeCollection?.label} skills yet.{" "}
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
          <div className="hidden lg:grid grid-cols-[2.5ch_minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(180px,0.8fr)] gap-x-6 mono text-[10px] uppercase tracking-[0.2em] text-[color:var(--fg-dim)] pb-2 border-b border-[color:var(--border)]">
            <span className="text-right">#</span>
            <span>name</span>
            <span>source</span>
            <span className="text-right">proof</span>
          </div>
          {entries.map((e, i) => (
            <div
              key={e.id}
              id={e.id}
              className="grid lg:grid-cols-[2.5ch_minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(180px,0.8fr)] gap-x-6 gap-y-2 py-3 border-b border-[color:var(--border)] hover:bg-[color:var(--bg-elevated)]/50 transition group"
            >
              <span className="mono text-[12px] text-[color:var(--fg-dim)] tabular-nums text-right self-start mt-1">
                {i + 1}
              </span>
              <Link href={e.href} className="min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="mono text-[14px] text-[color:var(--fg)] group-hover:text-[color:var(--accent)] transition truncate">
                    {e.name}
                  </span>
                  <span className="mono text-[10px] text-[color:var(--fg-dim)] uppercase tracking-wider">
                    {e.audience}
                  </span>
                  <span className="mono text-[10px] text-[color:var(--fg-dim)] uppercase tracking-wider">
                    {e.category}
                  </span>
                </div>
                <div className="text-[12px] text-[color:var(--fg-muted)] line-clamp-1 mt-0.5">
                  {e.description}
                </div>
              </Link>
              <div className="mono text-[11px] text-[color:var(--fg-dim)] truncate self-start mt-1">
                <div className="truncate">{e.source}</div>
                {e.repoUrl && (
                  <GithubLink
                    href={e.repoUrl}
                    slug={e.name}
                    className="inline-flex max-w-full items-center gap-1.5 text-[color:var(--fg-muted)] hover:text-[color:var(--accent)] transition"
                    title={`★ ${e.stars ?? 0} on ${new URL(e.repoUrl).pathname.replace(/^\//, "")}`}
                  >
                    <GithubIcon className="text-[13px] shrink-0" />
                    <span className="truncate">
                      {new URL(e.repoUrl).pathname.replace(/^\//, "").replace(/\/$/, "")}
                    </span>
                  </GithubLink>
                )}
              </div>
              <div className="flex flex-wrap justify-start sm:justify-end gap-1.5 self-start">
                <Signal hot href={`/i/${e.name}`}>install</Signal>
                <Signal>reviewed</Signal>
                {e.videoCount > 0 && <Signal>{e.videoCount} video</Signal>}
                {e.repoUrl && <Signal>source</Signal>}
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

function collectionEntries(slug: CollectionSlug, entries: MarketplaceEntry[]): (MarketplaceEntry | DisplayEntry)[] {
  const byName = new Map(entries.map((entry) => [entry.skill.name, entry]));
  if (slug === "powerhouse") {
    return [
      syntheticFromSkill(byName, "html-everything", "Turn Markdown, JSON, text, or a doc URL into one self-contained editorial HTML page.", "tool"),
      syntheticFromSkill(byName, "last72hours", "Scan the last three days of social and web signals, then produce a sourced brief.", "tool"),
      syntheticFromSkill(byName, "last30days", "Research what people actually said in the last month, then synthesize it with citations.", "tool"),
      syntheticFromSkill(byName, "printingpress", "Generate an agent-native CLI and MCP server from an API spec, HAR file, or website.", "tool"),
      syntheticFromSkill(byName, "codex-plugin-cc", "Bring Codex into Claude Code for reviews, adversarial checks, and delegated fixes.", "tool"),
    ];
  }

  return [
    syntheticFromSkill(byName, "caveman", "Use fewer output tokens without losing technical content.", "tool"),
    syntheticFromSkill(byName, "free-claude-code", "Route Claude Code through free or cheaper model providers.", "tool"),
    syntheticEntry("fan out subagents", "Run independent investigations in parallel subagents so the parent context stays clean.", "technique"),
    syntheticEntry("/goal", "Write explicit success criteria, non-goals, and the riskiest unknown before a session drifts.", "technique"),
  ];
}

function syntheticFromSkill(
  byName: Map<string, MarketplaceEntry>,
  name: string,
  description: string,
  category: string
): MarketplaceEntry | DisplayEntry {
  return byName.get(name) ?? syntheticEntry(name, description, category);
}

function buildDisplayEntries(entries: (MarketplaceEntry | DisplayEntry)[]): DisplayEntry[] {
  return entries.map((entry) => {
    if ("skill" in entry) {
      return {
        id: entry.id,
        name: entry.skill.name,
        description: entry.skill.description,
        audience: entry.skill.audience,
        category: entry.skill.category,
        source: hostFromUrl(entry.sourceUrl),
        href: `/marketplace/${entry.id}`,
        repoUrl: entry.skill.repoUrl,
        stars: entry.stars,
        createdAt: entry.createdAt,
        videoCount: entry.skill.videoUrls.length,
      };
    }
    return entry;
  });
}

function syntheticEntry(name: string, description: string, category: string): DisplayEntry {
  const id = name.replace(/^\//, "").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  return {
    id,
    name,
    description,
    audience: "general",
    category,
    source: "workflow",
    href: `#${id}`,
    videoCount: 0,
  };
}

