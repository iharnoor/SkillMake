#!/usr/bin/env node
/**
 * Pulls the same Analytics Engine queries as src/lib/analytics-dashboard.ts.
 * Usage: node scripts/pull-analytics-snapshot.mjs
 * Reads CLOUDFLARE_* from .env in repo root.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(root, ".env");
const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const accountId = env.CLOUDFLARE_ACCOUNT_ID || "f9d7efb12a2713ce5af52d882165c543";
const token = env.CLOUDFLARE_ANALYTICS_API_TOKEN;
if (!token) {
  console.error(JSON.stringify({ ok: false, error: "CLOUDFLARE_ANALYTICS_API_TOKEN missing in .env" }));
  process.exit(1);
}

const DAY_14 = "timestamp >= NOW() - INTERVAL '14' DAY";
const DAY_7 = "timestamp >= NOW() - INTERVAL '7' DAY";
const DAY_28 = "timestamp >= NOW() - INTERVAL '28' DAY";
const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/analytics_engine/sql`;

async function query(sql) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
    body: `${sql}\nFORMAT JSON`,
  });
  if (!res.ok) throw new Error(`Analytics query failed: ${res.status}`);
  const json = await res.json();
  return Array.isArray(json.data) ? json.data : [];
}

function scalar(rows) {
  const v = rows[0]?.n ?? rows[0]?.value ?? 0;
  return Math.round(Number(v) || 0);
}

function bars(rows, labelKey = "label", valueKey = "value") {
  return rows
    .map((r) => ({
      label: String(r[labelKey] ?? ""),
      value: Math.round(Number(r[valueKey] ?? 0)),
    }))
    .filter((r) => r.value > 0);
}

function points(rows) {
  return rows.map((r) => ({
    label: formatLabel(String(r.label ?? "")),
    value: Math.round(Number(r.value ?? 0)),
  }));
}

function formatLabel(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return value.includes("T")
    ? d.toLocaleString("en-US", { month: "2-digit", day: "2-digit", hour: "2-digit" })
    : d.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit" });
}

function installBars(rows) {
  const totals = new Map();
  for (const row of bars(rows)) {
    const label = row.label.includes("@") ? row.label.slice(0, row.label.indexOf("@")) : row.label;
    totals.set(label, (totals.get(label) ?? 0) + row.value);
  }
  return Array.from(totals, ([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}

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
  query(`SELECT blob2 AS label, sum(_sample_interval) AS value FROM skillmake_metrics WHERE index1 = 'install_hit' AND blob2 != '' GROUP BY label ORDER BY value DESC LIMIT 200`),
  query(`SELECT blob2 AS label, sum(_sample_interval) AS value FROM skillmake_metrics WHERE index1 = 'install_hit' AND blob5 = 'browser' AND blob2 != '' AND ${DAY_14} GROUP BY label ORDER BY value DESC LIMIT 120`),
  query(`SELECT blob2 AS label, sum(_sample_interval) AS value FROM skillmake_metrics WHERE index1 = 'install_hit' AND blob5 IN ('curl','bot','other') AND blob2 != '' AND ${DAY_14} GROUP BY label ORDER BY value DESC LIMIT 120`),
  query(`SELECT blob2 AS label, sum(_sample_interval) AS value FROM skillmake_metrics WHERE index1 = 'marketplace_view' AND blob2 != '' AND ${DAY_14} GROUP BY label ORDER BY value DESC LIMIT 16`),
  query(`SELECT blob2 AS label, sum(_sample_interval) AS value FROM skillmake_metrics WHERE index1 = 'github_click' AND blob2 != '' AND ${DAY_14} GROUP BY label ORDER BY value DESC LIMIT 16`),
  query(`SELECT index1 AS label, sum(_sample_interval) AS value FROM skillmake_metrics WHERE ${DAY_14} GROUP BY label ORDER BY value DESC LIMIT 18`),
  query(`SELECT blob3 AS label, sum(_sample_interval) AS value FROM skillmake_metrics WHERE index1 = 'install_hit' AND ${DAY_14} GROUP BY label ORDER BY value DESC LIMIT 12`),
  query(`SELECT blob2 AS label, sum(_sample_interval) AS value FROM skillmake_metrics WHERE index1 = 'page_dwell' AND ${DAY_14} GROUP BY label ORDER BY value DESC`),
  query(`SELECT blob2 AS label, sum(_sample_interval) AS value FROM skillmake_metrics WHERE index1 = 'scroll_depth' AND ${DAY_14} GROUP BY label ORDER BY value DESC`),
  query(`SELECT index1 AS label, sum(_sample_interval) AS value FROM skillmake_metrics WHERE index1 IN ('home_view','marketplace_view','install_hit','skill_submission_started','skill_submitted','search_submitted') AND ${DAY_14} GROUP BY label ORDER BY value DESC`),
  query(`SELECT blob7 AS label, sum(_sample_interval) AS value FROM skillmake_metrics WHERE index1 = 'skill_added' AND blob7 != '' AND ${DAY_28} GROUP BY label ORDER BY value DESC LIMIT 10`),
  query(`SELECT index1 AS event, blob2 AS slug, double2 AS status, sum(_sample_interval) AS hits FROM skillmake_metrics WHERE index1 IN ('api_error','convert_error') AND ${DAY_14} GROUP BY event, slug, status ORDER BY hits DESC LIMIT 12`),
  query(`SELECT index1 AS label, sum(_sample_interval) AS value FROM skillmake_metrics WHERE timestamp >= NOW() - INTERVAL '24' HOUR GROUP BY label ORDER BY value DESC LIMIT 12`),
]);

const inst = scalar(installs);
const browser = scalar(browserInstalls);

const snapshot = {
  ok: true,
  generatedAt: new Date().toISOString(),
  window: "14d unless noted",
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
    topInstalls: installBars(topInstalls).slice(0, 12),
    topBrowserInstalls: installBars(topBrowserInstalls).slice(0, 10),
    topAgentInstalls: installBars(topAgentInstalls).slice(0, 10),
    topViews: bars(topViews),
    topClicks: bars(topClicks),
    topEvents: bars(topEvents),
    topCountries: bars(topCountries),
    dwell: bars(dwell),
    scroll: bars(scroll).sort((a, b) => Number(a.label) - Number(b.label)),
    funnel: bars(funnel),
    audienceDemand: bars(audienceDemand),
    recentEventMix: bars(recentEventMix),
  },
  tables: {
    errors: errorRows.map((r) => ({
      event: String(r.event ?? ""),
      slug: String(r.slug ?? ""),
      status: Math.round(Number(r.status ?? 0)),
      hits: Math.round(Number(r.hits ?? 0)),
    })),
  },
};

console.log(JSON.stringify(snapshot, null, 2));
