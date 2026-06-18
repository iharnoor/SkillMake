import Link from "next/link";
import { after } from "next/server";
import { headers } from "next/headers";
import { listSkills, type MarketplaceEntry } from "@/lib/storage";
import { listPacks } from "@/lib/packs";
import { MarketplaceSearch } from "@/components/MarketplaceSearch";
import { TrustBadge } from "@/components/TrustBadge";
import { AUDIENCES, type Audience, type TrustTier } from "@/lib/skill-schema";
import { formatStars } from "@/lib/github";
import { GithubIcon } from "@/components/GithubIcon";
import { GithubLink } from "@/components/OutboundLink";
import { track } from "@/lib/metrics";

export const dynamic = "force-dynamic";

const LIVE_AUDIENCES: Audience[] = ["creators", "engineers", "devops", "marketing", "design"];
const LIVE_CATEGORIES = [
  { slug: "security", label: "security" },
  { slug: "design", label: "design" },
  { slug: "pm", label: "PMs" },
  { slug: "job-search", label: "job search" },
] as const;
const COLLECTION_FILTERS = [
  { slug: "trending", label: "trending" },
  { slug: "budget", label: "budget" },
  { slug: "mcps", label: "mcps" },
  { slug: "productivity", label: "productivity" },
] as const;

type CollectionSlug = (typeof COLLECTION_FILTERS)[number]["slug"];

interface DisplayEntry {
  id: string;
  name: string;
  description: string;
  audience: string;
  category: string;
  trust: TrustTier;
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
    href: "/packs",
    label: "Prompt Packs",
    description: "Copy-paste prompt grammar for Nano Banana and other generative models.",
  },
  {
    href: "/mcps",
    label: "MCPs",
    description: "Agent-callable tools for browsers, APIs, SaaS, and custom workflows.",
  },
  {
    href: "/budget",
    label: "Budget",
    description: "Spend less, keep context cleaner, and keep agent sessions pointed.",
  },
  {
    href: "/submit",
    label: "Submit",
    description: "Send a skill through review so builders can inspect and install it.",
  },
] as const;

// Trending board — a point-in-time snapshot of repos climbing the GitHub
// trending list. Star counts are curated figures (same convention as the
// mcps collection); each repo is also filed into its best-fit collection
// below so it's discoverable beyond the trending view.
const TRENDING = {
  markitdown: repoEntry(
    "markitdown",
    "Convert files and office documents to clean Markdown — the foundation layer for feeding real business content into agents without garbage tokens.",
    "https://github.com/microsoft/markitdown",
    16400
  ),
  headroom: repoEntry(
    "headroom",
    "Compress tool outputs, logs, files, and RAG chunks before they reach the LLM — 60–95% fewer tokens with the same answers. Library + proxy + MCP server.",
    "https://github.com/zereight/headroom",
    12000
  ),
  moneyPrinterTurbo: repoEntry(
    "MoneyPrinterTurbo",
    "One-click generation of high-quality short videos using AI LLMs. The speed at which video agents are being productized is the real story here.",
    "https://github.com/harry0703/MoneyPrinterTurbo",
    11400,
    "tool",
    "creators"
  ),
  ecc: repoEntry(
    "ecc",
    "The agent-harness performance optimization system — skills, instincts, memory, security, and research-first development for Claude Code, Codex, Cursor, and beyond.",
    "https://github.com/ecc-hh/ecc",
    10300
  ),
} as const;

