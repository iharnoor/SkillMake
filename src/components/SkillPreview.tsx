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
        <button
          onClick={() => setTab("rendered")}
          className={`px-3 py-1 text-xs mono rounded-md transition ${
            tab === "rendered"
              ? "bg-[color:var(--bg-elevated)] text-[color:var(--fg)] border border-[color:var(--border-strong)]"
              : "text-[color:var(--fg-muted)] hover:text-[color:var(--fg)]"
          }`}
        >
          SKILL.md
        </button>
        <button
          onClick={() => setTab("raw")}
          className={`px-3 py-1 text-xs mono rounded-md transition ${
            tab === "raw"
              ? "bg-[color:var(--bg-elevated)] text-[color:var(--fg)] border border-[color:var(--border-strong)]"
              : "text-[color:var(--fg-muted)] hover:text-[color:var(--fg)]"
          }`}
        >
          raw
        </button>
        <div className="ml-auto mono text-[11px] text-[color:var(--fg-dim)]">
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
