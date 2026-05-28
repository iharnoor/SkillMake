"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { GithubIcon } from "@/components/GithubIcon";
import { GithubLink } from "@/components/OutboundLink";
import { formatStars } from "@/lib/github";

export interface CollectionEntry {
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

type Tab = "powerhouse" | "famous";

const TAB_DESCRIPTIONS: Record<Tab, string> = {
  powerhouse: "Curated MCPs and MCP-adjacent skills that unlock practical agent workflows right now.",
  famous: "High-adoption, name-brand MCPs worth adding next. These link to source until they are promoted into full SkillMake seeds.",
};

export function McpsSections({
  powerhouseEntries,
  famousEntries,
}: {
  powerhouseEntries: CollectionEntry[];
  famousEntries: CollectionEntry[];
}) {
  const [activeTab, setActiveTab] = useState<Tab>("powerhouse");

  useEffect(() => {
    const hash = window.location.hash.replace("#", "") as Tab;
    if (hash === "famous" || hash === "powerhouse") setActiveTab(hash);
  }, []);

  function switchTab(tab: Tab) {
    setActiveTab(tab);
    history.replaceState(null, "", `#${tab}`);
  }

  const entries = activeTab === "powerhouse" ? powerhouseEntries : famousEntries;

  return (
    <>
      <div className="mt-6 flex items-baseline justify-between gap-4 flex-wrap border-b border-[color:var(--border)] pb-3">
        <div className="flex items-center gap-5 mono text-[12px]">
          <button
            onClick={() => switchTab("powerhouse")}
            className={
              activeTab === "powerhouse"
                ? "text-[color:var(--accent)] underline underline-offset-4 decoration-1"
                : "text-[color:var(--accent)]/80 hover:text-[color:var(--accent)] transition"
            }
          >
            powerhouse
          </button>
          <button
            onClick={() => switchTab("famous")}
            className={
              activeTab === "famous"
                ? "text-[color:var(--accent)] underline underline-offset-4 decoration-1"
                : "text-[color:var(--accent)]/80 hover:text-[color:var(--accent)] transition"
            }
          >
            famous
          </button>
        </div>
        <span className="mono text-[11px] text-[color:var(--fg-dim)] tabular-nums">
          {entries.length} shown
        </span>
      </div>

      <p className="text-[13px] text-[color:var(--fg-muted)] leading-relaxed mt-3 mb-1 max-w-3xl">
        {TAB_DESCRIPTIONS[activeTab]}
      </p>

      <CollectionTable entries={entries} />
    </>
  );
}

function CollectionTable({ entries }: { entries: CollectionEntry[] }) {
  return (
    <div className="mt-4">
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
