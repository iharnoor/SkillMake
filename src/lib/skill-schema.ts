import { z } from "zod";

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const YOUTUBE_RE =
  /^https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)[\w-]{6,}/i;

const HYPERFRAMES_RE = /^https?:\/\/hyperframes\.dev\/p\/[\w-]+/i;

// Self-hosted MP4 served from skillmake.xyz/v/<slug>.mp4 (or any /v/ path on
// the same origin during dev). Used for the launch demo videos that we render
// with HyperFrames and ship as static assets — auth-free, embed-friendly.
const SELF_HOSTED_VIDEO_RE = /^https?:\/\/(?:[\w.-]+)\/v\/[\w.-]+\.mp4$/i;

const GITHUB_REPO_RE = /^https?:\/\/(?:www\.)?github\.com\/[\w.-]+\/[\w.-]+\/?$/i;

// Accepts a YouTube watch/shorts/youtu.be URL, a hyperframes.dev project URL,
// or a self-hosted /v/<slug>.mp4 URL. The HF project URL is kept for legacy
// entries; new attachments should use self-hosted paths since hyperframes.dev
// project URLs auth-redirect and don't render in iframes.
export const VideoUrl = z
  .string()
  .url()
  .max(500)
  .refine(
    (s) => YOUTUBE_RE.test(s) || HYPERFRAMES_RE.test(s) || SELF_HOSTED_VIDEO_RE.test(s),
    "must be a YouTube URL, hyperframes.dev project URL, or /v/<slug>.mp4 URL"
  );

export const GithubRepoUrl = z
  .string()
  .url()
  .max(300)
  .refine((s) => GITHUB_REPO_RE.test(s), "must be a https://github.com/owner/repo URL");

export function parseGithubRepo(url: string): { owner: string; repo: string } | null {
  if (!GITHUB_REPO_RE.test(url)) return null;
  try {
    const path = new URL(url).pathname.replace(/^\/|\/$/g, "");
    const [owner, repo] = path.split("/");
    if (!owner || !repo) return null;
    return { owner, repo: repo.replace(/\.git$/, "") };
  } catch {
    return null;
  }
}

export const AUDIENCES = ["creators", "engineers", "devops", "ai", "design", "marketing", "creative", "general"] as const;
export type Audience = (typeof AUDIENCES)[number];

/**
 * SkillOpt protected sections — section ids that bounded edits cannot modify.
 * Wrapped in `<!-- @protected:<id> -->...<!-- /@protected:<id> -->` markers
 * during render so the validator can enforce byte-identity at the markdown
 * level too (defense in depth).
 */
export const PROTECTED_SECTION_IDS = [
  "whenToUse",
  "keyConcepts",
  "apiReference",
  "gotchas",
] as const;
export type ProtectedSectionId = (typeof PROTECTED_SECTION_IDS)[number];

