import Link from "next/link";
import { after } from "next/server";
import { headers } from "next/headers";
import { track } from "@/lib/metrics";
import { findApprovedByName } from "@/lib/storage";

export const dynamic = "force-dynamic";

async function marketplaceHref(name: string): Promise<string> {
  const entry = await findApprovedByName(name);
  return entry ? `/marketplace/${entry.id}` : `/i/${name}`;
}

export default async function PowerhousePage() {
  const h = await headers();
  after(() => track("powerhouse_view", { headers: h }));

  const [last72Href, last30Href, ppHref] = await Promise.all([
    marketplaceHref("last72hours"),
    marketplaceHref("last30days"),
    marketplaceHref("printingpress"),
  ]);

  return (
    <div className="max-w-3xl mx-auto px-6 pt-16 pb-24">
      <div className="mono text-[11px] uppercase tracking-[0.2em] text-[color:var(--fg-dim)] mb-2">
        Powerhouse
      </div>
      <h1 className="text-3xl sm:text-4xl tracking-[-0.02em] font-semibold">
        Three skills that turn the agent into a research desk.
      </h1>
      <p className="text-[color:var(--fg-muted)] mt-3 leading-relaxed">
        These don&apos;t shrink tokens — they expand what the agent can answer. Recency-grounded
        research from real posts, and a generator that prints token-efficient CLIs from any API
        spec. Install one curl, undo one rm.
      </p>

      <Skill
        index={1}
        slug="last72hours"
        marketplaceHref={last72Href}
        video="/v/last72hours.mp4"
        title="last72hours — 72-hour viral radar across 7 platforms"
        tagline="what spiked in the last three days, with sources"
        repo="https://github.com/iharnoor/last72hours-skill"
        body={
          <>
            <p>
              Scrapes Reddit, X, TikTok, Instagram, Hacker News, YouTube, and GitHub for the last
              72 hours on any topic, then emits a self-contained HTML brief with clickable source
              links and engagement counts. Optional: builds an editorial-scorecard leaderboard
              artboard in Paper.design via MCP.
            </p>
            <p>
              Reddit / HN / YouTube / GitHub are free. X works with browser cookies (no API key).
              Instagram + TikTok use ScrapeCreators credits — or skip them entirely with the
              bundled <span className="mono">last72-reddit-x</span> subagent for a free Reddit + X
              pulse.
            </p>
            <CodeBlock>
              {`# 1. Install the upstream last30days engine first\ngit clone https://github.com/mvanhorn/last30days-skill ~/.last30days-skill\nln -s ~/.last30days-skill/skills/last30days ~/.claude/skills/last30days\n\n# 2. Install last72hours\ngit clone https://github.com/iharnoor/last72hours-skill ~/.last72hours-skill\nln -s ~/.last72hours-skill/skills/last72hours ~/.claude/skills/last72hours`}
            </CodeBlock>
            <p className="mono text-[12px] text-[color:var(--fg-dim)] leading-relaxed">
              Trigger: <span className="text-[color:var(--accent)]">/last72hours &lt;topic&gt;</span>.
              Output lands in <span className="text-[color:var(--accent)]">~/Documents/Last72Hours</span>{" "}
              (override with <span className="mono">LAST72_OUTPUT_DIR</span>).
            </p>
          </>
        }
      />

      <Skill
        index={2}
        slug="last30days"
        marketplaceHref={last30Href}
        video="/v/last30days.mp4"
        title="last30days — research what people actually said in the last 30 days"
        tagline="evidence-grounded synthesis, no model hallucination"
        repo="https://github.com/mvanhorn/last30days-skill"
        body={
          <>
            <p>
              A wider time window built around the same evidence-grounded pattern. The reasoning
              model plans the JSON query upstream; the engine sweeps Reddit, X, YouTube, TikTok,
              Instagram, Hacker News, Polymarket, Bluesky, GitHub, and the web for the last ~30
              days; synthesis cites every quote with inline markdown links.
            </p>
            <p>
              Eight output LAWs govern the synthesis — no trailing{" "}
              <span className="mono">Sources:</span> block, no invented title, no em-dashes, no
              raw evidence dumps. The badge IS the title:{" "}
              <span className="mono">🌐 last30days v&lt;v&gt; · synced &lt;YYYY-MM-DD&gt;</span>.
              Supports a <span className="mono">COMPARISON</span> template for{" "}
              <span className="mono">X vs Y</span> queries.
            </p>
            <CodeBlock>
              {`# Install\ngit clone https://github.com/mvanhorn/last30days-skill ~/.last30days-skill\nln -s ~/.last30days-skill/skills/last30days ~/.claude/skills/last30days`}
            </CodeBlock>
            <p className="mono text-[12px] text-[color:var(--fg-dim)] leading-relaxed">
              Trigger: <span className="text-[color:var(--accent)]">/last30days &lt;topic&gt;</span>.
              Named entities require <span className="mono">--plan</span> — the host model
              generates the JSON plan, the engine executes it.
            </p>
          </>
        }
      />

      <Skill
        index={3}
        slug="printingpress"
        marketplaceHref={ppHref}
        video="/v/printingpress.mp4"
        title="printingpress — print the best agent-designed CLI of all time"
        tagline="every API has a secret identity, this finds it"
        repo="https://github.com/mvanhorn/cli-printing-press"
        body={
          <>
            <p>
              Generates a Go CLI + MCP server from an OpenAPI spec, HAR file, or live website. The
              output isn&apos;t a passthrough wrapper — it&apos;s a domain-shaped CLI with a local
              SQLite mirror, FTS5 search, and compound commands like{" "}
              <span className="mono">stale</span>, <span className="mono">orphans</span>,{" "}
              <span className="mono">health</span>, <span className="mono">similar</span>, and{" "}
              <span className="mono">bottleneck</span> that the underlying API can&apos;t answer
              natively.
            </p>
            <p>
              Every generated CLI auto-emits JSON when piped, ships a{" "}
              <span className="mono">--compact</span> mode (60–80% fewer tokens), exposes typed
              exit codes, and supports <span className="mono">--dry-run</span>. Four verification
              gates — scorecard, dogfood, proof-of-behavior, live smoke — gate ship-readiness. No
              spec? Drive the site in a browser and the press infers the API from captured HAR.
            </p>
            <CodeBlock>
              {`# 1. Install the binary (Go 1.26.3+)\ngo install github.com/mvanhorn/cli-printing-press/v4/cmd/printing-press@latest\n\n# 2. Install the skills (recommended)\ngit clone https://github.com/mvanhorn/cli-printing-press.git\nclaude --plugin-dir .\n\n# Or starter pack via npx\nnpx -y @mvanhorn/printing-press install starter-pack`}
            </CodeBlock>
            <p className="mono text-[12px] text-[color:var(--fg-dim)] leading-relaxed">
              Trigger:{" "}
              <span className="text-[color:var(--accent)]">/printing-press &lt;app-name | url&gt;</span>
              . Reprint / polish / publish slash commands handle regen, fixes, and library
              publishing.
            </p>
          </>
        }
      />

      <section className="mt-16">
        <h2 className="text-xl font-semibold tracking-tight mb-4 flex items-center gap-2">
          <span className="dot" />
          How they compose
        </h2>
        <p className="text-[15px] text-[color:var(--fg-muted)] leading-relaxed">
          <Link href={last72Href} className="text-[color:var(--accent)] underline underline-offset-4 decoration-1">last72hours</Link>{" "}
          is for the immediate pulse — what spiked today.{" "}
          <Link href={last30Href} className="text-[color:var(--accent)] underline underline-offset-4 decoration-1">last30days</Link>{" "}
          is the wider lens — what the month has built. Both stay grounded in real posts with
          inline citations.{" "}
          <Link href={ppHref} className="text-[color:var(--accent)] underline underline-offset-4 decoration-1">printingpress</Link>{" "}
          is orthogonal: once you&apos;ve identified the system worth integrating with, it prints
          you the CLI to talk to it without re-discovering its surface for every agent.
        </p>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold tracking-tight mb-4 flex items-center gap-2">
          <span className="dot" />
          Got a research-grade skill?
        </h2>
        <p className="text-[15px] text-[color:var(--fg-muted)] leading-relaxed">
          If you&apos;ve built a skill that expands what the agent can answer rather than how
          cheaply it can answer it —{" "}
          <Link href="/submit" className="text-[color:var(--accent)] underline underline-offset-4 decoration-1">submit it</Link>
          . Same curation pipeline as the rest of the marketplace.
        </p>
      </section>
    </div>
  );
}

