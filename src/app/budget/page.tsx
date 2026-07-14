import Link from "next/link";
import { after } from "next/server";
import { headers } from "next/headers";
import { track } from "@/lib/metrics";
import { findApprovedByName, type MarketplaceEntry } from "@/lib/storage";
import { GithubIcon } from "@/components/GithubIcon";
import { GithubLink } from "@/components/OutboundLink";
import { fetchRepoStars, formatStars } from "@/lib/github";

export const dynamic = "force-dynamic";

interface CollectionEntry {
  name: string;
  description: string;
  audience: string;
  category: string;
  source: string;
  href: string;
  repoUrl?: string;
  stars?: number | null;
  videoCount?: number;
}

const ROUTER_REPO = "https://github.com/musistudio/claude-code-router";
const HEADROOM_REPO = "https://github.com/zereight/headroom";
const CODE_MODE_REPO = "https://github.com/cloudflare/agents";
const PXPIPE_REPO = "https://github.com/teamchong/pxpipe";

export default async function BudgetPage() {
  const h = await headers();
  after(() => track("budget_view", { headers: h }));

  const [caveman, fcc, routerStars, headroomStars, codeModeStars, pxpipeStars] = await Promise.all([
    findApprovedByName("caveman"),
    findApprovedByName("free-claude-code"),
    fetchRepoStars(ROUTER_REPO),
    fetchRepoStars(HEADROOM_REPO),
    fetchRepoStars(CODE_MODE_REPO),
    fetchRepoStars(PXPIPE_REPO),
  ]);

  const entries: CollectionEntry[] = [
    skillRow(
      caveman,
      "caveman",
      "Talk-like-caveman skill that drops filler and replies in technical fragments. Cuts output tokens while keeping the technical content intact."
    ),
    skillRow(
      fcc,
      "free-claude-code",
      "Local proxy that speaks the Anthropic Messages API to Claude Code and routes requests to free or cheaper model providers."
    ),
    {
      name: "claude-code-router",
      description:
        "Put OpenRouter in front of Claude Code: one API key reaches 300+ models, so the easy turns route to a backend at 2–5% of Sonnet's price while the hard ones stay on a frontier model — and spend is visible per request from one dashboard.",
      audience: "general",
      category: "tool",
      source: "github.com/musistudio",
      href: ROUTER_REPO,
      repoUrl: ROUTER_REPO,
      stars: routerStars,
    },
    {
      name: "headroom",
      description:
        "Compress tool outputs, logs, files, and RAG chunks before they reach the LLM — 60–95% fewer tokens with the same answers. Ships as a library, a proxy, and an MCP server.",
      audience: "general",
      category: "tool",
      source: "github.com/zereight",
      href: HEADROOM_REPO,
      repoUrl: HEADROOM_REPO,
      stars: headroomStars ?? 12000,
    },
    {
      name: "code mode",
      description:
        "Cloudflare's Code Mode: instead of handing MCP tools to the model directly, it converts them into a TypeScript API the model writes code against — run in a Workers sandbox. Tool schemas and intermediate results stay out of the context window, so token use drops sharply.",
      audience: "general",
      category: "tool",
      source: "github.com/cloudflare",
      href: CODE_MODE_REPO,
      repoUrl: CODE_MODE_REPO,
      stars: codeModeStars ?? 5051,
    },
    {
      name: "code-to-image OCR",
      description:
        "pxpipe renders source code to an image and has the model OCR it back — Fable reads an image far cheaper than the equivalent code tokens, so read-heavy turns land a ~60% cost cut with the code intact.",
      audience: "general",
      category: "tool",
      source: "github.com/teamchong",
      href: PXPIPE_REPO,
      repoUrl: PXPIPE_REPO,
      stars: pxpipeStars,
    },
    {
      name: "fan out subagents",
      description:
        "Run independent investigations in parallel subagents so the parent context stays clean and the work finishes at the same wall-clock minute.",
      audience: "general",
      category: "technique",
      source: "workflow",
      href: "#fan-out-subagents",
    },
    {
      name: "/goal",
      description:
        "Start a session by writing explicit success criteria, non-goals, and the riskiest unknown so the agent has something concrete to steer against.",
      audience: "general",
      category: "technique",
      source: "workflow",
      href: "#goal",
    },
    {
      name: "ask-expert-mcp",
      description:
        "Let a cheap or open-source model escalate to a stronger one only when it gets stuck — so you pay frontier prices for the hard 5%, not the easy 95%.",
      audience: "general",
      category: "technique",
      source: "workflow",
      href: "#ask-expert-mcp",
    },
  ];

  return (
    <div className="max-w-5xl mx-auto px-6 pt-12 pb-24">
      <CollectionHeader
        active="budget"
        eyebrow="Budget"
        title="Save money. Same agent."
        description="Nine practical ways to drop agent cost or context waste. Six are installable tools; three are pure technique."
        countLabel={`${entries.length} ways to save`}
      />
      <CollectionTable entries={entries} />

      <section className="mt-16 border-t border-[color:var(--border)] pt-6">
        <h2 className="mono text-[11px] uppercase tracking-[0.2em] text-[color:var(--fg-dim)]">
          How they compose
        </h2>
        <p className="text-[15px] text-[color:var(--fg-muted)] leading-relaxed mt-3 max-w-3xl">
          <a
            href="#caveman"
            className="text-[color:var(--accent)] underline underline-offset-4 decoration-1"
          >
            caveman
          </a>{" "}
          cuts output tokens,{" "}
          <a
            href="#free-claude-code"
            className="text-[color:var(--accent)] underline underline-offset-4 decoration-1"
          >
            free-claude-code
          </a>{" "}
          and{" "}
          <a
            href="#claude-code-router"
            className="text-[color:var(--accent)] underline underline-offset-4 decoration-1"
          >
            claude-code-router
          </a>{" "}
          change the model bill — the latter routing through OpenRouter to the
          cheapest capable model,{" "}
          <a
            href="#headroom"
            className="text-[color:var(--accent)] underline underline-offset-4 decoration-1"
          >
            headroom
          </a>{" "}
          strips 60–95% of the tokens out of context before they ever reach the
          model,{" "}
          <a
            href="#code-mode"
            className="text-[color:var(--accent)] underline underline-offset-4 decoration-1"
          >
            code mode
          </a>{" "}
          keeps MCP tool schemas and intermediate results in a sandbox instead of
          the context window,{" "}
          <a
            href="#code-to-image-ocr"
            className="text-[color:var(--accent)] underline underline-offset-4 decoration-1"
          >
            code-to-image OCR
          </a>{" "}
          swaps expensive code tokens for a cheap image the model OCRs back,{" "}
          <a
            href="#fan-out-subagents"
            className="text-[color:var(--accent)] underline underline-offset-4 decoration-1"
          >
            fan out subagents
          </a>{" "}
          keeps parent context smaller,{" "}
          <a
            href="#goal"
            className="text-[color:var(--accent)] underline underline-offset-4 decoration-1"
          >
            /goal
          </a>{" "}
          keeps the work from drifting, and{" "}
          <a
            href="#ask-expert-mcp"
            className="text-[color:var(--accent)] underline underline-offset-4 decoration-1"
          >
            ask-expert-mcp
          </a>{" "}
          reserves frontier-model spend for the hard 5% of decisions.
        </p>
      </section>
    </div>
  );
}

