import Link from "next/link";
import { after } from "next/server";
import { headers } from "next/headers";
import { track } from "@/lib/metrics";
import { findApprovedByName, type MarketplaceEntry } from "@/lib/storage";
import { GithubIcon } from "@/components/GithubIcon";
import { GithubLink } from "@/components/OutboundLink";
import { formatStars } from "@/lib/github";

export const dynamic = "force-dynamic";

// The four official Claude Code loop types. Reference content, not an
// installable skill — a loop is a pattern you compose from primitives
// (/goal, /loop, /schedule), so this page explains the types rather than
// shipping a SKILL.md. Source: Claude Code docs on loops.
const LOOP_TYPES = [
  {
    id: "turn-based",
    name: "Turn-based loop",
    triggeredBy: "A user prompt",
    stopWhen: "Claude judges the task done or needs more context",
    bestFor: "Shorter, one-off tasks that aren't part of a schedule",
    primitive: "the agentic loop (every prompt)",
    body:
      "Every prompt starts one: Claude gathers context, acts, checks its work, repeats if needed, and responds — then you verify and write the next prompt. Improve the verification step by encoding your manual checks as a SKILL.md (e.g. verify-frontend-change) so Claude can self-verify end-to-end. The more quantitative the checks, the fewer turns it takes.",
    example: null,
  },
  {
    id: "goal-based",
    name: "Goal-based loop",
    triggeredBy: "A manual prompt in real time",
    stopWhen: "The goal is achieved OR a max number of turns is reached",
    bestFor: "Tasks with verifiable exit criteria",
    primitive: "/goal",
    body:
      "Define what done looks like and Claude keeps iterating instead of stopping early on 'good enough.' Each time Claude tries to stop, an evaluator model checks your condition and sends it back to work until the goal is met or your turn cap is hit. Deterministic criteria — tests passed, a score threshold — work best.",
    example: "/goal get the homepage Lighthouse score to 90 or above, stop after 5 tries.",
  },
  {
    id: "time-based",
    name: "Time-based loop",
    triggeredBy: "A specified time interval",
    stopWhen: "You cancel it, or the work completes (PR merges, queue empties)",
    bestFor: "Recurring work, or interfacing with external systems",
    primitive: "/loop and /schedule",
    body:
      "Some work is recurring — the task stays the same and only the inputs change. Other work depends on an external system you check on an interval and react to. /loop re-runs a prompt on your machine (stop it by turning it off); move it to the cloud as a routine with /schedule. Manage usage with longer intervals or event-driven reactions.",
    example: "/loop 5m check my PR, address review comments, and fix failing CI",
  },
  {
    id: "proactive",
    name: "Proactive loop",
    triggeredBy: "An event or schedule, with no human in real time",
    stopWhen: "Each task exits when its goal is met; the routine runs until you turn it off",
    bestFor: "Recurring streams of well-defined work: bug reports, triage, migrations, upgrades",
    primitive: "/schedule + /goal + skills + dynamic workflows + auto mode",
    body:
      "Compose the primitives for long-running work: /schedule runs a routine that checks for new work, /goal defines done and skills document how to verify it, dynamic workflows orchestrate agents that triage and fix each item, and auto mode runs it without stopping for permission. Route routines to smaller, faster models and reserve the most capable model for judgment calls.",
    example:
      "/schedule every hour: check the project-feedback channel for bug reports. /goal: don't stop until every report found this run is triaged, actioned, and responded to. When fixing a bug, use a workflow to explore three solutions in parallel worktrees and have a judge adversarially review them.",
  },
] as const;

interface RelatedEntry {
  name: string;
  description: string;
  source: string;
  href: string;
  repoUrl?: string;
  stars?: number | null;
}

