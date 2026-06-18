#!/usr/bin/env node
/**
 * One-time backfill of Cloudflare Analytics Engine history into PostHog.
 *
 * Replays the retained Analytics Engine window (~90 days) as past-dated PostHog
 * events so PostHog's trends/breakdowns show history that predates the SDK going
 * live. Each de-sampled count becomes one synthetic event, grouped by
 * day × event × slug × country × ua_category, so all the usual breakdowns survive.
 *
 * Honest limits (see docs/analytics-posthog.md):
 *  - Analytics Engine is SAMPLED — counts are estimates, not exact.
 *  - There were never stable user IDs (only daily-rotating visitor hashes), so
 *    backfilled events carry NO real person. Every event sets
 *    `$process_person_profile:false`; retention/journeys stay forward-only.
 *  - Events are tagged `backfilled:true` + `source:"cloudflare-analytics-engine"`
 *    so you can exclude them from any insight with a property filter.
 *  - Sent via the /batch/ endpoint with `historical_migration:true` (PostHog's
 *    documented import lane — won't trigger alerts/actions).
 *
 * Usage:
 *   node scripts/backfill-posthog.mjs              # DRY RUN — queries CF, sends nothing
 *   node scripts/backfill-posthog.mjs --live       # actually send to PostHog
 *   node scripts/backfill-posthog.mjs --days 30     # limit window (default: all retained)
 *
 * Reads CLOUDFLARE_* and POSTHOG/NEXT_PUBLIC_POSTHOG_* from .env in repo root.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fileEnv = Object.fromEntries(
  readFileSync(resolve(root, ".env"), "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);
// .env wins, but fall back to process.env (e.g. CLOUDFLARE_ACCOUNT_ID lives in
// wrangler.jsonc vars, not .env, so it can be passed inline).
const env = { ...process.env, ...fileEnv };

const args = process.argv.slice(2);
const LIVE = args.includes("--live");
const daysArg = args.indexOf("--days");
const WINDOW_DAYS = daysArg >= 0 ? Number(args[daysArg + 1]) : null;
// The posthog-js SDK + server mirror went live on this date (the production
// deploy). Live capture owns everything from here forward, so backfill must
// STOP before it to avoid double-counting. Override with --until YYYY-MM-DD.
const untilArg = args.indexOf("--until");
const SDK_LIVE_FROM = untilArg >= 0 ? args[untilArg + 1] : "2026-06-17";

const accountId = env.CLOUDFLARE_ACCOUNT_ID;
const cfToken = env.CLOUDFLARE_ANALYTICS_API_TOKEN;
const phKey = env.POSTHOG_API_KEY || env.NEXT_PUBLIC_POSTHOG_KEY;
const phHost = (env.NEXT_PUBLIC_POSTHOG_HOST || env.POSTHOG_HOST || "https://us.i.posthog.com").replace(/\/$/, "");

function die(msg) {
  console.error(`ERROR: ${msg}`);
  process.exit(1);
}
if (!accountId) die("CLOUDFLARE_ACCOUNT_ID missing in .env");
if (!cfToken) die("CLOUDFLARE_ANALYTICS_API_TOKEN missing in .env");
if (!phKey) die("POSTHOG_API_KEY / NEXT_PUBLIC_POSTHOG_KEY missing in .env");

const cfEndpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/analytics_engine/sql`;

// Client-captured events are already in PostHog via posthog-js going forward and
// would double-count if replayed, so skip them — mirrors POSTHOG_CLIENT_EVENTS
// in src/lib/metrics-core.ts.
const SKIP_EVENTS = new Set([
  "github_click",
  "prompt_copy",
  "prompt_source_click",
  "page_dwell",
  "scroll_depth",
]);

async function cfQuery(sql) {
  const res = await fetch(cfEndpoint, {
    method: "POST",
    headers: { authorization: `Bearer ${cfToken}` },
    body: `${sql}\nFORMAT JSON`,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Analytics query failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return Array.isArray(json.data) ? json.data : [];
}

const ROW_LIMIT = 10000;
const MAX_DAYS = WINDOW_DAYS || 100; // AE retains ~90d; 100 covers it with slack
const CHUNK = 5; // days per query — keeps each result well under the row cap

// Finest grouping that still preserves every breakdown without double-counting.
// The window is chunked into small date ranges because a single full-window
// query overflows the API's 10k-row response cap and silently truncates.
function chunkSql(lo, hi) {
  const range =
    `WHERE timestamp >= NOW() - INTERVAL '${hi}' DAY ` +
    `AND timestamp < NOW() - INTERVAL '${lo}' DAY`;
  return (
    "SELECT toStartOfDay(timestamp) AS day, index1 AS event, blob2 AS slug, " +
    "blob3 AS country, blob5 AS ua, blob7 AS audience, blob8 AS category, " +
    "sum(_sample_interval) AS n " +
    `FROM skillmake_metrics ${range} ` +
    "GROUP BY day, event, slug, country, ua, audience, category " +
    `ORDER BY day LIMIT ${ROW_LIMIT}`
  );
}

console.log(`[1/3] Querying Cloudflare Analytics Engine in ${CHUNK}-day chunks (up to ${MAX_DAYS}d back)...`);
const rows = [];
for (let lo = 0; lo < MAX_DAYS; lo += CHUNK) {
  const hi = Math.min(lo + CHUNK, MAX_DAYS);
  const chunk = await cfQuery(chunkSql(lo, hi));
  if (chunk.length === ROW_LIMIT) {
    console.warn(`⚠ Chunk ${lo}-${hi}d hit the ${ROW_LIMIT}-row cap — lower CHUNK and re-run.`);
  }
  rows.push(...chunk);
  process.stdout.write(`\r      scanned ${hi}d back, ${rows.length.toLocaleString()} grouped rows`);
}
console.log("");

// Build the synthetic-event list. One event per estimated count, timestamps
// spread evenly across the day so they look natural and carry unique uuids.
const events = [];
const perEvent = {};
let minDay = null;
let maxDay = null;
let skipped = 0;
let overlapSkipped = 0;

for (const r of rows) {
  const event = String(r.event ?? "");
  if (!event) continue;
  if (SKIP_EVENTS.has(event)) {
    skipped += Math.round(Number(r.n ?? 0)) || 0;
    continue;
  }
  const count = Math.round(Number(r.n ?? 0)) || 0;
  if (count <= 0) continue;

  const day = String(r.day ?? "").slice(0, 10);
  if (!day) continue;
  // Don't replay days the live SDK already covers — that would double-count.
  if (day >= SDK_LIVE_FROM) {
    overlapSkipped += count;
    continue;
  }
  if (minDay === null || day < minDay) minDay = day;
  if (maxDay === null || day > maxDay) maxDay = day;
  perEvent[event] = (perEvent[event] ?? 0) + count;

  const slug = String(r.slug ?? "");
  const country = String(r.country ?? "");
  const ua = String(r.ua ?? "");
  const audience = String(r.audience ?? "");
  const category = String(r.category ?? "");
  const dayStartMs = Date.parse(`${day}T00:00:00Z`);
  const stepMs = Math.floor(86_400_000 / (count + 1));

  for (let i = 0; i < count; i++) {
    const properties = {
      backfilled: true,
      source: "cloudflare-analytics-engine",
      $lib: "skillmake-backfill",
      $process_person_profile: false,
    };
    if (slug) properties.skill_slug = slug;
    if (country && country !== "??") properties.country = country;
    if (ua) properties.ua_category = ua;
    if (audience) properties.skill_audience = audience;
    if (category) properties.skill_category = category;

    events.push({
      event,
      // Anonymous, unique per event. With person profiles off this creates no
      // person rows — it just keeps each event distinct.
      distinct_id: `cf-backfill-${day}-${randomUUID()}`,
      timestamp: new Date(dayStartMs + stepMs * (i + 1)).toISOString(),
      properties,
      uuid: randomUUID(),
    });
  }
}

console.log(`[2/3] Built ${events.length.toLocaleString()} synthetic events from ${rows.length} grouped rows.`);
console.log(`      Date range: ${minDay ?? "n/a"} → ${maxDay ?? "n/a"}`);
console.log(`      Per-event breakdown:`);
for (const [e, n] of Object.entries(perEvent).sort((a, b) => b[1] - a[1])) {
  console.log(`        ${e.padEnd(26)} ${n.toLocaleString()}`);
}
if (skipped > 0) {
  console.log(`      (skipped ${skipped.toLocaleString()} client-captured events to avoid double-counting)`);
}
if (overlapSkipped > 0) {
  console.log(`      (skipped ${overlapSkipped.toLocaleString()} events on/after ${SDK_LIVE_FROM} — live SDK already owns them)`);
}

if (!LIVE) {
  console.log(`\n[3/3] DRY RUN — nothing sent. Re-run with --live to push these ${events.length.toLocaleString()} events to PostHog (${phHost}).`);
  process.exit(0);
}

// Live send: PostHog /batch/ with historical_migration. Chunk to stay well
// under payload limits.
const BATCH = 500;
let sent = 0;
console.log(`\n[3/3] LIVE — sending ${events.length.toLocaleString()} events to ${phHost}/batch/ ...`);
for (let i = 0; i < events.length; i += BATCH) {
  const batch = events.slice(i, i + BATCH);
  const res = await fetch(`${phHost}/batch/`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ api_key: phKey, historical_migration: true, batch }),
  });
  if (!res.ok) {
    die(`batch ${i / BATCH} failed: ${res.status} ${await res.text()}`);
  }
  sent += batch.length;
  process.stdout.write(`\r      sent ${sent.toLocaleString()}/${events.length.toLocaleString()}`);
}
console.log(`\n✓ Done. ${sent.toLocaleString()} backfilled events sent. They carry backfilled:true — filter on it in PostHog to include/exclude.`);
