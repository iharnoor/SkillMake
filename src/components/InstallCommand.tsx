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
          {cmd}
        </pre>
        <button
          onClick={async () => {
            await navigator.clipboard.writeText(cmd);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="btn-ghost rounded-md px-3 py-2 text-xs mono"
        >
          {copied ? "copied ✓" : "copy"}
        </button>
      </div>
    </div>
  );
}
