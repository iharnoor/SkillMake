"use client";

import { useState } from "react";
import { trackPromptCopy } from "@/components/Telemetry";

/**
 * Copy a prompt's full text to the clipboard with transient "copied" feedback.
 * Mirrors the InstallCommand copy affordance so packs feel native to the app.
 * `trackSlug` ("packSlug:promptId") fires a prompt_copy metric so we can see
 * which prompts actually get used.
 */
export function CopyPromptButton({
  text,
  label = "copy prompt",
  trackSlug,
}: {
  text: string;
  label?: string;
  trackSlug?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        if (trackSlug) trackPromptCopy(trackSlug);
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
