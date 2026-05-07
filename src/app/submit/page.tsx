import Link from "next/link";
import { Converter } from "@/components/Converter";
import { Benchmarks } from "@/components/Benchmarks";
import { loadBenchmarks } from "@/lib/benchmarks";
import { getEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function SubmitPage() {
  const [summary, env] = await Promise.all([loadBenchmarks(), getEnv()]);
  // Without an AI provider, the docs→SKILL.md converter can't run. Show a
  // honest "curator-only for now" notice instead of letting users hit a 503
  // mid-form.
  const converterEnabled = Boolean(env.ANTHROPIC_API_KEY);
  return (
    <div className="relative">
      <div className="absolute inset-x-0 top-0 h-[420px] grid-bg pointer-events-none opacity-40" />

      <section className="relative max-w-4xl mx-auto px-6 pt-20 pb-10 text-center">
        <div className="inline-flex items-center gap-2 mono text-[11px] tracking-[0.2em] uppercase text-[color:var(--fg-muted)] border border-[color:var(--border)] rounded-full px-3 py-1 mb-7">
          <span className="dot" /> docs → skill, in one line
        </div>
        <h1 className="text-[clamp(2.4rem,5vw,4rem)] font-semibold tracking-[-0.02em] leading-[1.05]">
          Submit a docs page.
          <br />
          <span className="text-[color:var(--accent)]">Attach your tutorial. We review.</span>
        </h1>
        <p className="text-[color:var(--fg-muted)] text-[17px] mt-5 max-w-2xl mx-auto leading-relaxed">
          Paste a docs URL — we extract, sanitize, and curate it into a constrained
          <span className="mono text-[color:var(--fg)]"> SKILL.md</span>. Add up to six YouTube
          tutorials as evidence. Every submission is personally vetted before it joins the
          marketplace at{" "}
          <Link href="/" className="mono text-[color:var(--accent)] hover:underline">/</Link>.
        </p>
        <div className="flex items-center justify-center gap-2 mt-6 flex-wrap">
          <span className="tag">prompt-injection-hardened</span>
          <span className="tag">verbatim API extraction</span>
          <span className="tag">content-hashed</span>
          <span className="tag tag-accent">curator-reviewed</span>
        </div>
      </section>

      <section className="relative max-w-3xl mx-auto px-6">
        {converterEnabled ? (
          <Converter />
        ) : (
          <div className="card p-8">
            <div className="mono text-[11px] uppercase tracking-wider text-[color:var(--accent)] mb-3">
              Curator-only right now
            </div>
            <p className="text-[color:var(--fg)] text-[15px] leading-relaxed mb-3">
              The docs→SKILL.md auto-converter is currently turned off. SkillMake is being seeded
              by hand for the first wave of <span className="mono">creators</span> skills.
            </p>
            <p className="text-[color:var(--fg-muted)] text-[14px] leading-relaxed">
              Got a skill in mind? Email it (or open an issue with a docs URL or a hand-written
              SKILL.md) and we&apos;ll add it. The converter will switch back on once we open
              public submissions.
            </p>
            <div className="mt-5 flex items-center gap-3 flex-wrap">
              <Link href="/" className="btn-ghost rounded-md px-3 py-1.5 text-xs">
                ← Browse the marketplace
              </Link>
            </div>
          </div>
        )}
      </section>

      {summary && <Benchmarks summary={summary} />}

      <section className="max-w-5xl mx-auto px-6 mt-24 pb-24">
        <div className="card p-8">
          <div className="mono text-[11px] uppercase tracking-[0.2em] text-[color:var(--fg-dim)] mb-3">
            Case study · Clerk custom sign-in page
          </div>
          <p className="text-[color:var(--fg-muted)] text-[14px] mb-6 max-w-2xl">
            We pasted{" "}
            <a
              href="https://clerk.com/docs/react/guides/development/custom-sign-in-or-up-page"
              target="_blank"
              rel="noreferrer"
              className="mono text-[color:var(--accent)] hover:underline break-all"
            >
              clerk.com/docs/react/guides/development/custom-sign-in-or-up-page
            </a>{" "}
            and checked whether the resulting skill captured every code pattern an agent needs.
          </p>
          <div className="grid sm:grid-cols-2 gap-8 mt-2">
            <div>
              <div className="text-[color:var(--fg-muted)] text-sm mb-2">Without SkillMake</div>
              <pre className="skill-pre" style={{ maxHeight: 240 }}>
{`agent fetches docs page
  →  244,956 tokens of HTML
     ├─ navigation, footer, scripts
     ├─ tab widgets, syntax highlighter
     └─ ~7,600 tokens of actual content
        once you strip the markup`}
              </pre>
            </div>
            <div>
              <div className="text-[color:var(--accent)] text-sm mb-2">With SkillMake</div>
              <pre className="skill-pre" style={{ maxHeight: 240 }}>
{`agent loads SKILL.md
  →  1,425 tokens (172× smaller)
     ├─ <SignIn /> mounted at /sign-in/*
     ├─ ClerkProvider + React Router
     ├─ signInFallbackRedirectUrl wiring
     └─ 4 verbatim code blocks, all
        copy-pasteable into your repo`}
              </pre>
            </div>
          </div>
          <div className="mt-6 flex items-center gap-3 flex-wrap">
            <Link href="/" className="btn-ghost rounded-md px-3 py-1.5 text-xs">
              See approved skills →
            </Link>
            <span className="mono text-[11px] text-[color:var(--fg-dim)]">
              every code block from the source page is preserved verbatim
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