function skillRow(
  entry: MarketplaceEntry | null,
  fallbackName: string,
  description: string
): CollectionEntry {
  return {
    name: entry?.skill.name ?? fallbackName,
    description: entry?.skill.description ?? description,
    audience: entry?.skill.audience ?? "general",
    category: entry?.skill.category ?? "tool",
    source: entry ? hostFromUrl(entry.sourceUrl) : "marketplace",
    href: entry ? `/marketplace/${entry.id}` : `/i/${fallbackName}`,
    repoUrl: entry?.skill.repoUrl,
    stars: entry?.stars,
    videoCount: entry?.skill.videoUrls.length ?? 0,
  };
}

function CollectionHeader({
  active,
  eyebrow,
  title,
  description,
  countLabel,
}: {
  active: "budget" | "mcps";
  eyebrow: string;
  title: string;
  description: string;
  countLabel: string;
}) {
  return (
    <>
      <Link
        href="/"
        className="mono text-[12px] text-[color:var(--fg-muted)] hover:text-[color:var(--accent)]"
      >
        ← all skills
      </Link>

      <div className="mt-6 mono text-[11px] uppercase tracking-[0.2em] text-[color:var(--fg-dim)]">
        {eyebrow}
      </div>
      <div className="mt-2 flex items-end justify-between gap-6 flex-wrap">
        <div>
          <h1 className="text-3xl sm:text-4xl tracking-[-0.02em] font-semibold">{title}</h1>
          <p className="text-[color:var(--fg-muted)] mt-3 leading-relaxed max-w-2xl">
            {description}
          </p>
        </div>
        <Link href="/submit" className="btn-accent rounded-md px-5 py-2.5 text-sm whitespace-nowrap">
          + Submit a skill
        </Link>
      </div>

      <div className="mt-10 flex items-baseline justify-between gap-4 flex-wrap border-b border-[color:var(--border)] pb-3">
        <div className="flex items-center gap-5 mono text-[12px]">
          <Link href="/" className="text-[color:var(--fg-muted)] hover:text-[color:var(--fg)] transition">
            all
          </Link>
          <Link
            href="/budget"
            className={
              active === "budget"
                ? "text-[color:var(--accent)] underline underline-offset-4 decoration-1"
                : "text-[color:var(--accent)]/80 hover:text-[color:var(--accent)] transition"
            }
          >
            budget
          </Link>
          <Link
            href="/mcps"
            className={
              active === "mcps"
                ? "text-[color:var(--accent)] underline underline-offset-4 decoration-1"
                : "text-[color:var(--accent)]/80 hover:text-[color:var(--accent)] transition"
            }
          >
            mcps
          </Link>
        </div>
        <span className="mono text-[11px] text-[color:var(--fg-dim)] tabular-nums">
          {countLabel}
        </span>
      </div>
    </>
  );
}

