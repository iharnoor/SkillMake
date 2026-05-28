import { getEnv } from "./env";

type Row = Record<string, unknown>;

export interface AnalyticsDashboardData {
  ok: true;
  generatedAt: string;
  totals: {
    installs: number;
    uniqueVisitors: number;
    events: number;
    apiErrors: number;
    agentInstalls: number;
    browserInstalls: number;
    humanInstallPct: number | null;
    crawlerInstalls: number;
  };
  series: {
    installsByDay: Point[];
    installsByHour: Point[];
    errorsByHour: Point[];
    uniquesByDay: Point[];
  };
  bars: {
    uaSplit: Bar[];
    topInstalls: Bar[];
    topBrowserInstalls: Bar[];
    topAgentInstalls: Bar[];
    topViews: Bar[];
    topClicks: Bar[];
    topEvents: Bar[];
    topCountries: Bar[];
    dwell: Bar[];
    scroll: Bar[];
    funnel: Bar[];
    audienceDemand: Bar[];
  };
  tables: {
    errors: ErrorRow[];
    recentEventMix: Bar[];
  };
}

export interface AnalyticsDashboardError {
  ok: false;
  reason: "missing_config" | "query_failed";
  message: string;
}

export type AnalyticsDashboardResult = AnalyticsDashboardData | AnalyticsDashboardError;

export interface Point {
  label: string;
  value: number;
}

export interface Bar {
  label: string;
  value: number;
}

export interface ErrorRow {
  event: string;
  slug: string;
  status: number;
  hits: number;
}

const DAY_14 = "timestamp >= NOW() - INTERVAL '14' DAY";
const DAY_7 = "timestamp >= NOW() - INTERVAL '7' DAY";
const DAY_28 = "timestamp >= NOW() - INTERVAL '28' DAY";

