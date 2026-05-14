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

      <div className="card p-6 mt-8">
        <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
          <div className="mono text-[11px] uppercase tracking-[0.2em] text-[color:var(--fg-dim)]">
            Install confidence
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="tag tag-accent">reviewed</span>
            {videos.length > 0 && <span className="tag">{videos.length} tutorial{videos.length === 1 ? "" : "s"}</span>}
            {entry.skill.repoUrl && <span className="tag">source repo</span>}
          </div>
        </div>
        <InstallCommand skillName={entry.skill.name} />
        <div className="grid sm:grid-cols-3 gap-3 mt-5 text-[12px]">
          <TrustFact label="Pinned content" value={`sha:${entry.contentHash}`} />
          <TrustFact label="Generated with" value={entry.model} />
          <TrustFact label="Source" value={hostFromUrl(entry.sourceUrl)} />
        </div>
        <p className="mono text-[11px] text-[color:var(--fg-dim)] mt-4 leading-relaxed">
          The file served at
          <span className="text-[color:var(--fg-muted)]"> /api/marketplace/{entry.id}/raw</span> matches
          this hash. Inspect before install, then copy the command.
        </p>
      </div>

      {videos.length > 0 && (
        <div className="card p-6 mt-5">
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
                    muted
                    loop
                    playsInline
                    preload="none"
                    controls
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

      <div className="card p-6 mt-5">
        <SkillPreview markdown={entry.markdown} skillName={entry.skill.name} />
      </div>
    </div>
  );
}

function TrustFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[color:var(--border)] bg-[color:var(--bg-elevated)] px-3 py-2">
      <div className="mono text-[10px] uppercase tracking-[0.16em] text-[color:var(--fg-dim)]">
        {label}
      </div>
      <div className="mono text-[12px] text-[color:var(--fg)] mt-1 truncate" title={value}>
        {value}
      </div>
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
