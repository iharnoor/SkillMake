import Link from "next/link";
import { after } from "next/server";
import { headers } from "next/headers";
import { track } from "@/lib/metrics";
import { findApprovedByName, type MarketplaceEntry } from "@/lib/storage";
import { InstallCommand } from "@/components/InstallCommand";
import { GithubIcon } from "@/components/GithubIcon";
import { formatStars } from "@/lib/github";

export const dynamic = "force-dynamic";

export default async function TricksPage() {
  const h = await headers();
  after(() => track("tricks_view", { headers: h }));

  const [caveman, fcc] = await Promise.all([
    findApprovedByName("caveman"),
    findApprovedByName("free-claude-code"),
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
        Tricks
      </div>
      <h1 className="text-3xl sm:text-4xl tracking-[-0.02em] font-semibold mt-2">
        Save tokens. Same agent.
      </h1>
      <p className="text-[color:var(--fg-muted)] mt-3 leading-relaxed max-w-2xl">
        Four ways to drop your Claude Code spend without trading away accuracy. Two ship as
        installable skills; two are pure technique — no install, no diff, you just use them.
      </p>

      <SkillEntry
        entry={caveman}
        fallbackSlug="caveman"
        title="caveman"
        tagline="why use many token when few do trick"
        description="Talk-like-caveman skill that drops filler and replies in technical fragments. ~65% output-token reduction across coding tasks, technical content intact."
        body={
          <>
            <p>
              Claude Code (and Codex / Gemini / Cursor / Windsurf / Cline / Copilot — 30+ agents)
              skill that drops filler and replies in technical fragments. Average{" "}
              <strong>65% output-token reduction</strong> across coding tasks, with the technical
              content intact. <em>Brain still big. Mouth small.</em>
            </p>
            <p>
              Levels: <span className="mono">lite</span> · <span className="mono">full</span>{" "}
              (default) · <span className="mono">ultra</span> ·{" "}
              <span className="mono">wenyan</span>. Plus sub-skills for commit messages, PR
              reviews, session stats, and a <span className="mono">/caveman-compress</span> that
              rewrites CLAUDE.md / memory files for ~46% input-token savings every session —
              savings stack forever, not just per reply.
            </p>
            <CodeBlock>
              {`# Mac / Linux / WSL / Git Bash\ncurl -fsSL https://raw.githubusercontent.com/JuliusBrussee/caveman/main/install.sh | bash`}
            </CodeBlock>
            <CodeBlock>{`# Windows (PowerShell 5.1+)\nirm https://raw.githubusercontent.com/JuliusBrussee/caveman/main/install.ps1 | iex`}</CodeBlock>
            <p className="mono text-[12px] text-[color:var(--fg-dim)] leading-relaxed">
              Trigger: type <span className="text-[color:var(--accent)]">/caveman</span> or say
              &ldquo;talk like caveman&rdquo;. Stop with{" "}
              <span className="text-[color:var(--accent)]">normal mode</span>. Statusline shows{" "}
              <span className="text-[color:var(--accent)]">[CAVEMAN] ⛏ 12.4k</span> lifetime
              tokens saved.
            </p>
          </>
        }
      />

      <SkillEntry
        entry={fcc}
        fallbackSlug="free-claude-code"
        title="free-claude-code"
        tagline="same client, different model bill"
        description="Local proxy that speaks the Anthropic Messages API to Claude Code and routes each request to a free or cheap provider — NVIDIA NIM, Kimi, Wafer, OpenRouter, DeepSeek, LM Studio, llama.cpp, or Ollama."
        body={
          <>
            <p>
              Local proxy that speaks the Anthropic Messages API to Claude Code and translates each
              request to whichever provider you configure — NVIDIA NIM (free key), Kimi, Wafer,
              OpenRouter, DeepSeek, LM Studio, llama.cpp, or Ollama. Claude Code itself doesn&apos;t
              change. Streaming, tool use, reasoning blocks all work.
            </p>
            <p>
              Per-tier routing means <span className="mono">MODEL_OPUS</span>,{" "}
              <span className="mono">MODEL_SONNET</span>, and{" "}
              <span className="mono">MODEL_HAIKU</span> can each point at a different backend —
              cheap defaults, premium fallback. Local Admin UI at{" "}
              <span className="mono">/admin</span> handles keys without an env-var dance.
            </p>
            <CodeBlock>
              {`# 1. install Claude Code (the real one)\nnpm install -g @anthropic-ai/claude-code\n\n# 2. install uv + Python 3.14 (macOS / Linux)\ncurl -LsSf https://astral.sh/uv/install.sh | sh\nuv python install 3.14\n\n# 3. install the proxy\nuv tool install --force git+https://github.com/Alishahryar1/free-claude-code.git\n\n# 4. start it\nfcc-server\n#    → http://127.0.0.1:8082/admin (paste your NVIDIA NIM key)\n\n# 5. launch Claude Code through the proxy\nfcc-claude`}
            </CodeBlock>
            <p className="mono text-[12px] text-[color:var(--fg-dim)] leading-relaxed">
              Admin UI is loopback-only by design — don&apos;t tunnel it without auth in front.
              Discord / Telegram bot wrappers and Whisper voice transcription are optional extras.
            </p>
          </>
        }
      />

      <ConceptEntry
        title="fan out subagents"
        tagline="parallel context-isolated work"
        description="Spawn multiple Task subagents in a single message. Each runs in its own context window, so the parent doesn't pay for every grep — and independent work actually runs concurrently."
        body={
          <>
            <p>
              The single biggest accuracy + cost win in long sessions: when work is independent,
              send one message with <em>multiple</em> <span className="mono">Task</span> tool
              blocks. Each subagent gets a fresh context, returns just a summary, and the parent
              context stays clean.
            </p>
            <p>
              Anti-patterns this kills:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 marker:text-[color:var(--fg-dim)]">
              <li>
                <strong>Sequential greps</strong> — three back-to-back <span className="mono">grep</span>{" "}
                calls in the parent burn three round-trips of full context. One fan-out = one
                round-trip plus three short summaries.
              </li>
              <li>
                <strong>Long investigations in the parent</strong> — a 30-file walk inflates the
                parent transcript forever. The subagent reads 30 files, returns one paragraph; the
                parent never saw the noise.
              </li>
              <li>
                <strong>One-after-another research</strong> — independent queries done serially
                wait on each other. Fan-out runs them at the same wall-clock minute.
              </li>
            </ul>
            <CodeBlock>
              {`# Mental model — single message, N tool calls, all run in parallel\n\nAgent: [Task: search for hooks usage] [Task: search for context usage] [Task: search for ref usage]\n\n# vs. the slow / context-hungry version:\n\nAgent: [Task: search for hooks usage]\n  → result\nAgent: [Task: search for context usage]\n  → result\nAgent: [Task: search for ref usage]\n  → result`}
            </CodeBlock>
            <p className="mono text-[12px] text-[color:var(--fg-dim)] leading-relaxed">
              Heuristic: if you&apos;d open three terminal tabs to do it, fan it out. If the next
              step depends on the previous result, don&apos;t — that&apos;s sequential by nature.
            </p>
          </>
        }
      />

      <ConceptEntry
        title="/goal"
        tagline="write the goal, refer back, stop drifting"
        description="Start the session by asking the agent to write down the explicit goal + success criteria + non-goals. Pin it. Refer back when scope creeps."
        body={
          <>
            <p>
              The agent will happily follow you into yak-shaving for an hour. The trick is to make
              it write the goal <em>before</em> doing any work — and then make it check itself
              against that goal at every meaningful branch point.
            </p>
            <p>
              Concretely: at the top of a non-trivial session, ask for a 3-line statement of (a)
              what done looks like, (b) what we&apos;re intentionally <em>not</em> doing, and (c)
              the riskiest unknown. Save that to a scratch file or pin it in the prompt. When the
              agent proposes a fourth tangent, paste the goal back as a one-liner — drift
              disappears.
            </p>
            <CodeBlock>
              {`# Use at the top of a session\n\nYou: /goal — write our explicit goal, success criteria, and non-goals\n     for this session before we start.\n\nAgent: GOAL\n         Ship the /powerhouse page with 4 skill blocks + videos.\n       SUCCESS\n         - /powerhouse renders, MP4s autoplay, marketplace links resolve\n         - typecheck clean\n         - deployed to skillmake.xyz\n       NON-GOALS\n         - reworking the global header (separate task)\n         - publishing to hyperframes.dev cloud\n       RISKIEST UNKNOWN\n         - whether the existing build-and-publish-demos.mjs handles\n           non-mp- seeds without code changes`}
            </CodeBlock>
            <p className="mono text-[12px] text-[color:var(--fg-dim)] leading-relaxed">
              Pair with <Link href="#fan-out-subagents" className="text-[color:var(--accent)] underline underline-offset-4 decoration-1">fan out subagents</Link>{" "}
              — once the goal is locked, you can confidently send independent pieces of it to
              parallel subagents without losing the thread.
            </p>
          </>
        }
      />

      <section className="mt-16">
        <h2 className="text-xl font-semibold tracking-tight mb-4 flex items-center gap-2">
          <span className="dot" />
          Stack the wins
        </h2>
        <p className="text-[15px] text-[color:var(--fg-muted)] leading-relaxed">
          The four compose cleanly.{" "}
          <a href="#caveman" className="text-[color:var(--accent)] underline underline-offset-4 decoration-1">caveman</a>{" "}
          cuts ~65% of <em>output</em> tokens at the model;{" "}
          <a href="#free-claude-code" className="text-[color:var(--accent)] underline underline-offset-4 decoration-1">free-claude-code</a>{" "}
          changes who you&apos;re paying for those tokens at all;{" "}
          <a href="#fan-out-subagents" className="text-[color:var(--accent)] underline underline-offset-4 decoration-1">fan out subagents</a>{" "}
          stops the parent context from inflating in the first place; and{" "}
          <a href="#goal" className="text-[color:var(--accent)] underline underline-offset-4 decoration-1">/goal</a>{" "}
          keeps the whole stack pointed at the right target.
        </p>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold tracking-tight mb-4 flex items-center gap-2">
          <span className="dot" />
          Got another trick?
        </h2>
        <p className="text-[15px] text-[color:var(--fg-muted)] leading-relaxed">
          If you&apos;ve found a token-saver worth shipping —{" "}
          <Link href="/submit" className="text-[color:var(--accent)] underline underline-offset-4 decoration-1">submit it</Link>
          . Same curation pipeline as the rest of the marketplace.
        </p>
      </section>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Entry components — mirror the marketplace skill page layout              */
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
  const anchorId = fallbackSlug;

  return (
    <section id={anchorId} className="mt-14 scroll-mt-20">
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

      {videoUrl && (
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

function ConceptEntry({
  title,
  tagline,
  description,
  body,
}: {
  title: string;
  tagline: string;
  description: string;
  body: React.ReactNode;
}) {
  const anchorId = title.replace(/^\//, "").replace(/[^a-z0-9]+/gi, "-").toLowerCase();

  return (
    <section id={anchorId} className="mt-14 scroll-mt-20">
      <div className="mono text-[11px] uppercase tracking-[0.2em] text-[color:var(--fg-dim)]">
        {tagline}
      </div>

      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <span className="tag tag-accent">concept</span>
        <span className="tag">technique</span>
      </div>

      <h2 className="text-2xl sm:text-[28px] tracking-tight font-semibold mt-3 mono">
        {title}
      </h2>
      <p className="text-[color:var(--fg-muted)] text-[15px] mt-2 leading-relaxed">
        {description}
      </p>

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
