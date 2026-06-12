import Link from "next/link";
import type { Metadata } from "next";
import { after } from "next/server";
import { headers } from "next/headers";
import { listPacks, packCategories } from "@/lib/packs";
import { track } from "@/lib/metrics";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Prompt Packs — curated generative-AI prompt collections",
  description:
    "Hand-curated, copy-paste prompt packs for generative models like Nano Banana (Gemini). Steal the grammar, not just the picture.",
};

const PACK_ICON: Record<string, string> = {
  "famous-prompts": "⭐",
  "nano-banana": "🍌",
  "ai-video": "🎬",
  "agent-rules": "✍️",
  "wealth-plan": "💰",
};

export default async function PacksIndexPage() {
  const h = await headers();
  after(() => track("packs_view", { headers: h }));

  const packs = listPacks();

  return (
    <div className="max-w-6xl mx-auto px-6 pt-12 pb-24">
      <div className="mono text-[11px] uppercase tracking-[0.2em] text-[color:var(--accent)]">
        Curated prompt packs
      </div>
      <h1 className="mt-4 text-4xl sm:text-6xl leading-[0.98] font-semibold tracking-tight">
        Copy-paste prompts for the models you actually use.
      </h1>
      <p className="text-[color:var(--fg-muted)] max-w-2xl text-[16px] leading-relaxed mt-5">
        Skills install workflows into your agent. Packs hand you the exact{" "}
        <span className="mono text-[color:var(--fg)]">prompt grammar</span> behind viral generations —
        portraits, product shots, food, FPV motion clips — ready to paste and remix.
      </p>

      <div className="grid sm:grid-cols-2 gap-4 mt-12">
        {packs.map((pack) => {
          const cats = packCategories(pack);
          return (
            <Link
              key={pack.slug}
              href={`/packs/${pack.slug}`}
              prefetch={false}
              className="card p-6 hover:border-[color:var(--accent)] transition group flex flex-col"
            >
              <div className="flex items-center justify-between gap-3">
                <span
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[15px]"
                  style={{ background: (pack.accent ?? "var(--accent)") + "22" }}
                  aria-hidden
                >
                  {PACK_ICON[pack.slug] ?? "📦"}
                </span>
                <span className="tag tag-accent">{pack.audience}</span>
              </div>
              <h2 className="mono text-[18px] text-[color:var(--fg)] group-hover:text-[color:var(--accent)] transition mt-4">
                {pack.title}
              </h2>
              <p className="text-[13px] leading-relaxed text-[color:var(--fg-muted)] mt-2 flex-1">
                {pack.description}
              </p>
              <div className="flex items-center gap-2 flex-wrap mt-4">
                <span className="tag mono">{pack.prompts.length} prompts</span>
                {cats.slice(0, 4).map((c) => (
                  <span key={c} className="tag">
                    {c}
                  </span>
                ))}
              </div>
              <div className="mono text-[11px] text-[color:var(--fg-dim)] mt-4">
                source: {pack.source} ↗
              </div>
            </Link>
          );
        })}
      </div>

      <div className="mt-20 mono text-[11px] text-[color:var(--fg-dim)] text-center">
        Have a pack worth sharing?{" "}
        <Link href="/submit" prefetch={false} className="text-[color:var(--accent)]">
          submit one
        </Link>
        .
      </div>
    </div>
  );
}
