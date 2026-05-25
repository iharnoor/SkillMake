import Link from "next/link";
import { after } from "next/server";
import { headers } from "next/headers";
import { track } from "@/lib/metrics";
import { findApprovedByName, type MarketplaceEntry } from "@/lib/storage";
import { GithubIcon } from "@/components/GithubIcon";
import { GithubLink } from "@/components/OutboundLink";
import { formatStars } from "@/lib/github";

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

export default async function TricksPage() {
  const h = await headers();
  after(() => track("tricks_view", { headers: h }));

  const [caveman, fcc] = await Promise.all([
    findApprovedByName("caveman"),
    findApprovedByName("free-claude-code"),
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
        active="tricks"
        eyebrow="Tricks"
        title="Save tokens. Same agent."
        description="Five practical ways to drop agent cost or context waste. Two are installable skills; three are pure technique."
        countLabel={`${entries.length} tricks`}
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
          changes the model bill,{" "}
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
  active: "tricks" | "powerhouse";
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
            href="/tricks"
            className={
              active === "tricks"
                ? "text-[color:var(--accent)] underline underline-offset-4 decoration-1"
                : "text-[color:var(--accent)]/80 hover:text-[color:var(--accent)] transition"
            }
          >
            tricks
          </Link>
          <Link
            href="/powerhouse"
            className={
              active === "powerhouse"
                ? "text-[color:var(--accent)] underline underline-offset-4 decoration-1"
                : "text-[color:var(--accent)]/80 hover:text-[color:var(--accent)] transition"
            }
          >
            powerhouse
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
            <ProofSignal>reviewed</ProofSignal>
            {entry.videoCount ? <ProofSignal>{entry.videoCount} video</ProofSignal> : null}
            {entry.repoUrl && <ProofSignal>source</ProofSignal>}
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