export function youtubeIdFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.endsWith("youtu.be")) return u.pathname.slice(1) || null;
    if (u.searchParams.get("v")) return u.searchParams.get("v");
    const m = u.pathname.match(/^\/(?:shorts|embed)\/([\w-]+)/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

export type VideoEmbed =
  | { kind: "youtube"; id: string; src: string; title: string }
  | { kind: "hyperframes"; src: string; title: string }
  | { kind: "self-hosted"; src: string; title: string };

/** Resolve a videoUrl into an iframe- or video-embeddable src + display kind.
 *  Self-hosted mp4s are rendered with a native <video> element since they live
 *  on our own origin and don't need an iframe sandbox; hyperframes.dev URLs
 *  fall back to iframe (kept for backwards compat with legacy entries that
 *  used HF project URLs before we self-hosted). */
export function resolveVideoEmbed(url: string): VideoEmbed | null {
  if (SELF_HOSTED_VIDEO_RE.test(url)) {
    return { kind: "self-hosted", src: url, title: "Demo video" };
  }
  const yt = youtubeIdFromUrl(url);
  if (yt) {
    return {
      kind: "youtube",
      id: yt,
      src: `https://www.youtube-nocookie.com/embed/${yt}`,
      title: `Tutorial video ${yt}`,
    };
  }
  if (HYPERFRAMES_RE.test(url)) {
    return { kind: "hyperframes", src: url, title: "HyperFrames demo" };
  }
  return null;
}

export const SkillSchema = z.object({
  name: z
    .string()
    .min(2)
    .max(48)
    .regex(SLUG_RE, "must be lowercase-kebab-case slug")
    .describe("URL-safe kebab-case slug, e.g. 'remotion-rendering'"),
  description: z
    .string()
    .min(20)
    .max(220)
    .describe(
      "Single sentence (<220 chars) describing exactly when an agent should load this skill. Start with 'Use when...'."
    ),
  whenToUse: z
    .array(z.string().min(8).max(200))
    .describe("Aim for 2–4 bullet triggers — concrete situations that should activate this skill."),
  keyConcepts: z
    .array(
      z.object({
        term: z.string().min(2).max(80),
        explanation: z.string().min(10).max(500),
      })
    )
    .describe("Aim for 3–6 core terms an agent must understand. Keep explanations grounded in source text."),
  apiReference: z
    .array(
      z.object({
        signature: z
          .string()
          .min(2)
          .max(300)
          .describe(
            "Short label or function/component signature (e.g. 'Mount <SignIn /> with React Router', '<SignIn /> props')."
          ),
        purpose: z.string().min(8).max(280),
        example: z
          .string()
          .max(2400)
          .optional()
          .describe(
            "The full code block VERBATIM as shown in the docs (imports, JSX, route paths, prop names). Do not abbreviate."
          ),
      })
    )
    .describe(
      "One entry per distinct code block in the docs. Be exhaustive — every setup snippet matters. Empty array only if docs have no code."
    ),
  gotchas: z
    .array(z.string().min(8).max(280))
    .describe("Up to ~8 non-obvious pitfalls explicitly stated in the docs. Empty array if none found."),
  category: z
    .enum(["framework", "library", "api", "platform", "tool", "language", "concept", "security", "design", "pm", "job-search", "prompt-pack", "other"])
    .describe("High-level category for marketplace browsing."),
  audience: z
    .enum(AUDIENCES)
    .default("creators")
    .describe(
      "Who this skill is primarily for. We launched with 'creators'; other audiences are added as the marketplace expands."
    ),
  videoUrls: z
    .array(VideoUrl)
    .max(6)
    .default([])
    .describe(
      "Optional YouTube tutorial/demo URLs the creator attached as evidence the skill works. Empty array if none."
    ),
  repoUrl: GithubRepoUrl
    .optional()
    .describe(
      "Optional canonical GitHub repository for the underlying tool/library. Used to display star counts and link to source. Leave empty for workflow skills with no repo."
    ),
  protectedSections: z
    .array(z.enum(PROTECTED_SECTION_IDS))
    .default([])
    .describe(
      "SkillOpt: section ids that bounded-edit machinery refuses to modify (byte-identical between parent and candidate). Lets curators pin 'slow' knowledge against fast iteration. Empty = nothing protected."
    ),
});

export type Skill = z.infer<typeof SkillSchema>;

export function renderSkillMarkdown(skill: Skill, sourceUrl: string, generatedAt: string): string {
  const protectedIds = new Set<ProtectedSectionId>(skill.protectedSections ?? []);
  const lines: string[] = [];
  lines.push("---");
  lines.push(`name: ${skill.name}`);
  lines.push(`description: ${escapeYaml(skill.description)}`);
  lines.push(`source: ${sourceUrl}`);
  lines.push(`generated: ${generatedAt}`);
  lines.push(`category: ${skill.category}`);
  lines.push(`audience: ${skill.audience}`);
  lines.push("---");
  lines.push("");
  if (skill.videoUrls.length > 0) {
    lines.push("## Tutorials");
    lines.push("");
    for (const v of skill.videoUrls) lines.push(`- ${v}`);
    lines.push("");
  }

  // Each block is generated independently, then optionally wrapped in
  // `<!-- @protected:<id> -->...<!-- /@protected:<id> -->` markers. The
  // markers let the validator detect any unauthorized mutation of a
  // protected section at the rendered-markdown level (defense in depth).
  pushSection(lines, "whenToUse", protectedIds, () => {
    lines.push("## When to use");
    lines.push("");
    for (const t of skill.whenToUse) lines.push(`- ${t}`);
    lines.push("");
  });

  pushSection(lines, "keyConcepts", protectedIds, () => {
    lines.push("## Key concepts");
    lines.push("");
    for (const c of skill.keyConcepts) {
      lines.push(`### ${c.term}`);
      lines.push("");
      lines.push(c.explanation);
      lines.push("");
    }
  });

  if (skill.apiReference.length > 0) {
    pushSection(lines, "apiReference", protectedIds, () => {
      lines.push("## API reference");
      lines.push("");
      for (const a of skill.apiReference) {
        lines.push("```");
        lines.push(a.signature);
        lines.push("```");
        lines.push("");
        lines.push(a.purpose);
        if (a.example) {
          lines.push("");
          lines.push("```");
          lines.push(a.example);
          lines.push("```");
        }
        lines.push("");
      }
    });
  }

  if (skill.gotchas.length > 0) {
    pushSection(lines, "gotchas", protectedIds, () => {
      lines.push("## Gotchas");
      lines.push("");
      for (const g of skill.gotchas) lines.push(`- ${g}`);
      lines.push("");
    });
  }

  lines.push("---");
  lines.push(`Generated by SkillMake from ${sourceUrl} on ${generatedAt}.`);
  lines.push("Verify against source before relying on details.");
  return lines.join("\n");
}

function pushSection(
  lines: string[],
  id: ProtectedSectionId,
  protectedIds: Set<ProtectedSectionId>,
  emit: () => void
) {
  const wrap = protectedIds.has(id);
  if (wrap) lines.push(`<!-- @protected:${id} -->`);
  emit();
  if (wrap) {
    // Trim the trailing blank that the emit functions push, so the closing
    // marker hugs the section content. Re-add the blank after so the
    // separator between sections stays consistent.
    if (lines[lines.length - 1] === "") lines.pop();
    lines.push(`<!-- /@protected:${id} -->`);
    lines.push("");
  }
}

/**
 * Extract the body of each `<!-- @protected:<id> -->...<!-- /@protected:<id> -->`
 * block from a rendered SKILL.md. Used by the validator to check byte-identity
 * between parent and candidate at the markdown level.
 */
export function extractProtectedBlocks(markdown: string): Map<string, string> {
  const re = /<!-- @protected:([a-zA-Z]+) -->\n?([\s\S]*?)\n?<!-- \/@protected:\1 -->/g;
  const blocks = new Map<string, string>();
  let match: RegExpExecArray | null;
  while ((match = re.exec(markdown)) !== null) {
    blocks.set(match[1], match[2]);
  }
  return blocks;
}

function escapeYaml(s: string): string {
  if (/[:#\n"']/.test(s)) return JSON.stringify(s);
  return s;
}
