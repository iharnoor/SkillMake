/**
 * Autonomous SkillOpt optimizer — proposes bounded edits to a SKILL.md based
 * on telemetry signals from Cloudflare Analytics Engine.
 *
 * Loop per skill:
 *   1. pullTelemetry()       → last 14d install/view/click/error counts
 *   2. proposeEdits()        → frontier model returns 4-8 SkillEdit ops
 *   3. applyEdits + render   → candidate skill + markdown
 *   4. validateCandidate()   → static gate (token cap, coherence, schema, protected)
 *   5. saveAndPromoteVersion → atomic flip: candidate becomes current
 *
 * This module is pure functions + IO. The caller (cron route or admin
 * endpoint) decides cadence, batch size, and audit-log shape.
 */

import { generateObject } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { SkillEditsPayload, applyEdits, type SkillEdit } from "./skill-edit.ts";
import { renderSkillMarkdown, type Skill } from "./skill-schema.ts";
import { validateCandidate, type ValidationResult } from "./skill-validator.ts";
import { saveAndPromoteVersion, type MarketplaceEntry } from "./storage.ts";
import { getEnv } from "./env.ts";

// ─── Telemetry ────────────────────────────────────────────────────────────

export interface SkillTelemetry {
  installs14d: number;
  installs7d: number;
  marketplaceViews14d: number;
  conversionRatio: number | null; // installs / views, last 14d. null if no views.
  githubClicks14d: number;
  errorRate14d: number; // api_error rows whose blob2 starts with this slug
  topCountries: { country: string; installs: number }[];
}

const EMPTY_TELEMETRY: SkillTelemetry = {
  installs14d: 0,
  installs7d: 0,
  marketplaceViews14d: 0,
  conversionRatio: null,
  githubClicks14d: 0,
  errorRate14d: 0,
  topCountries: [],
};

/** Query Cloudflare Analytics Engine for one skill's recent activity. */
export async function pullTelemetry(skillName: string): Promise<SkillTelemetry> {
  const env = await getEnv();
  if (!env.CLOUDFLARE_ACCOUNT_ID || !env.CLOUDFLARE_ANALYTICS_API_TOKEN) {
    return EMPTY_TELEMETRY;
  }
  const url = `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/analytics_engine/sql`;

  const query = async (sql: string) => {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { authorization: `Bearer ${env.CLOUDFLARE_ANALYTICS_API_TOKEN}` },
        body: `${sql}\nFORMAT JSON`,
      });
      if (!res.ok) return null;
      const json = (await res.json()) as { data?: unknown[] };
      return Array.isArray(json.data) ? json.data : null;
    } catch {
      return null;
    }
  };

  // splitByChar('@', blob2)[1] strips the version hash; legacy unversioned rows
  // return the full slug from [1] which still matches our skill name filter.
  const slugFilter = `splitByChar('@', blob2)[1] = '${escapeSql(skillName)}'`;
  const viewFilter = `blob2 = '${escapeSql(skillName)}'`;

  const [installs14d, installs7d, views14d, clicks14d, errors14d, countries] = await Promise.all([
    query(
      `SELECT sum(_sample_interval) AS n FROM skillmake_metrics WHERE index1 = 'install_hit' AND ${slugFilter} AND timestamp >= NOW() - INTERVAL '14' DAY`
    ),
    query(
      `SELECT sum(_sample_interval) AS n FROM skillmake_metrics WHERE index1 = 'install_hit' AND ${slugFilter} AND timestamp >= NOW() - INTERVAL '7' DAY`
    ),
    query(
      `SELECT sum(_sample_interval) AS n FROM skillmake_metrics WHERE index1 = 'marketplace_view' AND ${viewFilter} AND timestamp >= NOW() - INTERVAL '14' DAY`
    ),
    query(
      `SELECT sum(_sample_interval) AS n FROM skillmake_metrics WHERE index1 = 'github_click' AND ${viewFilter} AND timestamp >= NOW() - INTERVAL '14' DAY`
    ),
    query(
      `SELECT sum(_sample_interval) AS n FROM skillmake_metrics WHERE index1 IN ('api_error','convert_error') AND blob2 = '${escapeSql(skillName)}' AND timestamp >= NOW() - INTERVAL '14' DAY`
    ),
    query(
      `SELECT blob3 AS country, sum(_sample_interval) AS installs FROM skillmake_metrics WHERE index1 = 'install_hit' AND ${slugFilter} AND timestamp >= NOW() - INTERVAL '14' DAY GROUP BY country ORDER BY installs DESC LIMIT 5`
    ),
  ]);

  const inst14 = scalarN(installs14d);
  const inst7 = scalarN(installs7d);
  const v14 = scalarN(views14d);
  const gh = scalarN(clicks14d);
  const err = scalarN(errors14d);

  return {
    installs14d: inst14,
    installs7d: inst7,
    marketplaceViews14d: v14,
    conversionRatio: v14 > 0 ? inst14 / v14 : null,
    githubClicks14d: gh,
    errorRate14d: err,
    topCountries: (countries ?? [])
      .map((row) => ({
        country: typeof (row as { country?: unknown }).country === "string" ? (row as { country: string }).country : "??",
        installs: scalarN([row]),
      }))
      .filter((c) => c.country !== "??"),
  };
}

