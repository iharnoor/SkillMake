# Grafana dashboard for skillmake_metrics

Cloudflare doesn't ship a first-party Grafana plugin for Analytics Engine. The
working bridge is **Yesoreyeram Infinity** — Grafana's generic JSON/HTTP data
source. It POSTs SQL to the Analytics Engine API and parses the JSON response
into Grafana fields. Free tier of Grafana Cloud handles this whole setup.

## One-time setup (~10 minutes)

### 1. Create a Grafana Cloud account

Go to https://grafana.com/auth/sign-up/create-user and create a free account.
Pick a stack name (e.g. `skillmake`). You'll land on a Grafana instance at
`https://<stack>.grafana.net`.

### 2. Install the Infinity data source plugin

In the Grafana sidebar:
**Connections → Add new connection → search "Infinity" → Install**.

Plugin slug: `yesoreyeram-infinity-datasource`. It's free and lives in the
official Grafana plugin catalog.

### 3. Add Cloudflare Analytics Engine as a data source

After install, click **Add new data source** on the Infinity page.

Configuration:

| Field | Value |
|---|---|
| Name | `Cloudflare Analytics Engine` |
| Authentication → Auth type | `Bearer Token` |
| Authentication → Bearer Token | (paste your `CLOUDFLARE_ANALYTICS_API_TOKEN`) |
| URL → Allowed Hosts | `https://api.cloudflare.com` |
| Health check URL | `https://api.cloudflare.com/client/v4/user/tokens/verify` |

Click **Save & test**. You should see "1 - Data source is working".

### 4. Import the dashboard

In the Grafana sidebar: **Dashboards → New → Import**.

Upload `docs/grafana/skillmake-dashboard.json` from this repo (or paste its
contents). When prompted, pick the `Cloudflare Analytics Engine` data source
you just created. Save.

You should immediately see panels for: install leaderboard, daily install
rate, UA category split, top countries, github_click leaderboard, dwell
distribution, scroll depth, search volume, and API errors.

## How the bridge works

Each Grafana panel is one HTTP POST from Infinity → Analytics Engine SQL API:

```
POST https://api.cloudflare.com/client/v4/accounts/<ACCOUNT_ID>/analytics_engine/sql
Authorization: Bearer <token>
Body: <SQL query>\nFORMAT JSON
```

The response is `{"data": [{...row}, ...]}`. Infinity unwraps `$.data`, then
each row maps to one Grafana field per column. The dashboard JSON encodes the
SQL and column mappings for every panel — open one in edit mode to see the
shape.

## Editing or adding panels

1. Click the panel → **Edit**.
2. Under **Query**, switch type to `JSON` (already set).
3. **URL** is hardcoded with the account ID — leave as-is unless you switch accounts.
4. **Body** is the SQL — paste a new query from `docs/analytics-queries.md`.
5. Under **Parsing options & Result fields**, list the columns you want
   Grafana to see. Numeric columns need type `number`; timestamps need type
   `timestamp`.
6. **Visualization** picker on the right — table, time series, bar gauge, etc.

For a time-series panel, the SQL must return at least one column with type
`timestamp` and one with type `number`. The pre-built dashboard already
includes the right shapes for the daily-install-rate and dwell panels.

## Cost notes

- Grafana Cloud free tier: 10k active series, 50 GB logs, 14 days retention,
  3 users — plenty for this site.
- Analytics Engine reads: free up to the per-account limits documented in
  Cloudflare's pricing page; we read on dashboard refresh only.
- Infinity plugin: free.

## Troubleshooting

- **"Health check failed"**: token doesn't have `Account Analytics:Read` or
  is wrong account. Re-run `curl https://api.cloudflare.com/client/v4/user/tokens/verify`
  with the token to confirm it's valid.
- **"No data" on a panel**: the SQL probably uses `NOW() - INTERVAL '7' DAY`
  and there's nothing in the window. Drop the date filter to confirm rows exist.
- **JSON parse errors**: forgot the trailing `FORMAT JSON` line in the query body.
- **Empty time-series**: your timestamp column wasn't marked as type `timestamp`
  in the field mappings.

## Or skip Grafana and use the in-app path

If you don't want a separate tool, ask for the alternate plan and I'll wire an
`/admin/analytics` page directly into the skillmake Next.js app. Same data,
gated by `ADMIN_TOKEN`, no third-party account.