// Cloudflare's Code Mode — MCP infrastructure that doubles as a budget play.
// Lives in the Agents SDK (no standalone repo). Filed in both mcps and budget.
const CODE_MODE = repoEntry(
  "cloudflare-code-mode",
  "Cloudflare's Code Mode: instead of handing MCP tools to the model directly, it converts them into a TypeScript API the model writes code against — run in a Workers sandbox. Tool schemas and intermediate results stay out of the context window, so token use drops sharply.",
  "https://github.com/cloudflare/agents",
  5051
);

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
            <Link href="/submit" prefetch={false} className="btn-ghost rounded-md px-5 py-2.5 text-sm">
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
            prefetch={false}
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
            prefetch={false}
            scroll={false}
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
                prefetch={false}
                scroll={false}
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
                prefetch={false}
                scroll={false}
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
                prefetch={false}
                scroll={false}
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
          <Link
            href="/packs"
            prefetch={false}
            className="text-[color:var(--accent)]/80 hover:text-[color:var(--accent)] transition"
          >
            packs
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
              : activeCollection
                ? ` ${activeCollection.label}`
              : " approved"}
        </span>
      </div>

      <div className="mt-4">
        <MarketplaceSearch
          entries={[
            ...entries.map((entry) => ({
              id: entry.id,
              name: entry.name,
              description: entry.description,
              category: entry.category,
              audience: entry.audience,
              trust: entry.trust ?? "community",
              href: entry.href,
            })),
            ...packSearchEntries(),
          ]}
        />
      </div>

      {entries.length === 0 ? (
        <div className="mono text-[12px] text-[color:var(--fg-dim)] mt-12">
          {activeAudience || activeCategory || activeCollection ? (
            <>
              // no {activeAudience ?? activeCategory?.label ?? activeCollection?.label} skills yet.{" "}
              <Link href="/" prefetch={false} className="text-[color:var(--accent)]">
                show all
              </Link>{" "}
              or{" "}
              <Link href="/submit" prefetch={false} className="text-[color:var(--accent)]">
                submit one
              </Link>
              .
            </>
          ) : (
            <>
              // no skills yet. Be the first —{" "}
              <Link href="/submit" prefetch={false} className="text-[color:var(--accent)]">
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
              <Link href={e.href} prefetch={false} className="min-w-0">
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
                  <TrustBadge tier={e.trust} />
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
                <Signal hot href={`/i/${installSlug(e.name)}`}>install</Signal>
                {e.videoCount > 0 && <Signal>{e.videoCount} video</Signal>}
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
      <Link href={href} prefetch={false} className={className}>
        {children}
      </Link>
    );
  }
  return <span className={className}>{children}</span>;
}

// Install shortcut resolves by skill name (see /i/[name]). Stored skills already
// carry slug-style names, so this is a no-op for them; collection display names
// like "html everything" get normalized to their seeded slug ("html-everything").
function installSlug(name: string): string {
  return name.replace(/^\//, "").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
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
  if (slug === "trending") {
    // Ordered by stars, mirroring the GitHub trending board.
    return [
      TRENDING.markitdown,
      TRENDING.headroom,
      TRENDING.moneyPrinterTurbo,
      TRENDING.ecc,
    ];
  }
  if (slug === "mcps") {
    return [
      syntheticFromSkill(byName, "mcp-builder", "Design and ship a Model Context Protocol server with a tool surface an agent can actually use.", "tool"),
      syntheticFromSkill(byName, "firecrawl-mcp", "Expose Firecrawl scraping, crawling, mapping, and extraction to an agent through MCP.", "tool"),
      syntheticFromSkill(byName, "playwright-skill", "Give an agent a Playwright browser runner for end-to-end checks, screenshots, and custom web flows.", "tool"),
      syntheticFromSkill(byName, "linear-claude-skill", "Use Linear's official MCP server for issue, project, and workspace workflows.", "tool"),
      syntheticFromSkill(byName, "resend-email-skill", "Send and inspect Resend email resources through an MCP-backed Claude workflow.", "tool"),
      syntheticFromSkill(byName, "printingpress", "Generate an agent-native CLI and MCP server from an API spec, HAR file, or website.", "tool"),
      syntheticFromSkill(byName, "browser-use", "Attach an agent to a real browser through MCP-style browser control and inspection tools.", "tool"),
      syntheticFromSkill(byName, "higgsfield-mcp", "Generate images and videos with Higgsfield's model roster through the official hosted MCP.", "tool"),
      syntheticFromSkill(byName, "runway-mcp", "Run Runway text-to-video, image-to-video, and upscaling from an agent through MCP.", "tool"),
      CODE_MODE,
      famousMcpEntry("context7-mcp", "Up-to-date package docs and code examples for AI coding agents.", "https://github.com/upstash/context7", 56309),
      famousMcpEntry("github-mcp-server", "GitHub's official MCP server for repository, issue, pull request, and workflow context.", "https://github.com/github/github-mcp-server", 30245),
      famousMcpEntry("playwright-mcp", "Microsoft's Playwright MCP server for browser automation through accessibility snapshots.", "https://github.com/microsoft/playwright-mcp", 33158),
      famousMcpEntry("chrome-devtools-mcp", "Chrome DevTools for coding agents: console, network, performance, and page inspection.", "https://github.com/ChromeDevTools/chrome-devtools-mcp", 42133),
      famousMcpEntry("mcp-toolbox-databases", "Google's MCP Toolbox for Databases across Postgres, MySQL, BigQuery, Redis, and more.", "https://github.com/googleapis/mcp-toolbox", 15379),
      famousMcpEntry("figma-context-mcp", "Figma layout context for AI coding agents building UI from designs.", "https://github.com/GLips/Figma-Context-MCP", 14901),
      famousMcpEntry("notion-mcp-server", "Notion's official MCP server for workspace pages, databases, and knowledge workflows.", "https://github.com/makenotion/notion-mcp-server", 4368),
      famousMcpEntry("browserbase-mcp", "Cloud browser control for agents through Browserbase and Stagehand.", "https://github.com/browserbase/mcp-server-browserbase", 3359),
      famousMcpEntry("supabase-mcp", "Connect AI assistants to Supabase project, database, and app-building workflows.", "https://github.com/supabase-community/supabase-mcp", 2709),
      famousMcpEntry("apify-mcp", "Apify's MCP server for ready-made scrapers, crawlers, and automation actors.", "https://github.com/apify/apify-mcp-server", 1283),
      famousMcpEntry("kubernetes-mcp", "Kubernetes management commands exposed to agents through kubectl-backed MCP tools.", "https://github.com/Flux159/mcp-server-kubernetes", 1399),
      famousMcpEntry("sentry-mcp", "Sentry's MCP server for production error, issue, and observability workflows.", "https://github.com/getsentry/sentry-mcp", 706),
      famousMcpEntry("official-mcp-servers", "The reference MCP server collection: filesystem, fetch, git, memory, sequential thinking, and time.", "https://github.com/modelcontextprotocol/servers", 86412),
    ];
  }

  if (slug === "productivity") {
    // Agent skills and tools that compress real knowledge-work. Excalidraw
    // leads; each links to its source repo. The trailing trending repos carry
    // curated star snapshots (see TRENDING); the rest have no fabricated stars.
    return [
      skillEntry(
        "excalidraw-diagram",
        "excalidraw diagram",
        "Turn any system or idea into a clean, shareable Excalidraw diagram — rendered and self-corrected in a loop, not a placeholder you'd redraw.",
        "https://github.com/coleam00/excalidraw-diagram-skill"
      ),
      skillEntry(
        "html-everything",
        "html everything",
        "Turn any blob — Markdown, JSON, plain text, or a doc URL — into one self-contained editorial HTML page with clickable links. No deps, no API keys.",
        "https://github.com/iharnoor/html-everything"
      ),
      skillEntry(
        "anthropic-document-skills",
        "document skills (pdf · docx · pptx · xlsx)",
        "Read, fill, and generate PDFs, Word docs, slide decks, and spreadsheets — the most universal knowledge-work bottleneck, handled by the agent.",
        "https://github.com/anthropics/skills"
      ),
      skillEntry(
        "skill-creator",
        "skill creator",
        "The skill that builds skills. Turn a workflow you repeat into a reusable agent skill instead of re-explaining it every session.",
        "https://github.com/anthropics/skills"
      ),
      skillEntry(
        "awesome-claude-skills",
        "awesome claude skills",
        "The curated index of the best agent skills (8.7k★) — where the next must-have comes from.",
        "https://github.com/ComposioHQ/awesome-claude-skills"
      ),
      // Real star counts pulled from the GitHub API (2026-06-16), not curated
      // figures — refresh if they drift.
      repoEntry(
        "awesome-agent-skills",
        "A cross-agent index of 1000+ skills from official dev teams and the community — works with Claude Code, Codex, Gemini CLI, and Cursor, so it's not locked to one harness.",
        "https://github.com/VoltAgent/awesome-agent-skills",
        25560
      ),
      repoEntry(
        "last30days",
        "Point an agent at any topic and get a grounded, cited brief from what Reddit, X, YouTube, HN, and Polymarket actually said in the last 30 days — ranked by real engagement, not editors.",
        "https://github.com/mvanhorn/last30days-skill",
        43484
      ),
      repoEntry(
        "open-notebook",
        "A private, self-hostable NotebookLM: drop in PDFs, web pages, YouTube, and audio, then chat, search, and generate podcasts — sources stay on your own infrastructure, any model.",
        "https://github.com/lfnovo/open-notebook",
        31117
      ),
      TRENDING.markitdown,
      TRENDING.ecc,
      TRENDING.moneyPrinterTurbo,
    ];
  }

  return [
    syntheticFromSkill(byName, "caveman", "Use fewer output tokens without losing technical content.", "tool"),
    syntheticFromSkill(byName, "free-claude-code", "Route Claude Code through free or cheaper model providers.", "tool"),
    skillEntry(
      "claude-code-router",
      "claude-code-router",
      "Put OpenRouter in front of Claude Code — one key, 300+ models, route easy turns to a backend at 2–5% of Sonnet's price.",
      "https://github.com/musistudio/claude-code-router"
    ),
    TRENDING.headroom,
    CODE_MODE,
    syntheticEntry("fan out subagents", "Run independent investigations in parallel subagents so the parent context stays clean.", "technique"),
    syntheticEntry("/goal", "Write explicit success criteria, non-goals, and the riskiest unknown before a session drifts.", "technique"),
    syntheticEntry("ask-expert-mcp", "Let a cheap model escalate to a stronger one only when stuck — pay frontier prices for the hard 5%, not the easy 95%.", "technique"),
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

// External agent-skill entry — links straight to the skill's source repo. No
// fabricated star counts (unlike famousMcpEntry, whose numbers are curated).
function skillEntry(
  id: string,
  name: string,
  description: string,
  repoUrl: string
): DisplayEntry {
  return {
    id,
    name,
    description,
    audience: "engineers",
    category: "tool",
    trust: "verified",
    source: hostFromUrl(repoUrl),
    href: repoUrl,
    repoUrl,
    videoCount: 0,
  };
}

// A curated external repo entry carrying a point-in-time star count — like
// famousMcpEntry, but not MCP-specific. Powers the trending board and any
// tool entry that should surface a star signal.
function repoEntry(
  name: string,
  description: string,
  repoUrl: string,
  stars: number,
  category = "tool",
  audience = "engineers"
): DisplayEntry {
  return {
    id: name.replace(/[^a-z0-9]+/gi, "-").toLowerCase(),
    name,
    description,
    audience,
    category,
    trust: "verified",
    source: hostFromUrl(repoUrl),
    href: repoUrl,
    repoUrl,
    stars,
    videoCount: 0,
  };
}

function famousMcpEntry(
  name: string,
  description: string,
  repoUrl: string,
  stars: number
): DisplayEntry {
  return {
    id: name,
    name,
    description,
    audience: "engineers",
    category: "tool",
    trust: "verified",
    source: hostFromUrl(repoUrl),
    href: repoUrl,
    repoUrl,
    stars,
    videoCount: 0,
  };
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
        trust: entry.skill.trust ?? "community",
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

interface SearchEntry {
  id: string;
  name: string;
  description: string;
  category: string;
  audience: string;
  trust: TrustTier;
  href: string;
}

// Packs live in a separate static file and are invisible to the marketplace
// search index. Surface both the pack and each individual prompt here so a
// query like "excalidraw" or "famous" resolves to the right /packs anchor.
function packSearchEntries(): SearchEntry[] {
  const out: SearchEntry[] = [];
  for (const pack of listPacks()) {
    out.push({
      id: `pack-${pack.slug}`,
      name: pack.title,
      description: pack.tagline || pack.description,
      category: "pack",
      audience: pack.audience,
      trust: "verified",
      href: `/packs/${pack.slug}`,
    });
    for (const prompt of pack.prompts) {
      out.push({
        id: `pack-${pack.slug}-${prompt.id}`,
        name: prompt.title,
        description: prompt.tip || `${prompt.category} prompt from ${pack.title}.`,
        category: prompt.category,
        audience: pack.audience,
        trust: "verified",
        href: `/packs/${pack.slug}#${prompt.id}`,
      });
    }
  }
  return out;
}

function syntheticEntry(name: string, description: string, category: string): DisplayEntry {
  const id = name.replace(/^\//, "").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  return {
    id,
    name,
    description,
    audience: "general",
    category,
    trust: "community",
    source: "workflow",
    href: `#${id}`,
    videoCount: 0,
  };
}
