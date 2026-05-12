"use client";

import { useState, useCallback } from "react";
import { SkillPreview } from "./SkillPreview";
import { AUDIENCES, type Audience, type Skill } from "@/lib/skill-schema";

interface ConvertResponse {
  skill: Skill;
  markdown: string;
  sourceUrl: string;
  sourceTitle: string;
  model: string;
  generatedAt: string;
}

// Audiences we are actively curating right now. Others are visible but disabled
// so creators see the roadmap.
const LIVE_AUDIENCES: Audience[] = ["creators", "engineers"];

const YOUTUBE_RE =
  /^https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)[\w-]{6,}/i;

const GITHUB_REPO_RE = /^https?:\/\/(?:www\.)?github\.com\/[\w.-]+\/[\w.-]+\/?$/i;

const STAGES = [
  { id: "fetch", label: "Fetching docs page" },
  { id: "extract", label: "Extracting & sanitizing content" },
  { id: "curate", label: "Curating skill (constrained schema)" },
  { id: "verify", label: "Verifying output safety" },
] as const;

export function Converter() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ConvertResponse | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [duplicate, setDuplicate] = useState<{ id: string; score: number } | null>(null);
  const [videoUrls, setVideoUrls] = useState<string[]>([""]);
  const [audience, setAudience] = useState<Audience>("creators");
  const [repoUrl, setRepoUrl] = useState("");

  const validVideoUrls = videoUrls.map((s) => s.trim()).filter((s) => YOUTUBE_RE.test(s));
  const hasInvalidVideo = videoUrls.some((s) => s.trim() !== "" && !YOUTUBE_RE.test(s.trim()));
  const trimmedRepoUrl = repoUrl.trim();
  const hasInvalidRepo = trimmedRepoUrl !== "" && !GITHUB_REPO_RE.test(trimmedRepoUrl);

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setResult(null);
      setSubmittedId(null);
      setVideoUrls([""]);
      setAudience("creators");
      setRepoUrl("");
      setLoading(true);
      setStage(0);
      const stageInterval = setInterval(() => {
        setStage((s) => Math.min(s + 1, STAGES.length - 1));
      }, 1800);
      try {
        const res = await fetch("/api/convert", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ url }),
        });
        const data = (await res.json()) as ConvertResponse | { error: string };
        if (!res.ok || "error" in data) {
          setError("error" in data ? data.error : "Conversion failed.");
          return;
        }
        setStage(STAGES.length - 1);
        setResult(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Network error.");
      } finally {
        clearInterval(stageInterval);
        setLoading(false);
      }
    },
    [url]
  );

  const onCopy = useCallback(async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }, []);

  const onDownload = useCallback(() => {
    if (!result) return;
    const blob = new Blob([result.markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${result.skill.name}.skill.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [result]);

  const onPublish = useCallback(
    async (force = false) => {
      if (!result) return;
      if (hasInvalidVideo) {
        setError("Each video URL must be a YouTube watch, shorts, or youtu.be link.");
        return;
      }
      if (hasInvalidRepo) {
        setError("Repo URL must look like https://github.com/owner/repo.");
        return;
      }
      setError(null);
      setPublishing(true);
      setDuplicate(null);
      try {
        const res = await fetch("/api/marketplace", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            skill: result.skill,
            sourceUrl: result.sourceUrl,
            model: result.model,
            generatedAt: result.generatedAt,
            videoUrls: validVideoUrls,
            audience,
            repoUrl: trimmedRepoUrl || undefined,
            force,
          }),
        });
        const data = (await res.json()) as {
          id?: string;
          status?: string;
          error?: string;
          warning?: string;
          duplicate?: { id: string; score: number };
        };
        if (data.id) setSubmittedId(data.id);
        else if (data.warning === "duplicate" && data.duplicate) setDuplicate(data.duplicate);
        else setError(data.error ?? "Submission failed.");
      } finally {
        setPublishing(false);
      }
    },
    [result, validVideoUrls, audience, trimmedRepoUrl, hasInvalidVideo, hasInvalidRepo]
  );

  return (
    <div className="space-y-8">
      <form onSubmit={onSubmit} className="input-shell rounded-2xl p-2 flex flex-col sm:flex-row gap-2">
        <div className="flex items-center pl-4 pr-2 py-2 sm:py-0 mono text-[color:var(--fg-dim)] text-sm">
          https://
        </div>
        <input
          type="url"
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="docs.anthropic.com/en/docs/agents-and-tools/computer-use"
          className="flex-1 bg-transparent outline-none text-[15px] mono placeholder:text-[color:var(--fg-dim)] px-2 py-3"
          disabled={loading}
          autoFocus
        />
        <button
          type="submit"
          disabled={loading || !url}
          className="btn-accent rounded-xl px-6 py-3 text-sm tracking-tight whitespace-nowrap"
        >
          {loading ? "Converting…" : "Skill it →"}
        </button>
      </form>

      {loading && (
        <div className="card p-5 scan">
          <div className="space-y-2.5">
            {STAGES.map((s, i) => (
              <div key={s.id} className="flex items-center gap-3 mono text-sm">
                <span
                  className={`inline-block w-1.5 h-1.5 rounded-full ${
                    i < stage
                      ? "bg-[color:var(--accent)]"
                      : i === stage
                      ? "bg-[color:var(--accent)] pulse-dot"
                      : "bg-[color:var(--border-strong)]"
                  }`}
                />
                <span className={i <= stage ? "text-[color:var(--fg)]" : "text-[color:var(--fg-dim)]"}>
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="card p-5 border-[color:var(--danger)]/40">
          <div className="flex items-start gap-3">
            <span className="mono text-xs uppercase tracking-wider text-[color:var(--danger)]">Error</span>
            <span className="text-sm text-[color:var(--fg)]">{error}</span>
          </div>
        </div>
      )}

      {result && (
        <div className="space-y-5">
          <div className="card p-6">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className="tag tag-accent">
                <span className="dot" /> Skill ready
              </span>
              <span className="tag">{result.skill.category}</span>
              <span className="tag mono">{result.model}</span>
              <a
                href={result.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="tag hover:text-[color:var(--fg)]"
              >
                source ↗
              </a>
            </div>
            <h2 className="text-2xl tracking-tight font-semibold mb-1">{result.skill.name}</h2>
            <p className="text-[color:var(--fg-muted)] text-[15px]">{result.skill.description}</p>
          </div>

          <div className="card p-6">
            <SkillPreview markdown={result.markdown} skillName={result.skill.name} />
          </div>

          {!submittedId && (
            <div className="card p-6">
              <div className="mono text-[11px] uppercase tracking-wider text-[color:var(--fg-dim)] mb-4">
                Attach to your submission
              </div>

              <div className="mb-5">
                <div className="text-sm font-medium mb-2">Audience</div>
                <div className="flex flex-wrap gap-2">
                  {AUDIENCES.map((a) => {
                    const live = LIVE_AUDIENCES.includes(a);
                    const active = audience === a;
                    return (
                      <button
                        key={a}
                        type="button"
                        disabled={!live}
                        onClick={() => live && setAudience(a)}
                        className={
                          active
                            ? "tag tag-accent"
                            : live
                            ? "tag hover:text-[color:var(--fg)]"
                            : "tag opacity-40 cursor-not-allowed"
                        }
                        title={live ? "" : "Coming soon — we're personally vetting one audience at a time."}
                      >
                        {a}
                        {!live && <span className="mono text-[9px] ml-1">soon</span>}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mb-5">
                <div className="text-sm font-medium mb-2">
                  GitHub repo{" "}
                  <span className="text-[color:var(--fg-dim)] text-xs">
                    (optional — pulls ★ stars)
                  </span>
                </div>
                <input
                  type="url"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  placeholder="https://github.com/owner/repo"
                  className={`input-shell rounded-md w-full px-3 py-2 mono text-[13px] outline-none ${
                    hasInvalidRepo ? "border-[color:var(--danger)]" : ""
                  }`}
                />
                {hasInvalidRepo && (
                  <p className="mono text-[11px] text-[color:var(--danger)] mt-2">
                    Must look like https://github.com/owner/repo.
                  </p>
                )}
              </div>

              <div>
                <div className="text-sm font-medium mb-2">
                  YouTube tutorials <span className="text-[color:var(--fg-dim)] text-xs">(optional, up to 6)</span>
                </div>
                <div className="space-y-2">
                  {videoUrls.map((url, i) => {
                    const trimmed = url.trim();
                    const invalid = trimmed !== "" && !YOUTUBE_RE.test(trimmed);
                    return (
                      <div key={i} className="flex gap-2">
                        <input
                          type="url"
                          value={url}
                          onChange={(e) => {
                            const next = [...videoUrls];
                            next[i] = e.target.value;
                            setVideoUrls(next);
                          }}
                          placeholder="https://www.youtube.com/watch?v=…"
                          className={`flex-1 input-shell rounded-md px-3 py-2 mono text-[13px] outline-none ${
                            invalid ? "border-[color:var(--danger)]" : ""
                          }`}
                        />
                        {videoUrls.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setVideoUrls(videoUrls.filter((_, j) => j !== i))}
                            className="btn-ghost rounded-md px-3 text-xs"
                          >
                            remove
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
                {videoUrls.length < 6 && (
                  <button
                    type="button"
                    onClick={() => setVideoUrls([...videoUrls, ""])}
                    className="mono text-[12px] text-[color:var(--fg-muted)] hover:text-[color:var(--accent)] mt-3"
                  >
                    + add another video
                  </button>
                )}
                {hasInvalidVideo && (
                  <p className="mono text-[11px] text-[color:var(--danger)] mt-2">
                    Each URL must be a YouTube watch, shorts, or youtu.be link.
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button onClick={onDownload} className="btn-ghost rounded-xl px-5 py-2.5 text-sm">
              ↓ Download SKILL.md
            </button>
            <button
              onClick={() => onCopy(result.markdown)}
              className="btn-ghost rounded-xl px-5 py-2.5 text-sm"
            >
              {copied ? "copied ✓" : "Copy raw markdown"}
            </button>
            {submittedId ? (
              <span className="btn-ghost rounded-xl px-5 py-2.5 text-sm cursor-default">
                ✓ Submitted · ref {submittedId}
              </span>
            ) : (
              <button
                onClick={() => onPublish(false)}
                disabled={publishing || hasInvalidVideo || hasInvalidRepo}
                className="btn-accent rounded-xl px-5 py-2.5 text-sm"
              >
                {publishing ? "Submitting…" : "Submit for review"}
              </button>
            )}
          </div>

          {submittedId && (
            <div className="card p-5 border-[color:var(--accent)]/40">
              <div className="mono text-[11px] uppercase tracking-wider text-[color:var(--accent)] mb-2">
                In review
              </div>
              <p className="text-sm text-[color:var(--fg-muted)] leading-relaxed">
                Thanks — your skill is in the curator queue. Every entry on the marketplace is
                personally vetted before it goes live, so the install link will appear once it's
                approved. You can copy or download the SKILL.md right now if you want to use it
                yourself.
              </p>
            </div>
          )}

          {duplicate && (
            <div className="card p-5 border-[color:var(--warn)]/40">
              <div className="flex items-center gap-2 mb-2">
                <span className="mono text-[11px] uppercase tracking-wider text-[color:var(--warn)]">
                  HydraDB · duplicate detected
                </span>
                <span className="tag mono">cosine ≈ {duplicate.score.toFixed(2)}</span>
              </div>
              <p className="text-sm text-[color:var(--fg-muted)] mb-3">
                A semantically similar skill is already in the marketplace. Inspect it before
                creating a near-duplicate.
              </p>
              <div className="flex gap-2 flex-wrap">
                <a
                  href={`/marketplace/${duplicate.id}`}
                  className="btn-ghost rounded-md px-3 py-1.5 text-xs"
                >
                  View existing skill →
                </a>
                <button
                  onClick={() => onPublish(true)}
                  disabled={publishing}
                  className="btn-ghost rounded-md px-3 py-1.5 text-xs"
                >
                  {publishing ? "Publishing…" : "Publish anyway"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
