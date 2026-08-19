import Link from "next/link";
import { after } from "next/server";
import { headers } from "next/headers";
import { track } from "@/lib/metrics";

export const dynamic = "force-dynamic";

interface PromptingEntry {
  name: string;
  description: string;
  audience: string;
  category: string;
  source: string;
  href: string;
}

// Standalone prompting/steering techniques — not installable skills, no repo.
// Each entry is a phrasing or workflow trick you type straight into a model,
// sourced and attributed rather than paraphrased from memory.
const ENTRIES: PromptingEntry[] = [
  {
    name: "show me your default",
    description:
      "When an AI design tool's output feels generic, don't ask for \"more creative\" — first ask it to show the single most stereotypical design it would produce under these conditions nine times out of ten. Seeing the cliché named explicitly gives you something concrete to steer away from, instead of vaguely re-rolling.",
    audience: "design",
    category: "technique",
    source: "x.com/nono_ai_archive",
    href: "https://x.com/nono_ai_archive/status/2086590603991912505",
  },
];

export default async function PromptingPage() {
  const h = await headers();
  after(() => track("prompting_view", { headers: h }));

  return (
    <div className="max-w-5xl mx-auto px-6 pt-12 pb-24">
      <CollectionHeader
        active="prompting"
        eyebrow="Prompting"
        title="Phrasing tricks, not tools."
        description="Standalone prompting and steering techniques for getting better output from AI models — no install, just wording. Each one is attributed to where it came from."
        countLabel={`${ENTRIES.length} ${ENTRIES.length === 1 ? "trick" : "tricks"}`}
      />
      <CollectionTable entries={ENTRIES} />
    </div>
  );
}

function CollectionHeader({
  active,
  eyebrow,
  title,
  description,
  countLabel,
}: {
  active: "budget" | "mcps" | "prompting";
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
          <Link
            href="/prompting"
            className={
              active === "prompting"
                ? "text-[color:var(--accent)] underline underline-offset-4 decoration-1"
                : "text-[color:var(--accent)]/80 hover:text-[color:var(--accent)] transition"
            }
          >
            prompting
          </Link>
        </div>
        <span className="mono text-[11px] text-[color:var(--fg-dim)] tabular-nums">
          {countLabel}
        </span>
      </div>
    </>
  );
}

function CollectionTable({ entries }: { entries: PromptingEntry[] }) {
  return (
    <div className="mt-6">
      <div className="hidden sm:grid grid-cols-[2.5ch_minmax(0,1.3fr)_minmax(0,0.82fr)_minmax(120px,0.5fr)] gap-x-6 mono text-[10px] uppercase tracking-[0.2em] text-[color:var(--fg-dim)] pb-2 border-b border-[color:var(--border)]">
        <span className="text-right">#</span>
        <span>trick</span>
        <span>source</span>
        <span className="text-right">proof</span>
      </div>
      {entries.map((entry, i) => (
        <div
          key={entry.name}
          id={entry.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}
          className="grid sm:grid-cols-[2.5ch_minmax(0,1.3fr)_minmax(0,0.82fr)_minmax(120px,0.5fr)] gap-x-6 gap-y-2 py-3 border-b border-[color:var(--border)] hover:bg-[color:var(--bg-elevated)]/50 transition group scroll-mt-20"
        >
          <span className="mono text-[12px] text-[color:var(--fg-dim)] tabular-nums text-right self-start mt-1">
            {i + 1}
          </span>
          <div className="min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="mono text-[14px] text-[color:var(--fg)] transition">
                {entry.name}
              </span>
              <span className="mono text-[10px] text-[color:var(--fg-dim)] uppercase tracking-wider">
                {entry.audience}
              </span>
              <span className="mono text-[10px] text-[color:var(--fg-dim)] uppercase tracking-wider">
                {entry.category}
              </span>
            </div>
            <div className="text-[12px] text-[color:var(--fg-muted)] leading-relaxed mt-0.5">
              {entry.description}
            </div>
          </div>
          <div className="mono text-[11px] text-[color:var(--fg-dim)] truncate self-start mt-1">
            {entry.source}
          </div>
          <div className="flex flex-wrap justify-start sm:justify-end gap-1.5 self-start">
            <a
              href={entry.href}
              target="_blank"
              rel="noreferrer"
              className="mono text-[10px] rounded-full border border-[color:var(--accent)] bg-[color:var(--accent)] text-[color:var(--bg)] px-2 py-1 font-semibold"
            >
              source
            </a>
          </div>
        </div>
      ))}
    </div>
  );
}