function Skill({
  index,
  slug,
  marketplaceHref,
  video,
  title,
  tagline,
  repo,
  body,
}: {
  index: number;
  slug: string;
  marketplaceHref: string;
  video: string;
  title: string;
  tagline: string;
  repo: string;
  body: React.ReactNode;
}) {
  return (
    <section className="mt-14">
      <div className="flex items-baseline gap-3 mono text-[11px] uppercase tracking-[0.2em] text-[color:var(--fg-dim)]">
        <span>#{index.toString().padStart(2, "0")}</span>
        <span>·</span>
        <span>{tagline}</span>
      </div>
      <h2 className="text-2xl sm:text-[28px] tracking-tight font-semibold mt-2">{title}</h2>
      <div className="mt-3 flex items-center gap-3 flex-wrap text-[12px] mono">
        <Link
          href={marketplaceHref}
          className="text-[color:var(--accent)] hover:underline underline-offset-4 decoration-1"
        >
          marketplace/{slug} →
        </Link>
        <span className="text-[color:var(--fg-dim)]">·</span>
        <a
          href={repo}
          target="_blank"
          rel="noreferrer"
          className="text-[color:var(--fg-muted)] hover:text-[color:var(--fg)] transition"
        >
          {repo.replace(/^https:\/\/github\.com\//, "")} ↗
        </a>
      </div>
      <div className="aspect-video rounded-md overflow-hidden border border-[color:var(--border)] bg-black mt-5">
        <video
          src={video}
          title={`${slug} demo`}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          className="w-full h-full object-cover"
        />
      </div>
      <div className="text-[15px] text-[color:var(--fg-muted)] leading-relaxed space-y-3 mt-5">
        {body}
      </div>
    </section>
  );
}

function CodeBlock({ children }: { children: React.ReactNode }) {
  return (
    <pre className="mono text-[12px] leading-relaxed whitespace-pre-wrap break-all bg-[color:var(--bg-elevated)] border border-[color:var(--border)] rounded-md px-4 py-3 my-3 text-[color:var(--fg)]">
      {children}
    </pre>
  );
}
