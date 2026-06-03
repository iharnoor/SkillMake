"use client";

import { trackPromptSourceClick } from "@/components/Telemetry";

/**
 * Outbound source link for a pack prompt. Fires a prompt_source_click metric
 * ("packSlug:promptId") on click so we can see which prompts drive people to
 * the original post — the strongest "this resonated" signal for curation.
 */
export function SourceLink({
  href,
  trackSlug,
  className,
  children,
}: {
  href: string;
  trackSlug?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={className}
      onClick={() => {
        if (trackSlug) trackPromptSourceClick(trackSlug);
      }}
    >
      {children}
    </a>
  );
}
