import Link from "next/link";
import { after } from "next/server";
import { headers } from "next/headers";
import { track } from "@/lib/metrics";
import { findApprovedByName, type MarketplaceEntry } from "@/lib/storage";
import { InstallCommand } from "@/components/InstallCommand";
import { GithubIcon } from "@/components/GithubIcon";
import { formatStars } from "@/lib/github";

export const dynamic = "force-dynamic";

export default async function PowerhousePage() {
  const h = await headers();
  after(() => track("powerhouse_view", { headers: h }));

  const [last72, last30, pp, htmle] = await Promise.all([
    findApprovedByName("last72hours"),
    findApprovedByName("last30days"),
    findApprovedByName("printingpress"),
    findApprovedByName("html-everything"),
  ]);

  return (
    <div className="max-w-4xl mx-auto px-6 pt-12 pb-24">
      <Link
        href="/"
        className="mono text-[12px] text-[color:var(--fg-muted)] hover:text-[color:var(--accent)]"
      >
        ← all skills
      </Link>

      <div className="mt-6 mono text-[11px] uppercase tracking-[0.2em] text-[color:var(--fg-dim)]">
        Powerhouse
      </div>
      <h1 className="text-3xl sm:text-4xl tracking-[-0.02em] font-semibold mt-2">
        Four skills that turn the agent into a research desk.
      </h1>
      <p className="text-[color:var(--fg-muted)] mt-3 leading-relaxed max-w-2xl">
        These don&apos;t shrink tokens — they expand what the agent can answer. Recency-grounded
        research from real posts, a generator that prints token-efficient CLIs from any API spec,
        and a one-shot blob-to-HTML packager. Install one curl, undo one rm.
      </p>

      <SkillEntry
        entry={pp}
        fallbackSlug="printingpress"
        title="printingpress"
        tagline="every API has a secret identity, this finds it"
        description="Generates a Go CLI + MCP server from an OpenAPI spec, HAR file, or live website — with local SQLite mirror, FTS5 search, and compound commands the underlying API can't answer natively."
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

      <SkillEntry
        entry={last72}
        fallbackSlug="last72hours"
        title="last72hours"
        tagline="what spiked in the last three days, with sources"
        description="72-hour viral radar across Reddit, X, TikTok, Instagram, Hacker News, YouTube, and GitHub — emits a clickable HTML brief plus an optional Paper.design leaderboard via MCP."
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

      <SkillEntry
        entry={last30}
        fallbackSlug="last30days"
        title="last30days"
        tagline="evidence-grounded synthesis, no model hallucination"
        description="Research what people actually said in the last ~30 days — pulls posts and engagement from Reddit, X, YouTube, TikTok, HN, Polymarket, GitHub, and the web, then synthesizes a brief with inline citations."
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

      <SkillEntry
        entry={htmle}
        fallbackSlug="html-everything"
        title="html-everything"
        tagline="markdown, json, plain text, or a url → one .html file"
        description="Any blob → one self-contained editorial HTML page with auto-linkified URLs, content-aware theming, and no external deps beyond Google Fonts."
        body={
          <>
            <p>
              Pass in Markdown, JSON, plain text, or a URL to a doc — get back a single
              self-contained HTML file with an editorial layout, content-aware theming, and every
              URL auto-linkified. No project scaffold, no build step, no API keys. The skill is a
              recipe Claude executes in-context — install is a symlink, uninstall is{" "}
              <span className="mono">rm</span>.
            </p>
            <p>
              Output uses Archivo Black for display, Inter Tight for body, JetBrains Mono for
              code. Styling subtly shifts based on detected content type — a market-cap rundown
              doesn&apos;t come out looking like a sports recap. Files land in{" "}
              <span className="mono">~/Documents/html-everything/</span> by default — override
              with <span className="mono">HTMLE_OUTPUT_DIR</span>.
            </p>
            <CodeBlock>
              {`# Install\ngit clone https://github.com/iharnoor/html-everything ~/Developer/html-everything\nln -s ~/Developer/html-everything/skills/html-everything ~/.claude/skills/html-everything`}
            </CodeBlock>
            <p className="mono text-[12px] text-[color:var(--fg-dim)] leading-relaxed">
              Trigger:{" "}
              <span className="text-[color:var(--accent)]">/html-everything &lt;path | json | url&gt;</span>
              . Omit the argument to paste content inline.
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
          <a href="#printingpress" className="text-[color:var(--accent)] underline underline-offset-4 decoration-1">printingpress</a>{" "}
          is the heavyweight: point it at an API and it prints you the CLI to talk to it without
          re-discovering its surface for every agent.{" "}
          <a href="#last72hours" className="text-[color:var(--accent)] underline underline-offset-4 decoration-1">last72hours</a>{" "}
          is for the immediate pulse — what spiked today.{" "}
          <a href="#last30days" className="text-[color:var(--accent)] underline underline-offset-4 decoration-1">last30days</a>{" "}
          is the wider lens — what the month has built. Both stay grounded in real posts with
          inline citations.{" "}
          <a href="#html-everything" className="text-[color:var(--accent)] underline underline-offset-4 decoration-1">html-everything</a>{" "}
          is the artifact step — whatever the others produced, it wraps into one shareable HTML
          file you can send.
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

/* ────────────────────────────────────────────────────────────────────────── */
/*  Entry component — mirror the marketplace skill page layout              */
/* ────────────────────────────────────────────────────────────────────────── */

function SkillEntry({
  entry,
  fallbackSlug,
  title,
  tagline,
  description,
  body,
}: {
  entry: MarketplaceEntry | null;
  fallbackSlug: string;
  title: string;
  tagline: string;
  description: string;
  body: React.ReactNode;
}) {
  const marketplaceHref = entry ? `/marketplace/${entry.id}` : `/i/${fallbackSlug}`;
  const audience = entry?.skill.audience;
  const category = entry?.skill.category;
  const repoUrl = entry?.skill.repoUrl;
  const stars = entry?.stars;
  const videoUrl = entry?.skill.videoUrls.find((u) => /\/v\/[\w.-]+\.mp4$/i.test(u));

  return (
    <section id={fallbackSlug} className="mt-14 scroll-mt-20">
      <div className="mono text-[11px] uppercase tracking-[0.2em] text-[color:var(--fg-dim)]">
        {tagline}
      </div>

      <div className="mt-3 flex items-center gap-2 flex-wrap">
        {audience && <span className="tag tag-accent">{audience}</span>}
        {category && <span className="tag">{category}</span>}
      </div>

      <h2 className="text-2xl sm:text-[28px] tracking-tight font-semibold mt-3 mono">
        {title}
      </h2>
      <p className="text-[color:var(--fg-muted)] text-[15px] mt-2 leading-relaxed">
        {description}
      </p>

      <div className="mt-3 flex items-center gap-3 flex-wrap text-[12px] mono">
        <Link
          href={marketplaceHref}
          className="text-[color:var(--accent)] hover:underline underline-offset-4 decoration-1"
        >
          marketplace/{fallbackSlug} →
        </Link>
        {repoUrl && (
          <a
            href={repoUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 btn-ghost rounded-md px-3 py-1.5 text-[12px] mono text-[color:var(--fg)] hover:text-[color:var(--accent)] transition"
            title="Open the upstream repository on GitHub"
          >
            <GithubIcon className="text-[14px]" />
            <span>{new URL(repoUrl).pathname.replace(/^\//, "").replace(/\/$/, "")}</span>
            {stars != null && (
              <span className="text-[color:var(--fg-muted)]">· ★ {formatStars(stars)}</span>
            )}
          </a>
        )}
      </div>

      {videoUrl ? (
        <div className="card p-4 mt-6">
          <div className="aspect-video rounded-md overflow-hidden border border-[color:var(--border)] bg-black">
            <video
              src={videoUrl}
              title={`${fallbackSlug} demo`}
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      ) : (
        <div className="card p-4 mt-6">
          <div className="aspect-video rounded-md overflow-hidden border border-[color:var(--border)] bg-black">
            <video
              src={`/v/${fallbackSlug}.mp4`}
              title={`${fallbackSlug} demo`}
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      )}

      <div className="card p-6 mt-5">
        <div className="mono text-[11px] uppercase tracking-[0.2em] text-[color:var(--fg-dim)] mb-3">
          One-line install
        </div>
        <InstallCommand skillName={fallbackSlug} />
      </div>

      <div className="text-[15px] text-[color:var(--fg-muted)] leading-relaxed space-y-3 mt-6">
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
