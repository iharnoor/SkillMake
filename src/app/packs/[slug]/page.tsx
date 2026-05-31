import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { headers } from "next/headers";
import { getPack, listPacks, packCategories } from "@/lib/packs";
import { CopyPromptButton } from "@/components/CopyPromptButton";
import { track } from "@/lib/metrics";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return listPacks().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const pack = getPack(slug);
  if (!pack) return { title: "Prompt Pack not found" };
  return {
    title: `${pack.title} — ${pack.prompts.length} copy-paste prompts`,
    description: pack.description,
  };
}

export default async function PackDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const pack = getPack(slug);
  if (!pack) notFound();

  const h = await headers();
  after(() => track("packs_view", { slug: pack.slug, headers: h }));

  const cats = packCategories(pack);

  return (
    <div className="max-w-4xl mx-auto px-6 pt-12 pb-20">
      <Link
        href="/packs"
        prefetch={false}
        className="mono text-[12px] text-[color:var(--fg-muted)] hover:text-[color:var(--accent)]"
      >
        ← packs
      </Link>

      <div className="mt-6 flex items-center gap-2 flex-wrap">
        <span className="tag tag-accent">{pack.audience}</span>
        <span className="tag">{pack.category}</span>
        <span className="tag mono">{pack.prompts.length} prompts</span>
      </div>

      <h1 className="text-3xl sm:text-4xl font-semibold tracking-[-0.02em] mt-4">{pack.title}</h1>
      <p className="text-[color:var(--accent)] mono text-[13px] mt-2">{pack.tagline}</p>
      <p className="text-[color:var(--fg-muted)] text-[16px] mt-3 leading-relaxed">{pack.description}</p>

      <a
        href={pack.sourceUrl}
        target="_blank"
        rel="noreferrer"
        className="mono text-[12px] text-[color:var(--fg-dim)] hover:text-[color:var(--accent)] transition break-all inline-block mt-3"
      >
        source: {pack.sourceUrl} ↗
      </a>

      {/* Category jump-row — anchors scroll to the first card of each kind. */}
      <div className="mt-6 flex items-center gap-x-4 gap-y-2 flex-wrap mono text-[12px] border-b border-[color:var(--border)] pb-3">
        {cats.map((c) => (
          <span key={c} className="text-[color:var(--fg-dim)]">
            {c}
          </span>
        ))}
      </div>

      <div className="mt-8 flex flex-col gap-5">
        {pack.prompts.map((p, i) => (
          <div key={p.id} id={p.id} className="card p-5 scroll-mt-20">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="mono text-[11px] text-[color:var(--fg-dim)] tabular-nums">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h2 className="mono text-[15px] text-[color:var(--fg)]">{p.title}</h2>
                </div>
                <div className="flex items-center gap-2 flex-wrap mt-2">
                  <span className="tag">{p.category}</span>
                  {p.model && <span className="tag mono">{p.model}</span>}
                  {p.excerpt && <span className="tag mono">excerpt</span>}
                </div>
              </div>
              <CopyPromptButton text={p.prompt} />
            </div>

            <pre className="skill-pre mt-4 whitespace-pre-wrap break-words" style={{ maxHeight: 360 }}>
              {p.prompt}
            </pre>

            {(p.tip || p.sourceUrl) && (
              <div className="flex items-baseline justify-between gap-3 flex-wrap mt-3">
                {p.tip ? (
                  <p className="mono text-[11px] text-[color:var(--fg-dim)] leading-relaxed min-w-0">
                    <span className="text-[color:var(--accent)]">tip</span> · {p.tip}
                  </p>
                ) : (
                  <span />
                )}
                {p.sourceUrl && (
                  <a
                    href={p.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mono text-[11px] text-[color:var(--fg-muted)] hover:text-[color:var(--accent)] transition shrink-0"
                  >
                    {p.sourceLabel ?? "source ↗"}
                  </a>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-16 mono text-[11px] text-[color:var(--fg-dim)] text-center">
        Prompts curated from{" "}
        <a
          href={pack.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="text-[color:var(--accent)]"
        >
          {pack.source}
        </a>
        . Verify and adapt before relying on any single generation.
      </div>
    </div>
  );
}
