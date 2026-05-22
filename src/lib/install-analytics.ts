import { getEnv } from "./env";

const METRICS_DATASET = "skillmake_metrics";
const TREND_WEEKS = 8;
const CACHE_MS = 5 * 60 * 1000;

export interface InstallSummary {
  installs: number;
  trend: number[];
}

export interface InstallAnalytics {
  available: boolean;
  summaries: Map<string, InstallSummary>;
}

interface TotalRow {
  slug?: unknown;
  installs?: unknown;
}

interface TrendRow extends TotalRow {
  week?: unknown;
}

interface AnalyticsSqlResponse<T> {
  data?: T[];
}

let cache: { expiresAt: number; value: Promise<InstallAnalytics> } | null = null;

/**
 * Read install leaderboard summaries from the same Analytics Engine dataset
 * written by /i/<name>. The public UI treats this as optional: local dev and
 * deployments without read credentials still serve the marketplace.
 */
export async function getInstallAnalytics(): Promise<InstallAnalytics> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) return cache.value;

  const value = loadInstallAnalytics().catch(() => emptyAnalytics());
  cache = { expiresAt: now + CACHE_MS, value };
  return value;
}

async function loadInstallAnalytics(): Promise<InstallAnalytics> {
  const env = await getEnv();
  if (!env.CLOUDFLARE_ACCOUNT_ID || !env.CLOUDFLARE_ANALYTICS_API_TOKEN) {
    return emptyAnalytics();
  }

  const [totals, trends] = await Promise.all([
    query<TotalRow>(
      env.CLOUDFLARE_ACCOUNT_ID,
      env.CLOUDFLARE_ANALYTICS_API_TOKEN,
      `SELECT
         blob2 AS slug,
         sum(_sample_interval) AS installs
       FROM ${METRICS_DATASET}
       WHERE index1 = 'install_hit' AND blob2 != ''
       GROUP BY slug`
    ),
    query<TrendRow>(
      env.CLOUDFLARE_ACCOUNT_ID,
      env.CLOUDFLARE_ANALYTICS_API_TOKEN,
      `SELECT
         blob2 AS slug,
         toStartOfWeek(timestamp) AS week,
         sum(_sample_interval) AS installs
       FROM ${METRICS_DATASET}
       WHERE index1 = 'install_hit'
         AND blob2 != ''
         AND timestamp >= NOW() - INTERVAL '56' DAY
       GROUP BY slug, week
       ORDER BY week ASC`
    ),
  ]);

  const weekIndex = new Map(weekStarts().map((week, index) => [week, index]));
  const summaries = new Map<string, InstallSummary>();

  for (const row of totals) {
    const slug = rowSlug(row);
    if (!slug) continue;
    summaries.set(slug, { installs: rowCount(row), trend: zeroTrend() });
  }

  for (const row of trends) {
    const slug = rowSlug(row);
    const week = rowWeek(row);
    const index = week ? weekIndex.get(week) : undefined;
    if (!slug || index === undefined) continue;
    const summary = summaries.get(slug) ?? { installs: 0, trend: zeroTrend() };
    summary.trend[index] = rowCount(row);
    summaries.set(slug, summary);
  }

  return { available: true, summaries };
}

async function query<T>(accountId: string, token: string, sql: string): Promise<T[]> {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/analytics_engine/sql`,
    {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
      body: `${sql}\nFORMAT JSON`,
    }
  );
  if (!res.ok) throw new Error(`Analytics Engine query failed: ${res.status}`);
  const json = (await res.json()) as AnalyticsSqlResponse<T>;
  return Array.isArray(json.data) ? json.data : [];
}

function weekStarts(reference = new Date()): string[] {
  const monday = new Date(
    Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), reference.getUTCDate())
  );
  const daysSinceMonday = (monday.getUTCDay() + 6) % 7;
  monday.setUTCDate(monday.getUTCDate() - daysSinceMonday);

  return Array.from({ length: TREND_WEEKS }, (_, index) => {
    const week = new Date(monday);
    week.setUTCDate(week.getUTCDate() - (TREND_WEEKS - index - 1) * 7);
    return week.toISOString().slice(0, 10);
  });
}

function rowSlug(row: TotalRow): string | null {
  return typeof row.slug === "string" && row.slug ? row.slug : null;
}

function rowWeek(row: TrendRow): string | null {
  return typeof row.week === "string" ? row.week.slice(0, 10) : null;
}

function rowCount(row: TotalRow): number {
  const n = typeof row.installs === "number" ? row.installs : Number(row.installs);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

function zeroTrend(): number[] {
  return Array.from({ length: TREND_WEEKS }, () => 0);
}

function emptyAnalytics(): InstallAnalytics {
  return { available: false, summaries: new Map() };
}