function CollectionTable({ entries }: { entries: CollectionEntry[] }) {
  return (
    <div className="mt-6">
      <div className="hidden sm:grid grid-cols-[2.5ch_minmax(0,1.3fr)_minmax(0,0.82fr)_minmax(180px,0.7fr)] gap-x-6 mono text-[10px] uppercase tracking-[0.2em] text-[color:var(--fg-dim)] pb-2 border-b border-[color:var(--border)]">
        <span className="text-right">#</span>
        <span>name</span>
        <span>source</span>
        <span className="text-right">proof</span>
      </div>
      {entries.map((entry, i) => (
        <div
          key={entry.name}
          id={entry.name.replace(/^\//, "").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}
          className="grid sm:grid-cols-[2.5ch_minmax(0,1.3fr)_minmax(0,0.82fr)_minmax(180px,0.7fr)] gap-x-6 gap-y-2 py-3 border-b border-[color:var(--border)] hover:bg-[color:var(--bg-elevated)]/50 transition group scroll-mt-20"
        >
          <span className="mono text-[12px] text-[color:var(--fg-dim)] tabular-nums text-right self-start mt-1">
            {i + 1}
          </span>
          <Link href={entry.href} className="min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="mono text-[14px] text-[color:var(--fg)] group-hover:text-[color:var(--accent)] transition truncate">
                {entry.name}
              </span>
              <span className="mono text-[10px] text-[color:var(--fg-dim)] uppercase tracking-wider">
                {entry.audience}
              </span>
              <span className="mono text-[10px] text-[color:var(--fg-dim)] uppercase tracking-wider">
                {entry.category}
              </span>
            </div>
            <div className="text-[12px] text-[color:var(--fg-muted)] line-clamp-1 mt-0.5">
              {entry.description}
            </div>
          </Link>
          <div className="mono text-[11px] text-[color:var(--fg-dim)] truncate self-start mt-1">
            <div className="truncate">{entry.source}</div>
            {entry.repoUrl && (
              <GithubLink
                href={entry.repoUrl}
                slug={entry.name}
                className="inline-flex max-w-full items-center gap-1.5 text-[color:var(--fg-muted)] hover:text-[color:var(--accent)] transition"
                title={`★ ${entry.stars ?? 0} on ${new URL(entry.repoUrl).pathname.replace(/^\//, "")}`}
              >
                <GithubIcon className="text-[13px] shrink-0" />
                <span className="truncate">
                  {new URL(entry.repoUrl).pathname.replace(/^\//, "").replace(/\/$/, "")}
                </span>
              </GithubLink>
            )}
          </div>
          <div className="flex flex-wrap justify-start sm:justify-end gap-1.5 self-start">
            <ProofSignal hot href={entry.href}>
              {entry.href.startsWith("/marketplace/") ? "inspect" : "open"}
            </ProofSignal>
            {entry.videoCount ? <ProofSignal>{entry.videoCount} video</ProofSignal> : null}
            {entry.stars != null && <ProofSignal>★ {formatStars(entry.stars)}</ProofSignal>}
          </div>
        </div>
      ))}
    </div>
  );
}

function ProofSignal({
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
