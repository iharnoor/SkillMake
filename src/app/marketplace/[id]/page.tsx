import Link from "next/link";
import { notFound } from "next/navigation";
import { getApprovedSkill } from "@/lib/storage";
import { SkillPreview } from "@/components/SkillPreview";
import { InstallCommand } from "@/components/InstallCommand";
import { youtubeIdFromUrl } from "@/lib/skill-schema";

export const dynamic = "force-dynamic";

export default async function SkillDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const entry = await getApprovedSkill(id);
  if (!entry) notFound();

  const videos = entry.skill.videoUrls
    .map((url) => ({ url, id: youtubeIdFromUrl(url) }))
    .filter((v): v is { url: string; id: string } => Boolean(v.id));

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

      <div className="mt-3">
        <a
          href={entry.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="mono text-[12px] text-[color:var(--fg-dim)] hover:text-[color:var(--accent)] transition break-all"
        >
          source: {entry.sourceUrl} ↗
        </a>
      </div>

      {videos.length > 0 && (
        <div className="card p-6 mt-8">
          <div className="mono text-[11px] uppercase tracking-[0.2em] text-[color:var(--fg-dim)] mb-3">
            Tutorials · creator-attached
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {videos.map((v) => (
              <div key={v.id} className="aspect-video rounded-md overflow-hidden border border-[color:var(--border)]">
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${v.id}`}
                  title={`Tutorial video ${v.id}`}
                  loading="lazy"
                  allow="accelerometer; clipboard-write; encrypted-media; picture-in-picture"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                  className="w-full h-full"
                />
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
