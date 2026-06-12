/**
 * Durable install history.
 *
 * Cloudflare Analytics Engine only retains events for a rolling window (~90d),
 * so the "all-time" install total would silently start dropping its oldest days
 * once the window fills. This module captures each COMPLETED day's install count
 * into MARKETPLACE_KV before it ages out, giving us a lifetime total that
 * survives retention.
 *
 * Storage: one KV blob at INSTALL_DAYS_KEY, JSON `{ "YYYY-MM-DD": count }`,
 * completed days only (never today — today is always read live from CF so the
 * number moves in real time).
 *
 * Durable lifetime = sum(stored completed days) + CF count for every day after
 * the latest stored day (today, plus any completed day the cron hasn't captured
 * yet). When KV is empty (e.g. local dev with no binding, or before the first
 * cron run) this degrades to the plain CF retained-window total.
 */

import { getEnv } from "./env";

export const INSTALL_DAYS_KEY = "analytics:installs:days";

type DayMap = Record<string, number>;

interface DayCount {
  date: string; // YYYY-MM-DD (UTC)
  count: number;
}

export interface DurableInstallTotal {
  /** Lifetime installs, immune to Analytics Engine retention. */
  lifetime: number;
  /** Number of completed days persisted in KV. */
  storedDays: number;
  /** "kv+live" once any day is persisted; "live-only" before the first snapshot. */
  source: "kv+live" | "live-only";
}

export interface SnapshotResult {
  ranAt: string;
  persisted: boolean;
  added: string[];
  storedDays: number;
  lifetime: number;
  message?: string;
}

/** Per-day install counts from Analytics Engine over its retained window. */
async function queryInstallsByDay(accountId: string, token: string): Promise<DayCount[]> {
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/analytics_engine/sql`;
  const sql =
    "SELECT toStartOfDay(timestamp) AS d, sum(_sample_interval) AS n " +
    "FROM skillmake_metrics WHERE index1 = 'install_hit' GROUP BY d ORDER BY d";
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
    body: `${sql}\nFORMAT JSON`,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Analytics per-day query failed with ${res.status}`);
  const json = (await res.json()) as { data?: Array<Record<string, unknown>> };
  const rows = Array.isArray(json.data) ? json.data : [];
  return rows.map((row) => ({
    date: String(row.d ?? "").slice(0, 10),
    count: Math.round(Number(row.n ?? 0)) || 0,
  })).filter((r) => r.date.length === 10);
}

async function readDayMap(): Promise<DayMap> {
  const env = await getEnv();
  if (!env.MARKETPLACE_KV) return {};
  const raw = await env.MARKETPLACE_KV.get(INSTALL_DAYS_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as DayMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function sumDays(days: DayMap): number {
  let total = 0;
  for (const v of Object.values(days)) total += Number(v) || 0;
  return total;
}

function latestDay(days: DayMap): string | null {
  let latest: string | null = null;
  for (const date of Object.keys(days)) {
    if (latest === null || date > latest) latest = date;
  }
  return latest;
}

/** UTC date string (YYYY-MM-DD) for "today" — the day we never persist. */
function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Lifetime install total for the dashboard. Combines persisted completed days
 * with a live CF read of everything after the latest persisted day.
 */
export async function getDurableInstallTotal(): Promise<DurableInstallTotal> {
  const env = await getEnv();
  const days = await readDayMap();
  const kvSum = sumDays(days);
  const latest = latestDay(days);
  const storedDays = Object.keys(days).length;

  if (!env.CLOUDFLARE_ACCOUNT_ID || !env.CLOUDFLARE_ANALYTICS_API_TOKEN) {
    // No CF access: best effort from KV alone.
    return { lifetime: kvSum, storedDays, source: storedDays > 0 ? "kv+live" : "live-only" };
  }

  const byDay = await queryInstallsByDay(env.CLOUDFLARE_ACCOUNT_ID, env.CLOUDFLARE_ANALYTICS_API_TOKEN);
  let liveTail = 0;
  for (const { date, count } of byDay) {
    if (latest === null || date > latest) liveTail += count;
  }

  return {
    lifetime: kvSum + liveTail,
    storedDays,
    source: storedDays > 0 ? "kv+live" : "live-only",
  };
}

/**
 * Capture snapshot: persist every COMPLETED day (< today UTC) not yet stored.
 * Idempotent and self-healing — backfills the whole retained window on first
 * run, catches up after a missed run, and never overwrites a day already saved
 * (so the value captured while the day was freshest in CF is the canonical one).
 */
export async function captureInstallSnapshot(): Promise<SnapshotResult> {
  const ranAt = new Date().toISOString();
  const env = await getEnv();

  if (!env.CLOUDFLARE_ACCOUNT_ID || !env.CLOUDFLARE_ANALYTICS_API_TOKEN) {
    return { ranAt, persisted: false, added: [], storedDays: 0, lifetime: 0, message: "missing_cloudflare_analytics_config" };
  }
  if (!env.MARKETPLACE_KV) {
    return { ranAt, persisted: false, added: [], storedDays: 0, lifetime: 0, message: "missing_kv_binding" };
  }

  const byDay = await queryInstallsByDay(env.CLOUDFLARE_ACCOUNT_ID, env.CLOUDFLARE_ANALYTICS_API_TOKEN);
  const days = await readDayMap();
  const today = todayUtc();
  const added: string[] = [];

  for (const { date, count } of byDay) {
    if (date >= today) continue; // never persist today (or future skew) — it's still live
    if (date in days) continue; // already captured; keep the freshest value
    days[date] = count;
    added.push(date);
  }

  if (added.length > 0) {
    await env.MARKETPLACE_KV.put(INSTALL_DAYS_KEY, JSON.stringify(days));
  }

  const kvSum = sumDays(days);
  // Lifetime including today's live partial, mirroring the dashboard math.
  let liveTail = 0;
  const latest = latestDay(days);
  for (const { date, count } of byDay) {
    if (latest === null || date > latest) liveTail += count;
  }

  return {
    ranAt,
    persisted: added.length > 0,
    added,
    storedDays: Object.keys(days).length,
    lifetime: kvSum + liveTail,
  };
}
