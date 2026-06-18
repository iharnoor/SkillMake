import type { TrustTier } from "@/lib/skill-schema";

const TIERS: Record<TrustTier, { symbol: string; label: string; className: string; title: string }> = {
  official: {
    symbol: "✓",
    label: "Official",
    className: "tag-official",
    title: "Maintained by the tool's own vendor.",
  },
  verified: {
    symbol: "◆",
    label: "Verified",
    className: "tag-verified",
    title: "Curator-reviewed against a reputable source.",
  },
  community: {
    symbol: "○",
    label: "Community",
    className: "tag-community",
    title: "Community-contributed. Not yet curator-reviewed.",
  },
  experimental: {
    symbol: "⚠",
    label: "Experimental",
    className: "tag-experimental",
    title: "New or unproven. Inspect before relying on it.",
  },
};

/**
 * Trust-tier pill. Renders nothing for the quiet default unless `showCommunity`
 * is set, so the bulk of the catalog stays uncluttered while official/verified/
 * experimental entries earn a visible signal.
 */
export function TrustBadge({
  tier,
  showCommunity = false,
  className = "",
}: {
  tier: TrustTier;
  showCommunity?: boolean;
  className?: string;
}) {
  if (tier === "community" && !showCommunity) return null;
  const t = TIERS[tier];
  return (
    <span className={`tag ${t.className} ${className}`.trim()} title={t.title}>
      <span aria-hidden>{t.symbol}</span>
      {t.label}
    </span>
  );
}