function scalarN(data: unknown[] | null): number {
  if (!data || data.length === 0) return 0;
  const row = data[0] as Record<string, unknown>;
  const candidate = row.n ?? row.installs ?? row.count ?? 0;
  const num = typeof candidate === "number" ? candidate : Number(candidate);
  return Number.isFinite(num) ? Math.round(num) : 0;
}

function escapeSql(s: string): string {
  // skill names are kebab-case (Zod-enforced), so no quote risk — but be
  // paranoid against future schema drift.
  return s.replace(/'/g, "''");
}

// ─── Edit proposer (frontier model call) ─────────────────────────────────

const SYSTEM_PROMPT = `You are SkillOpt, an optimizer that proposes bounded refinements to an existing SKILL.md.

CRITICAL DISCIPLINE (from the SkillOpt paper):
1. Bounded edits ONLY. Propose 4-8 atomic ops, never a full rewrite.
2. The validation gate accepts strict improvements only. Aim for compactness, clarity, and tighter triggers — not novelty for its own sake.
3. Compactness wins: median final skill is ~920 tokens. If the current skill is already at that target, propose edits that REDUCE size or DON'T grow it.
4. Description ↔ whenToUse coherence: the description is router-visible. whenToUse items are agent-body visible. They must share keywords or you'll fail the static gate.
5. Forbidden ops on this surface (skip them entirely): replace_name, replace_apiReference.signature, replace_category, replace_audience. Those require human review.

WHAT THE TELEMETRY MEANS:
- Low conversion (install_hit / marketplace_view < 0.10) → the description or whenToUse triggers may not be selling the skill clearly. Tighten them.
- High github_click ratio relative to installs → readers are bouncing out to verify before committing. Try clearer key concepts or gotchas.
- High error rate → an apiReference example may be broken. Propose replace_apiReference_example fixes.
- No telemetry / low traffic → propose conservative edits that improve clarity without changing scope.

OUTPUT: an array of 4-8 SkillEdit ops conforming to the provided schema. No prose, no explanations — the schema is the answer.`;

export interface ProposeOptions {
  skill: Skill;
  markdown: string;
  telemetry: SkillTelemetry;
  /** Edits the optimizer previously proposed that were rejected by the static
   *  gate. Pass them in so the model can avoid re-proposing. */
  rejectedHistory?: SkillEdit[][];
  modelId?: string;
}

export async function proposeEdits(opts: ProposeOptions): Promise<{ edits: SkillEdit[]; model: string }> {
  const env = await getEnv();
  if (!env.ANTHROPIC_API_KEY) {
    throw new Error("AI provider not configured. Set ANTHROPIC_API_KEY.");
  }
  const modelId = opts.modelId ?? env.SKILLMAKE_MODEL ?? "claude-sonnet-4-6";
  const anthropic = createAnthropic({ apiKey: env.ANTHROPIC_API_KEY });

  const telemetryLines = [
    `installs (14d): ${opts.telemetry.installs14d}`,
    `installs (7d):  ${opts.telemetry.installs7d}`,
    `marketplace_view (14d): ${opts.telemetry.marketplaceViews14d}`,
    `conversion_ratio: ${opts.telemetry.conversionRatio === null ? "n/a (no views)" : opts.telemetry.conversionRatio.toFixed(3)}`,
    `github_click (14d): ${opts.telemetry.githubClicks14d}`,
    `errors (14d): ${opts.telemetry.errorRate14d}`,
    `top countries: ${opts.telemetry.topCountries
      .map((c) => `${c.country}=${c.installs}`)
      .join(", ") || "n/a"}`,
  ];

  const rejectedBlock = (opts.rejectedHistory ?? []).length === 0
    ? "(none yet)"
    : opts.rejectedHistory!
        .map((arr, i) => `Attempt ${i + 1}:\n${JSON.stringify(arr, null, 2)}`)
        .join("\n\n");

  const userPrompt = [
    "## Current SKILL.md (verbatim, do not edit headers/frontmatter):",
    "",
    "```markdown",
    opts.markdown,
    "```",
    "",
    "## Telemetry (last 14 days):",
    telemetryLines.join("\n"),
    "",
    "## Previously rejected edits (static gate failed — do not re-propose these):",
    rejectedBlock,
    "",
    "## Task",
    "Propose 4-8 bounded edits to improve this skill. Tighten language, fix",
    "coherence, add gotchas grounded in the telemetry signal (e.g. high error",
    "rate suggests an apiReference example is broken). DO NOT expand scope or",
    "rewrite from scratch. Return ONLY the SkillEdit array.",
  ].join("\n");

  const { object } = await generateObject({
    model: anthropic(modelId),
    schema: z.object({ edits: SkillEditsPayload }),
    system: SYSTEM_PROMPT,
    prompt: userPrompt,
    temperature: 0.3,
  });

  return { edits: object.edits, model: modelId };
}

// ─── Full pipeline ───────────────────────────────────────────────────────

export interface OptimizeResult {
  status:
    | "promoted"
    | "rejected_by_gate"
    | "no_edits_proposed"
    | "apply_failed"
    | "no_telemetry";
  reason?: string;
  proposedEdits?: SkillEdit[];
  validation?: ValidationResult;
  promoted?: MarketplaceEntry;
  retired?: MarketplaceEntry;
  telemetry: SkillTelemetry;
  modelId?: string;
}

export interface OptimizeOptions {
  source: "cron" | "admin-manual";
  /** When true, skip the no-telemetry guard so the optimizer can run on
   *  cold skills (low traffic). Default false — autonomous cron should only
   *  optimize skills with measurable activity. */
  allowZeroTelemetry?: boolean;
  modelId?: string;
}

/**
 * Run one full optimization pass on a single skill. Telemetry → propose →
 * validate → promote or reject. The caller writes the audit log entry.
 */
export async function optimizeSkill(
  entry: MarketplaceEntry,
  options: OptimizeOptions
): Promise<OptimizeResult> {
  const telemetry = await pullTelemetry(entry.skill.name);

  if (!options.allowZeroTelemetry && telemetry.installs14d === 0) {
    return {
      status: "no_telemetry",
      reason: "skill has zero install_hit rows in the last 14d — pass allowZeroTelemetry=true to override",
      telemetry,
    };
  }

  let proposal: { edits: SkillEdit[]; model: string };
  try {
    proposal = await proposeEdits({
      skill: entry.skill,
      markdown: entry.markdown,
      telemetry,
      modelId: options.modelId,
    });
  } catch (e) {
    return {
      status: "no_edits_proposed",
      reason: e instanceof Error ? e.message : String(e),
      telemetry,
    };
  }

  let candidateSkill: Skill;
  try {
    candidateSkill = applyEdits(entry.skill, proposal.edits);
  } catch (e) {
    return {
      status: "apply_failed",
      reason: e instanceof Error ? e.message : String(e),
      proposedEdits: proposal.edits,
      telemetry,
      modelId: proposal.model,
    };
  }

  const generatedAt = new Date().toISOString();
  const markdown = renderSkillMarkdown(candidateSkill, entry.sourceUrl, generatedAt);
  const validation = validateCandidate({
    parent: { skill: entry.skill, markdown: entry.markdown },
    candidate: { skill: candidateSkill, markdown },
    edits: proposal.edits,
  });

  if (!validation.pass) {
    return {
      status: "rejected_by_gate",
      reason: validation.reasons.join("; "),
      proposedEdits: proposal.edits,
      validation,
      telemetry,
      modelId: proposal.model,
    };
  }

  const { promoted, retired } = await saveAndPromoteVersion(entry, proposal.edits, {
    markdown,
    skill: candidateSkill,
    model: proposal.model,
    sourceUrl: entry.sourceUrl,
    optimizerSource: options.source,
  });

  return {
    status: "promoted",
    proposedEdits: proposal.edits,
    validation,
    promoted,
    retired,
    telemetry,
    modelId: proposal.model,
  };
}

// ─── Cadence helper ──────────────────────────────────────────────────────

const COOLDOWN_DAYS = 28;

/** True if the skill is eligible for an optimization pass right now — i.e.
 *  it hasn't been optimized in the last COOLDOWN_DAYS. */
export function isEligibleForOptimization(entry: MarketplaceEntry, now = new Date()): boolean {
  if (!entry.lastOptimizedAt) return true;
  const last = new Date(entry.lastOptimizedAt).getTime();
  if (Number.isNaN(last)) return true;
  const elapsedDays = (now.getTime() - last) / (1000 * 60 * 60 * 24);
  return elapsedDays >= COOLDOWN_DAYS;
}
