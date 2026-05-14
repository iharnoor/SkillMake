"use client";

import { useEffect, useState } from "react";

export function InstallCommand({ skillName }: { skillName: string }) {
  const [origin, setOrigin] = useState("https://skillmake.xyz");
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);
  // Name-based install shortcut. Resolves on the server to the latest
  // approved entry — agents don't need to know the id.
  const cmd = `curl --create-dirs -fsSL ${origin}/i/${skillName} -o ~/.claude/skills/${skillName}/SKILL.md`;

  return (
    <div>
      <div className="flex items-start gap-2">
        <pre className="skill-pre flex-1" style={{ maxHeight: 100 }}>
          <span className="text-[color:var(--fg-dim)]">$ </span>{cmd}
        </pre>
        <button
          onClick={async () => {
            await navigator.clipboard.writeText(cmd);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="btn-ghost rounded-md px-3 py-2 text-xs mono flex items-center gap-1.5"
        >
          {copied ? (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[color:var(--accent)]"><polyline points="20 6 9 17 4 12"/></svg>
              copied
            </>
          ) : (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              copy
            </>
          )}
        </button>
      </div>
    </div>
  );
}
