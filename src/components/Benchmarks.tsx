import Link from "next/link";
import type { BenchmarkSummary } from "@/lib/benchmarks";

interface Props {
  summary: BenchmarkSummary;
}

export function Benchmarks({ summary }: Props) {
  const { data, totals } = summary;
  const max = Math.max(...data.entries.map((e) => e.rawTokensEst));

  return (
    <section className="max-w-5xl mx-auto px-6 mt-28">
      <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
        <div>
          <div className="mono text-[11px] uppercase tracking-[0.2em] text-[color:var(--fg-dim)] mb-2">
            Why SkillMake — measured on real docs
          </div>
          <h2 className="text-3xl sm:text-[2.4rem] tracking-[-0.02em] font-semibold leading-tight">
            <span className="text-[color:var(--accent)] mono">
              {totals.compressionVsRaw.toFixed(0)}×
            </span>{" "}
            fewer tokens than the docs page itself.
          </h2>
          <p className="text-[color:var(--fg-muted)] mt-2 max-w-2xl">
            We ingested {totals.docs} popular library docs and counted bytes at every stage. Numbers
            below are real, reproducible, and link to live marketplace entries.
          </p>
        </div>
        <div className="mono text-[11px] text-[color:var(--fg-dim)]">
          generated {new Date(data.generatedAt).toISOString().slice(0, 10)}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Stat
          label="Raw HTML tokens"
          value={fmt(totals.rawTokens)}
          sub="all docs combined"
        />
        <Stat
          label="SkillMake output tokens"
          value={fmt(totals.skillTokens)}
          sub={`${totals.compressionVsRaw.toFixed(0)}× smaller`}
          accent
        />
        <Stat
          label="Verbatim API entries"
          value={String(totals.apis)}
          sub={`${(totals.apis / totals.docs).toFixed(1)}/doc avg`}
        />
        <Stat
          label="vs stripped text"
          value={`${totals.reductionVsTextPct.toFixed(0)}%`}
          sub="reduction"
        />
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="hidden sm:grid grid-cols-[1.4fr_1fr_1fr_1fr_auto] gap-4 px-6 py-3 border-b border-[color:var(--border)] mono text-[10px] uppercase tracking-[0.2em] text-[color:var(--fg-dim)]">
          <div>Doc</div>
          <div>Raw HTML</div>
          <div>Stripped text</div>
          <div>SkillMake</div>
          <div>APIs</div>
        </div>
        {data.entries.map((e) => {
          const wRaw = (e.rawTokensEst / max) * 100;
          const wText = (e.textTokensEst / max) * 100;
          const wSkill = (e.skillTokensEst / max) * 100;
          const ratio = e.rawTokensEst / Math.max(e.skillTokensEst, 1);
          return (
            <div
              key={e.sourceUrl}
              className="grid sm:grid-cols-[1.4fr_1fr_1fr_1fr_auto] gap-4 px-6 py-4 border-b border-[color:var(--border)] last:border-b-0 items-center group hover:bg-[color:var(--bg-elevated)]/50 transition"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {e.skillId ? (
                    <Link
                      href={`/marketplace/${e.skillId}`}
                      className="text-[14px] font-medium tracking-tight hover:text-[color:var(--accent)] transition"
                    >
                      {e.label}
                    </Link>
                  ) : (
                    <span className="text-[14px] font-medium">{e.label}</span>
                  )}
                  <span className="mono text-[10px] text-[color:var(--fg-dim)]">
                    {ratio.toFixed(0)}×
                  </span>
                </div>
                <a
                  href={e.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mono text-[10.5px] text-[color:var(--fg-dim)] hover:text-[color:var(--fg-muted)] transition truncate block max-w-[28ch] sm:max-w-[36ch]"
                  title={e.sourceUrl}
                >
                  {hostFromUrl(e.sourceUrl)}
                </a>
              </div>
              <Bar tokens={e.rawTokensEst} pct={wRaw} tone="dim" />
              <Bar tokens={e.textTokensEst} pct={wText} tone="muted" />
              <Bar tokens={e.skillTokensEst} pct={wSkill} tone="accent" />
              <div className="mono text-[12px] text-[color:var(--fg-muted)] tabular-nums">
                {e.apiCount}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[12.5px] text-[color:var(--fg-dim)] mt-4 leading-relaxed">
        Token counts are estimated as <span className="mono">chars/4</span>. Raw HTML includes all
        markup, scripts, and inlined assets — what your agent loads when it fetches the page.
        Stripped text is everything after tags are removed (the best case for a vanilla{" "}
        <span className="mono">curl + strip</span>). SkillMake&apos;s output is what your agent
        actually loads from <span className="mono">~/.claude/skills/&lt;name&gt;/SKILL.md</span>.
      </p>
    </section>
  );
}

function Stat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="card p-4">
      <div className="mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--fg-dim)]">
        {label}
      </div>
      <div
        className={`text-2xl tracking-tight font-semibold mt-1.5 ${
          accent ? "text-[color:var(--accent)] mono" : ""
        }`}
      >
        {value}
      </div>
      {sub && (
        <div className="text-[11.5px] text-[color:var(--fg-muted)] mt-0.5">{sub}</div>
      )}
    </div>
  );
}

function Bar({
  tokens,
  pct,
  tone,
}: {
  tokens: number;
  pct: number;
  tone: "dim" | "muted" | "accent";
}) {
  const bg =
    tone === "accent"
      ? "var(--accent)"
      : tone === "muted"
      ? "color-mix(in oklab, var(--accent) 35%, var(--bg-elevated))"
      : "var(--border-strong)";
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex-1 h-1.5 bg-[color:var(--bg-elevated)] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.max(pct, 0.5)}%`, background: bg }}
        />
      </div>
      <span className="mono text-[11px] text-[color:var(--fg-muted)] tabular-nums w-[5.5ch] text-right">
        {fmt(tokens)}
      </span>
    </div>
  );
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return String(n);
}

function hostFromUrl(u: string): string {
  try {
    const url = new URL(u);
    const path = url.pathname.replace(/\/$/, "");
    return `${url.host}${path}`;
  } catch {
    return u;
  }
}
