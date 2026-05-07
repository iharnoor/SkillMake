import Link from "next/link";
import { listSkillsByStatus } from "@/lib/storage";
import { youtubeIdFromUrl } from "@/lib/skill-schema";
import { ReviewActions } from "@/components/admin/ReviewActions";
import { LogoutButton } from "@/components/admin/LogoutButton";

export const dynamic = "force-dynamic";

export default async function AdminQueuePage() {
  const [pending, approved, rejected] = await Promise.all([
    listSkillsByStatus("pending"),
    listSkillsByStatus("approved"),
    listSkillsByStatus("rejected"),
  ]);

  return (
    <div className="max-w-5xl mx-auto px-6 pt-12 pb-20">
      <div className="flex items-end justify-between gap-4 flex-wrap mb-8">
        <div>
          <div className="mono text-[11px] uppercase tracking-[0.2em] text-[color:var(--fg-dim)] mb-2">
            Curator queue
          </div>
          <h1 className="text-3xl font-semibold tracking-[-0.02em]">
            Personally vet every skill.
          </h1>
          <p className="text-[color:var(--fg-muted)] mt-2 max-w-xl text-sm">
            Approving indexes the skill in HydraDB and unhides it on the public marketplace.
            Rejecting keeps the record but never publishes or indexes it.
          </p>
        </div>
        <LogoutButton />
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        <span className="tag tag-accent">{pending.length} pending</span>
        <span className="tag">{approved.length} approved</span>
        <span className="tag">{rejected.length} rejected</span>
      </div>

      {pending.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="mono text-[11px] uppercase tracking-[0.2em] text-[color:var(--fg-dim)] mb-3">
            Inbox zero
          </div>
          <p className="text-[color:var(--fg-muted)] text-sm">
            No skills waiting for review. Submissions land here automatically.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {pending.map((entry) => {
            const videos = entry.skill.videoUrls
              .map((url) => ({ url, vid: youtubeIdFromUrl(url) }))
              .filter((v): v is { url: string; vid: string } => Boolean(v.vid));
            return (
              <article key={entry.id} className="card p-6">
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <span className="tag tag-accent">{entry.skill.audience}</span>
                  <span className="tag">{entry.skill.category}</span>
                  <span className="tag mono text-[10px]">sha:{entry.contentHash}</span>
                  <span className="tag mono text-[10px]">{entry.model}</span>
                  <span className="ml-auto mono text-[10px] text-[color:var(--fg-dim)]">
                    {new Date(entry.createdAt).toISOString().slice(0, 16).replace("T", " ")}
                  </span>
                </div>
                <h3 className="text-lg font-semibold tracking-tight mono mb-1">
                  {entry.skill.name}
                </h3>
                <p className="text-sm text-[color:var(--fg-muted)] leading-relaxed mb-3">
                  {entry.skill.description}
                </p>
                <div className="mb-4">
                  <a
                    href={entry.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mono text-[11px] text-[color:var(--fg-dim)] hover:text-[color:var(--accent)] break-all"
                  >
                    source: {entry.sourceUrl} ↗
                  </a>
                </div>

                {videos.length > 0 && (
                  <div className="mb-5 grid sm:grid-cols-2 gap-3">
                    {videos.map((v) => (
                      <div
                        key={v.vid}
                        className="aspect-video rounded-md overflow-hidden border border-[color:var(--border)]"
                      >
                        <iframe
                          src={`https://www.youtube-nocookie.com/embed/${v.vid}`}
                          title={`Tutorial ${v.vid}`}
                          loading="lazy"
                          allow="accelerometer; clipboard-write; encrypted-media; picture-in-picture"
                          referrerPolicy="strict-origin-when-cross-origin"
                          allowFullScreen
                          className="w-full h-full"
                        />
                      </div>
                    ))}
                  </div>
                )}

                <details className="mb-4">
                  <summary className="mono text-[11px] uppercase tracking-wider text-[color:var(--fg-dim)] cursor-pointer hover:text-[color:var(--fg)]">
                    SKILL.md preview
                  </summary>
                  <pre className="skill-pre mt-2" style={{ maxHeight: 320 }}>
                    {entry.markdown}
                  </pre>
                </details>

                <div className="flex gap-2 flex-wrap items-center">
                  <ReviewActions id={entry.id} />
                  <Link
                    href={`/api/marketplace/${entry.id}/raw`}
                    className="mono text-[11px] text-[color:var(--fg-dim)] hover:text-[color:var(--accent)] ml-auto"
                  >
                    raw (only after approval)
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
