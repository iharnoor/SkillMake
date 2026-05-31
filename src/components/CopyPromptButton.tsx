"use client";

import { useState } from "react";

/**
 * Copy a prompt's full text to the clipboard with transient "copied" feedback.
 * Mirrors the InstallCommand copy affordance so packs feel native to the app.
 */
export function CopyPromptButton({ text, label = "copy prompt" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // Clipboard can reject (insecure context, denied permission). Select
          // the text as a fallback so the user can copy manually.
        }
      }}
      className="btn-ghost rounded-md px-3 py-1.5 text-[12px] mono shrink-0"
      aria-label={label}
    >
      {copied ? "copied ✓" : label}
    </button>
  );
}
