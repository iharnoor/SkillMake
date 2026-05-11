import Link from "next/link";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { headers } from "next/headers";
import { getApprovedSkill } from "@/lib/storage";
import { SkillPreview } from "@/components/SkillPreview";
import { InstallCommand } from "@/components/InstallCommand";
import { resolveVideoEmbed } from "@/lib/skill-schema";
import { GithubIcon } from "@/components/GithubIcon";
import { formatStars } from "@/lib/github";
import { track } from "@/lib/metrics";

export const dynamic = "force-dynamic";

export default async function SkillDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const entry = await getApprovedSkill(id);
  if (!entry) notFound();

  // Browse → install funnel: pair each marketplace_view with /i/<slug> hits.
  // headers() must be read here, not inside the after() callback.
  const h = await headers();
  after(() => track("marketplace_view", { slug: entry.skill.name, headers: h }));

  const videos = entry.skill.videoUrls
    .map((url) => resolveVideoEmbed(url))
    .filter((v): v is NonNullable<typeof v> => v !== null);

  return (
    <div className="max-w-4xl mx-auto px-6 pt-12 pb-20">
      <Link href="/marketplace" className="mono text-[12px] text-[color:var(--fg-muted)] hover:text-[color:var(--accent)]">
        ← marketplace
      </Link>

      <div className="mt-6 flex items-center gap-2 flex-wrap">
        <span className="tag tag-accent">{entry.skill.audience}</span>
        <span className="tag">{entry.skill.category}</span>
        <span className="tag mono">sha:{entry.contentHash}</span>
        <span className="tag mono">{entry.model}</span>
      </div>

      <h1 className="text-3xl sm:text-4xl font-semibold tracking-[-0.02em] mt-4 mono">
        {entry.skill.name}
      </h1>
      <p className="text-[color:var(--fg-muted)] text-[16px] mt-3 leading-relaxed">
        {entry.skill.description}
      </p>

      <div className="mt-3 flex items-center gap-3 flex-wrap">
        <a
          href={entry.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="mono text-[12px] text-[color:var(--fg-dim)] hover:text-[color:var(--accent)] transition break-all"
        >
          source: {entry.sourceUrl} ↗
        </a>
        {entry.skill.repoUrl && (
          <a
            href={entry.skill.repoUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 btn-ghost rounded-md px-3 py-1.5 text-[12px] mono text-[color:var(--fg)] hover:text-[color:var(--accent)] transition"
            title="Open the upstream repository on GitHub"
          >
            <GithubIcon className="text-[14px]" />
            <span>{new URL(entry.skill.repoUrl).pathname.replace(/^\//, "").replace(/\/$/, "")}</span>
            {entry.stars != null && (
              <span className="text-[color:var(--fg-muted)]">· ★ {formatStars(entry.stars)}</span>
            )}
          </a>
        )}
      </div>

      {videos.length > 0 && (
        <div className="card p-6 mt-8">
          <div className="mono text-[11px] uppercase tracking-[0.2em] text-[color:var(--fg-dim)] mb-3">
            Tutorials · creator-attached
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {videos.map((v) => (
              <div
                key={v.src}
                className="aspect-video rounded-md overflow-hidden border border-[color:var(--border)] bg-black"
              >
                {v.kind === "self-hosted" ? (
                  <video
                    src={v.src}
                    title={v.title}
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload="metadata"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <iframe
                    src={v.src}
                    title={v.title}
                    loading="lazy"
                    allow="accelerometer; clipboard-write; encrypted-media; picture-in-picture"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                    className="w-full h-full"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card p-6 mt-8">
        <div className="mono text-[11px] uppercase tracking-[0.2em] text-[color:var(--fg-dim)] mb-3">
          One-line install
        </div>
        <InstallCommand skillName={entry.skill.name} />
        <p className="mono text-[11px] text-[color:var(--fg-dim)] mt-3 leading-relaxed">
          The hash above pins this exact content. The file we serve at
          <span className="text-[color:var(--fg-muted)]"> /api/marketplace/{entry.id}/raw</span> always
          matches <span className="text-[color:var(--fg-muted)]">sha:{entry.contentHash}</span>.
        </p>
      </div>

      <div className="card p-6 mt-5">
        <SkillPreview markdown={entry.markdown} skillName={entry.skill.name} />
      </div>
    </div>
  );
}
