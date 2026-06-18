import { TRUST_PRESENTATION, type TrustTier } from "@/lib/skill-schema";

// Symbol + label come from the shared TRUST_PRESENTATION map (also used by the
// search script) so the two surfaces stay in sync; only the badge-specific CSS
// class and tooltip live here.
const TIER_STYLE: Record<TrustTier, { className: string; title: string }> = {
  official: { className: "tag-official", title: "Maintained by the tool's own vendor." },
  verified: { className: "tag-verified", title: "Curator-reviewed against a reputable source." },
  community: { className: "tag-community", title: "Community-contributed. Not yet curator-reviewed." },
  experimental: { className: "tag-experimental", title: "New or unproven. Inspect before relying on it." },
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
  // Entries persisted before the trust field existed have no tier; treat a
  // missing/unknown value as the quiet community default rather than crashing.
  const resolved: TrustTier = tier in TIER_STYLE ? (tier as TrustTier) : "community";
  // The "verified" tier is no longer surfaced anywhere — it added noise without
  // signal once most of the catalog was curator-reviewed.
  if (resolved === "verified") return null;
  if (resolved === "community" && !showCommunity) return null;
  const style = TIER_STYLE[resolved];
  const { symbol, label } = TRUST_PRESENTATION[resolved];
  return (
    <span className={`tag ${style.className} ${className}`.trim()} title={style.title}>
      <span aria-hidden>{symbol}</span>
      {label}
    </span>
  );
}
