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

export default async function PowerhousePage() {
  const h = await headers();
  after(() => track("powerhouse_view", { headers: h }));

  const [htmlEverything, last72, last30, printingPress, codexPlugin] = await Promise.all([
    findApprovedByName("html-everything"),
    findApprovedByName("last72hours"),
    findApprovedByName("last30days"),
    findApprovedByName("printingpress"),
    findApprovedByName("codex-plugin-cc"),
  ]);

  const entries: CollectionEntry[] = [
    skillRow(
      htmlEverything,
      "html-everything",
      "Any blob becomes one self-contained editorial HTML page with auto-linkified URLs, content-aware styling, and no build step."
    ),
    skillRow(
      last72,
      "last72hours",
      "A 72-hour viral radar across social platforms, newsy communities, and code sources with clickable evidence."
    ),
    skillRow(
      last30,
      "last30days",
      "Research what people actually said in the last month, then synthesize it with inline citations."
    ),
    skillRow(
      printingPress,
      "printingpress",
      "Generate an agent-native Go CLI and MCP server from an API spec, HAR file, or live website."
    ),
    skillRow(
      codexPlugin,
      "codex-plugin-cc",
      "Bring Codex into Claude Code for reviews, adversarial pressure-testing, and delegated rescue tasks."
    ),
  ];

  return (
    <div className="max-w-5xl mx-auto px-6 pt-12 pb-24">
      <CollectionHeader
        active="powerhouse"
        eyebrow="Powerhouse"
        title="Five skills that turn the agent into a research desk."
        description="Recency-grounded research, API-to-tool generation, one-shot HTML packaging, and a Codex bridge. Big leverage, same browsing surface."
        countLabel={`${entries.length} powerhouse`}
      />
      <CollectionTable entries={entries} />

      <section className="mt-16 border-t border-[color:var(--border)] pt-6">
        <h2 className="mono text-[11px] uppercase tracking-[0.2em] text-[color:var(--fg-dim)]">
          How they compose
        </h2>
        <p className="text-[15px] text-[color:var(--fg-muted)] leading-relaxed mt-3 max-w-3xl">
          <a
            href="#printingpress"
            className="text-[color:var(--accent)] underline underline-offset-4 decoration-1"
          >
            printingpress
          </a>{" "}
          gives the agent a real tool for an API,{" "}
          <a
            href="#last72hours"
            className="text-[color:var(--accent)] underline underline-offset-4 decoration-1"
          >
            last72hours
          </a>{" "}
          and{" "}
          <a
            href="#last30days"
            className="text-[color:var(--accent)] underline underline-offset-4 decoration-1"
          >
            last30days
          </a>{" "}
          supply fresh evidence,{" "}
          <a
            href="#html-everything"
            className="text-[color:var(--accent)] underline underline-offset-4 decoration-1"
          >
            html-everything
          </a>{" "}
          turns the output into something shareable, and{" "}
          <a
            href="#codex-plugin-cc"
            className="text-[color:var(--accent)] underline underline-offset-4 decoration-1"
          >
            codex-plugin-cc
          </a>{" "}
          adds a second engineering reviewer when the work gets risky.
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