export default async function LoopsPage() {
  const h = await headers();
  after(() => track("loops_view", { headers: h }));

  const [superpowers, ralph, blindspot, scratchpad, simonw] = await Promise.all([
    findApprovedByName("superpowers"),
    findApprovedByName("ralph-loop"),
    findApprovedByName("agent-blindspot-questions"),
    findApprovedByName("hrishioa-scratchpad-loop"),
    findApprovedByName("simonw-agentic-patterns"),
  ]);

  const related: RelatedEntry[] = [superpowers, ralph, blindspot, scratchpad, simonw]
    .filter((e): e is MarketplaceEntry => Boolean(e))
    .map((e) => ({
      name: e.skill.name,
      description: e.skill.description,
      source: hostFromUrl(e.sourceUrl),
      href: `/marketplace/${e.id}`,
      repoUrl: e.skill.repoUrl,
      stars: e.stars,
    }));

  return (
    <div className="max-w-5xl mx-auto px-6 pt-12 pb-24">
      <Link
        href="/"
        className="mono text-[12px] text-[color:var(--fg-muted)] hover:text-[color:var(--accent)]"
      >
        ← all skills
      </Link>

      <div className="mt-6 mono text-[11px] uppercase tracking-[0.2em] text-[color:var(--fg-dim)]">
        Loops
      </div>
      <h1 className="mt-2 text-3xl sm:text-4xl tracking-[-0.02em] font-semibold">
        The four types of agent loops
      </h1>
      <p className="text-[color:var(--fg-muted)] mt-3 leading-relaxed max-w-2xl">
        A loop is an agent repeating cycles of work until a stop condition is met — not a skill you
        install. Loops are categorized by how they&apos;re triggered, how they&apos;re stopped, and
        which Claude Code primitive they use. Start with the simplest that fits; use these patterns
        selectively.
      </p>

      <div className="mt-10 space-y-4">
        {LOOP_TYPES.map((loop, i) => (
          <section
            key={loop.id}
            id={loop.id}
            className="card p-5 sm:p-6 scroll-mt-20"
          >
            <div className="flex items-baseline gap-3 flex-wrap">
              <span className="mono text-[12px] text-[color:var(--fg-dim)] tabular-nums">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">{loop.name}</h2>
              <span className="tag tag-accent">{loop.primitive}</span>
            </div>

            <p className="text-[15px] text-[color:var(--fg-muted)] leading-relaxed mt-3">
              {loop.body}
            </p>

            <dl className="mt-4 grid sm:grid-cols-3 gap-x-6 gap-y-3">
              <Meta label="triggered by" value={loop.triggeredBy} />
              <Meta label="stops when" value={loop.stopWhen} />
              <Meta label="best for" value={loop.bestFor} />
            </dl>

            {loop.example && (
              <pre className="mt-4 mono text-[11.5px] leading-relaxed text-[color:var(--fg)] whitespace-pre-wrap break-words bg-[color:var(--bg-elevated)] border border-[color:var(--border)] rounded-md p-3">
                {loop.example}
              </pre>
            )}
          </section>
        ))}
      </div>

      <section className="mt-16 border-t border-[color:var(--border)] pt-6">
        <h2 className="mono text-[11px] uppercase tracking-[0.2em] text-[color:var(--fg-dim)]">
          Loop tooling & patterns
        </h2>
        <p className="text-[15px] text-[color:var(--fg-muted)] leading-relaxed mt-3 max-w-3xl">
          Installable skills and community patterns that make loops reliable — methodologies,
          autonomous-loop frameworks, and self-audit prompts.
        </p>

        {related.length > 0 && (
          <div className="mt-6">
            {related.map((entry, i) => (
              <div
                key={entry.name}
                className="grid sm:grid-cols-[2.5ch_minmax(0,1.3fr)_minmax(180px,0.7fr)] gap-x-6 gap-y-2 py-3 border-b border-[color:var(--border)] hover:bg-[color:var(--bg-elevated)]/50 transition group"
              >
                <span className="mono text-[12px] text-[color:var(--fg-dim)] tabular-nums text-right self-start mt-1">
                  {i + 1}
                </span>
                <Link href={entry.href} className="min-w-0">
                  <span className="mono text-[14px] text-[color:var(--fg)] group-hover:text-[color:var(--accent)] transition">
                    {entry.name}
                  </span>
                  <div className="text-[12px] text-[color:var(--fg-muted)] line-clamp-2 mt-0.5">
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
                      title={`★ ${entry.stars ?? 0}`}
                    >
                      <GithubIcon className="text-[13px] shrink-0" />
                      <span className="truncate">
                        {new URL(entry.repoUrl).pathname.replace(/^\//, "").replace(/\/$/, "")}
                      </span>
                      {entry.stars != null && <span className="shrink-0">· ★ {formatStars(entry.stars)}</span>}
                    </GithubLink>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="mono text-[10px] uppercase tracking-[0.2em] text-[color:var(--fg-dim)]">
        {label}
      </dt>
      <dd className="text-[13px] text-[color:var(--fg-muted)] leading-snug mt-1">{value}</dd>
    </div>
  );
}

function hostFromUrl(u: string): string {
  try {
    return new URL(u).host.replace(/^www\./, "");
  } catch {
    return u;
  }
}
