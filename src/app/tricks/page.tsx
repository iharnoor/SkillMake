import Link from "next/link";
import { after } from "next/server";
import { headers } from "next/headers";
import { track } from "@/lib/metrics";
import { findApprovedByName } from "@/lib/storage";

export const dynamic = "force-dynamic";

// Marketplace ids are `<name>-<hash8>`, so we resolve the live id by name.
// If the seed hasn't been pushed to the marketplace yet (id === null), the
// component falls back to /i/<name> — the install URL still works as a
// destination even before the marketplace page is wired up.
async function marketplaceHref(name: string): Promise<string> {
  const entry = await findApprovedByName(name);
  return entry ? `/marketplace/${entry.id}` : `/i/${name}`;
}

export default async function TricksPage() {
  const h = await headers();
  after(() => track("tricks_view", { headers: h }));

  const [cavemanHref, fccHref] = await Promise.all([
    marketplaceHref("caveman"),
    marketplaceHref("free-claude-code"),
  ]);

  return (
    <div className="max-w-3xl mx-auto px-6 pt-16 pb-24">
      <div className="mono text-[11px] uppercase tracking-[0.2em] text-[color:var(--fg-dim)] mb-2">
        Tricks
      </div>
      <h1 className="text-3xl sm:text-4xl tracking-[-0.02em] font-semibold">
        Save tokens. Same agent.
      </h1>
      <p className="text-[color:var(--fg-muted)] mt-3 leading-relaxed">
        Two installable tricks that drop your Claude Code spend without trading away accuracy.
        Both ship as skills in the marketplace — install with one curl, undo with one rm.
      </p>

      <Trick
        index={1}
        slug="caveman"
        marketplaceHref={cavemanHref}
        title="caveman — talk like caveman, save 65% of output tokens"
        tagline="why use many token when few do trick"
        repo="https://github.com/JuliusBrussee/caveman"
        stars="58k ★"
        body={
          <>
            <p>
              Claude Code (and Codex / Gemini / Cursor / Windsurf / Cline / Copilot — 30+ agents)
              skill that drops filler and replies in technical fragments. Average{" "}
              <strong>65% output-token reduction</strong> across coding tasks, with the
              technical content intact. <em>Brain still big. Mouth small.</em>
            </p>
            <p>
              Levels: <span className="mono">lite</span> · <span className="mono">full</span>{" "}
              (default) · <span className="mono">ultra</span> ·{" "}
              <span className="mono">wenyan</span>. Plus sub-skills for commit messages, PR
              reviews, session stats, and a <span className="mono">/caveman-compress</span>{" "}
              that rewrites CLAUDE.md / memory files for ~46% input-token savings every
              session — savings stack forever, not just per reply.
            </p>
            <CodeBlock>
              {`# Mac / Linux / WSL / Git Bash\ncurl -fsSL https://raw.githubusercontent.com/JuliusBrussee/caveman/main/install.sh | bash`}
            </CodeBlock>
            <CodeBlock>{`# Windows (PowerShell 5.1+)\nirm https://raw.githubusercontent.com/JuliusBrussee/caveman/main/install.ps1 | iex`}</CodeBlock>
            <p className="mono text-[12px] text-[color:var(--fg-dim)] leading-relaxed">
              Trigger: type <span className="text-[color:var(--accent)]">/caveman</span> or
              say &ldquo;talk like caveman&rdquo;. Stop with{" "}
              <span className="text-[color:var(--accent)]">normal mode</span>. Statusline shows{" "}
              <span className="text-[color:var(--accent)]">[CAVEMAN] ⛏ 12.4k</span> lifetime
              tokens saved.
            </p>
          </>
        }
      />

      <Trick
        index={2}
        slug="free-claude-code"
        marketplaceHref={fccHref}
        title="free-claude-code — route Claude Code through a free backend"
        tagline="same client, different model bill"
        repo="https://github.com/Alishahryar1/free-claude-code"
        stars="23k ★"
        body={
          <>
            <p>
              Local proxy that speaks the Anthropic Messages API to Claude Code and translates
              each request to whichever provider you configure — NVIDIA NIM (free key),
              Kimi, Wafer, OpenRouter, DeepSeek, LM Studio, llama.cpp, or Ollama. Claude
              Code itself doesn&apos;t change. Streaming, tool use, reasoning blocks all work.
            </p>
            <p>
              Per-tier routing means <span className="mono">MODEL_OPUS</span>,{" "}
              <span className="mono">MODEL_SONNET</span>, and{" "}
              <span className="mono">MODEL_HAIKU</span> can each point at a different
              backend — cheap defaults, premium fallback. Local Admin UI at{" "}
              <span className="mono">/admin</span> handles keys without an env-var dance.
            </p>
            <CodeBlock>
              {`# 1. install Claude Code (the real one)\nnpm install -g @anthropic-ai/claude-code\n\n# 2. install uv + Python 3.14 (macOS / Linux)\ncurl -LsSf https://astral.sh/uv/install.sh | sh\nuv python install 3.14\n\n# 3. install the proxy\nuv tool install --force git+https://github.com/Alishahryar1/free-claude-code.git\n\n# 4. start it\nfcc-server\n#    → http://127.0.0.1:8082/admin (paste your NVIDIA NIM key)\n\n# 5. launch Claude Code through the proxy\nfcc-claude`}
            </CodeBlock>
            <p className="mono text-[12px] text-[color:var(--fg-dim)] leading-relaxed">
              Admin UI is loopback-only by design — don&apos;t tunnel it without auth in
              front. Discord / Telegram bot wrappers and Whisper voice transcription are
              optional extras.
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
          The two compose cleanly.{" "}
          <Link href={cavemanHref} className="text-[color:var(--accent)] underline underline-offset-4 decoration-1">caveman</Link>{" "}
          cuts ~65% of <em>output</em> tokens at the model;{" "}
          <Link href={fccHref} className="text-[color:var(--accent)] underline underline-offset-4 decoration-1">free-claude-code</Link>{" "}
          changes who you&apos;re paying for those tokens at all. Run the proxy with a free
          NVIDIA NIM key, install caveman on top, and you&apos;ve dropped both the rate and
          the volume.
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

function Trick({
  index,
  slug,
  marketplaceHref,
  title,
  tagline,
  repo,
  stars,
  body,
}: {
  index: number;
  slug: string;
  marketplaceHref: string;
  title: string;
  tagline: string;
  repo: string;
  stars: string;
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
        <span className="text-[color:var(--fg-dim)]">·</span>
        <span className="text-[color:var(--fg-muted)]">{stars}</span>
      </div>
      <div className="text-[15px] text-[color:var(--fg-muted)] leading-relaxed space-y-3 mt-4">
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