export async function getAnalyticsDashboardData(): Promise<AnalyticsDashboardResult> {
  const env = await getEnv();
  if (!env.CLOUDFLARE_ACCOUNT_ID || !env.CLOUDFLARE_ANALYTICS_API_TOKEN) {
    return {
      ok: false,
      reason: "missing_config",
      message:
        "Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_ANALYTICS_API_TOKEN so the dashboard can query Cloudflare Analytics Engine.",
    };
  }

  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/analytics_engine/sql`;

  const query = async (sql: string): Promise<Row[]> => {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { authorization: `Bearer ${env.CLOUDFLARE_ANALYTICS_API_TOKEN}` },
      body: `${sql}\nFORMAT JSON`,
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Analytics query failed with ${res.status}`);
    const json = (await res.json()) as { data?: unknown };
    return Array.isArray(json.data) ? (json.data as Row[]) : [];
  };

  try {
    const [
      installs,
      uniques,
      events,
      errors,
      agentInstalls,
      browserInstalls,
      crawlerInstalls,
      installsByDay,
      installsByHour,
      errorsByHour,
      uniquesByDay,
      uaSplit,
      topInstalls,
      topBrowserInstalls,
      topAgentInstalls,
      topViews,
      topClicks,
      topEvents,
      topCountries,
      dwell,
      scroll,
      funnel,
      audienceDemand,
      errorRows,
      recentEventMix,
    ] = await Promise.all([
      query(`SELECT sum(_sample_interval) AS n FROM skillmake_metrics WHERE index1 = 'install_hit' AND ${DAY_14}`),
      query(`SELECT count(DISTINCT blob6) AS n FROM skillmake_metrics WHERE ${DAY_14}`),
      query(`SELECT sum(_sample_interval) AS n FROM skillmake_metrics WHERE ${DAY_14}`),
      query(`SELECT sum(_sample_interval) AS n FROM skillmake_metrics WHERE index1 IN ('api_error','convert_error') AND ${DAY_14}`),
      query(`SELECT sum(_sample_interval) AS n FROM skillmake_metrics WHERE index1 = 'install_hit' AND blob5 IN ('curl','bot','other') AND ${DAY_14}`),
      query(`SELECT sum(_sample_interval) AS n FROM skillmake_metrics WHERE index1 = 'install_hit' AND blob5 = 'browser' AND ${DAY_14}`),
      query(`SELECT sum(_sample_interval) AS n FROM skillmake_metrics WHERE index1 = 'install_hit' AND blob5 IN ('bot','other') AND ${DAY_14}`),
      query(`SELECT toStartOfDay(timestamp) AS label, sum(_sample_interval) AS value FROM skillmake_metrics WHERE index1 = 'install_hit' AND ${DAY_14} GROUP BY label ORDER BY label`),
      query(`SELECT toStartOfHour(timestamp) AS label, sum(_sample_interval) AS value FROM skillmake_metrics WHERE index1 = 'install_hit' AND ${DAY_7} GROUP BY label ORDER BY label`),
      query(`SELECT toStartOfHour(timestamp) AS label, sum(_sample_interval) AS value FROM skillmake_metrics WHERE index1 IN ('api_error','convert_error') AND ${DAY_7} GROUP BY label ORDER BY label`),
      query(`SELECT toStartOfDay(timestamp) AS label, count(DISTINCT blob6) AS value FROM skillmake_metrics WHERE ${DAY_14} GROUP BY label ORDER BY label`),
      query(`SELECT blob5 AS label, sum(_sample_interval) AS value FROM skillmake_metrics WHERE index1 = 'install_hit' AND ${DAY_14} GROUP BY label ORDER BY value DESC`),
      query(`SELECT splitByChar('@', blob2)[1] AS label, sum(_sample_interval) AS value FROM skillmake_metrics WHERE index1 = 'install_hit' AND blob2 != '' GROUP BY label ORDER BY value DESC LIMIT 20`),
      query(`SELECT splitByChar('@', blob2)[1] AS label, sum(_sample_interval) AS value FROM skillmake_metrics WHERE index1 = 'install_hit' AND blob5 = 'browser' AND blob2 != '' AND ${DAY_14} GROUP BY label ORDER BY value DESC LIMIT 16`),
      query(`SELECT splitByChar('@', blob2)[1] AS label, sum(_sample_interval) AS value FROM skillmake_metrics WHERE index1 = 'install_hit' AND blob5 IN ('curl','bot','other') AND blob2 != '' AND ${DAY_14} GROUP BY label ORDER BY value DESC LIMIT 16`),
      query(`SELECT blob2 AS label, sum(_sample_interval) AS value FROM skillmake_metrics WHERE index1 = 'marketplace_view' AND blob2 != '' AND ${DAY_14} GROUP BY label ORDER BY value DESC LIMIT 16`),
      query(`SELECT blob2 AS label, sum(_sample_interval) AS value FROM skillmake_metrics WHERE index1 = 'github_click' AND blob2 != '' AND ${DAY_14} GROUP BY label ORDER BY value DESC LIMIT 16`),
      query(`SELECT index1 AS label, sum(_sample_interval) AS value FROM skillmake_metrics WHERE ${DAY_14} GROUP BY label ORDER BY value DESC LIMIT 18`),
      query(`SELECT blob3 AS label, sum(_sample_interval) AS value FROM skillmake_metrics WHERE index1 = 'install_hit' AND ${DAY_14} GROUP BY label ORDER BY value DESC LIMIT 12`),
      query(`SELECT blob2 AS label, sum(_sample_interval) AS value FROM skillmake_metrics WHERE index1 = 'page_dwell' AND ${DAY_14} GROUP BY label ORDER BY CASE label WHEN '0-5s' THEN 1 WHEN '5-15s' THEN 2 WHEN '15-30s' THEN 3 WHEN '30-60s' THEN 4 WHEN '60-300s' THEN 5 WHEN '300s+' THEN 6 ELSE 99 END`),
      query(`SELECT blob2 AS label, sum(_sample_interval) AS value FROM skillmake_metrics WHERE index1 = 'scroll_depth' AND ${DAY_14} GROUP BY label ORDER BY toInt32OrZero(label)`),
      query(`SELECT index1 AS label, sum(_sample_interval) AS value FROM skillmake_metrics WHERE index1 IN ('home_view','marketplace_view','install_hit','submit_started','submit_completed','search_submitted') AND ${DAY_14} GROUP BY label ORDER BY value DESC`),
      query(`SELECT blob7 AS label, sum(_sample_interval) AS value FROM skillmake_metrics WHERE index1 = 'skill_approved' AND blob7 != '' AND ${DAY_28} GROUP BY label ORDER BY value DESC LIMIT 10`),
      query(`SELECT index1 AS event, blob2 AS slug, double2 AS status, sum(_sample_interval) AS hits FROM skillmake_metrics WHERE index1 IN ('api_error','convert_error') AND ${DAY_14} GROUP BY event, slug, status ORDER BY hits DESC LIMIT 12`),
      query(`SELECT index1 AS label, sum(_sample_interval) AS value FROM skillmake_metrics WHERE timestamp >= NOW() - INTERVAL '24' HOUR GROUP BY label ORDER BY value DESC LIMIT 12`),
    ]);

    const inst = scalar(installs);
    const browser = scalar(browserInstalls);
    return {
      ok: true,
      generatedAt: new Date().toISOString(),
      totals: {
        installs: inst,
        uniqueVisitors: scalar(uniques),
        events: scalar(events),
        apiErrors: scalar(errors),
        agentInstalls: scalar(agentInstalls),
        browserInstalls: browser,
        humanInstallPct: inst > 0 ? Math.round((browser / inst) * 1000) / 10 : null,
        crawlerInstalls: scalar(crawlerInstalls),
      },
      series: {
        installsByDay: points(installsByDay),
        installsByHour: points(installsByHour),
        errorsByHour: points(errorsByHour),
        uniquesByDay: points(uniquesByDay),
      },
      bars: {
        uaSplit: bars(uaSplit),
        topInstalls: bars(topInstalls),
        topBrowserInstalls: bars(topBrowserInstalls),
        topAgentInstalls: bars(topAgentInstalls),
        topViews: bars(topViews),
        topClicks: bars(topClicks),
        topEvents: bars(topEvents),
        topCountries: bars(topCountries),
        dwell: bars(dwell),
        scroll: bars(scroll),
        funnel: bars(funnel),
        audienceDemand: bars(audienceDemand),
      },
      tables: {
        errors: errorRows.map((row) => ({
          event: text(row.event),
          slug: text(row.slug),
          status: numeric(row.status),
          hits: numeric(row.hits),
        })),
        recentEventMix: bars(recentEventMix),
      },
    };
  } catch (err) {
    return {
      ok: false,
      reason: "query_failed",
      message: err instanceof Error ? err.message : "Analytics query failed.",
    };
  }
}

function scalar(rows: Row[]): number {
  return rows.length > 0 ? numeric(rows[0].n) : 0;
}

function points(rows: Row[]): Point[] {
  return rows.map((row) => ({
    label: formatLabel(text(row.label)),
    value: numeric(row.value),
  }));
}

function bars(rows: Row[]): Bar[] {
  return rows
    .map((row) => ({
      label: text(row.label) || "(empty)",
      value: numeric(row.value),
    }))
    .filter((row) => row.value > 0);
}

function numeric(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function formatLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return value.includes("T")
    ? date.toLocaleString("en-US", { month: "2-digit", day: "2-digit", hour: "2-digit" })
    : date.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit" });
}
