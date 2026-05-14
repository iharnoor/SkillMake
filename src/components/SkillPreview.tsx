"use client";

import { useMemo, useState } from "react";

interface Props {
  markdown: string;
  skillName: string;
}

export function SkillPreview({ markdown, skillName }: Props) {
  const [tab, setTab] = useState<"rendered" | "raw">("rendered");
  const highlighted = useMemo(() => highlight(markdown), [markdown]);

  return (
    <div>
      <div className="flex items-center gap-1 mb-3">
        <div className="flex items-center bg-[color:var(--bg)] rounded-lg p-0.5 border border-[color:var(--border)]">
          <button
            onClick={() => setTab("rendered")}
            className={`px-3 py-1 text-xs mono rounded-md transition ${
              tab === "rendered"
                ? "bg-[color:var(--bg-elevated)] text-[color:var(--fg)] shadow-sm"
                : "text-[color:var(--fg-muted)] hover:text-[color:var(--fg)]"
            }`}
          >
            SKILL.md
          </button>
          <button
            onClick={() => setTab("raw")}
            className={`px-3 py-1 text-xs mono rounded-md transition ${
              tab === "raw"
                ? "bg-[color:var(--bg-elevated)] text-[color:var(--fg)] shadow-sm"
                : "text-[color:var(--fg-muted)] hover:text-[color:var(--fg)]"
            }`}
          >
            raw
          </button>
        </div>
        <div className="ml-auto mono text-[11px] text-[color:var(--fg-dim)] flex items-center gap-1.5">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-50"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          {markdown.length.toLocaleString()} chars · ~{Math.round(markdown.length / 4).toLocaleString()} tokens
        </div>
      </div>
      {tab === "rendered" ? (
        <pre className="skill-pre" dangerouslySetInnerHTML={{ __html: highlighted }} />
      ) : (
        <pre className="skill-pre">{markdown}</pre>
      )}
      <p className="mono text-[11px] text-[color:var(--fg-dim)] mt-2">
        File: <span className="text-[color:var(--fg-muted)]">~/.claude/skills/{skillName}/SKILL.md</span>
      </p>
    </div>
  );
}

function escape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function highlight(md: string): string {
  const lines = md.split("\n");
  const out: string[] = [];
  let inFront = false;
  let inCode = false;
  for (const raw of lines) {
    const line = escape(raw);
    if (line.trim() === "---") {
      inFront = !inFront;
      out.push(`<span class="bullet">${line}</span>`);
      continue;
    }
    if (line.startsWith("```")) {
      inCode = !inCode;
      out.push(`<span class="bullet">${line}</span>`);
      continue;
    }
    if (inFront) {
      const m = line.match(/^([a-zA-Z_-]+):\s*(.*)$/);
      if (m) {
        out.push(`<span class="yaml-key">${m[1]}</span>: <span class="yaml-val">${m[2]}</span>`);
      } else out.push(line);
      continue;
    }
    if (inCode) {
      out.push(line);
      continue;
    }
    if (line.startsWith("## ")) {
      out.push(`<span class="heading">${line}</span>`);
      continue;
    }
    if (line.startsWith("### ")) {
      out.push(`<span class="heading">${line}</span>`);
      continue;
    }
    if (line.startsWith("- ")) {
      out.push(`<span class="bullet">-</span> ${line.slice(2)}`);
      continue;
    }
    out.push(line);
  }
  return out.join("\n");
}
