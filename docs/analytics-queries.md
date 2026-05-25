# SkillMake — Analytics Engine queries

All install + view events land in the `skillmake_metrics` dataset on Cloudflare
Workers Analytics Engine. Use these queries from the Cloudflare dashboard or the
SQL API to track usage. The site itself does not render install counts — keep
the cost surface server-side and the dashboards in Cloudflare.

## How to run

**Dashboard:** Cloudflare → Workers & Pages → Analytics Engine → SQL Editor →
paste the query → Run.

**API:** any token with `Account Analytics:Read`.

```bash
ACCOUNT_ID=f9d7efb12a2713ce5af52d882165c543
TOKEN=...                                  # Account Analytics:Read
curl -s "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/analytics_engine/sql" \
  -H "Authorization: Bearer $TOKEN" \
  --data-binary @- <<'SQL'
SELECT blob2 AS slug, sum(_sample_interval) AS installs
FROM skillmake_metrics
WHERE index1 = 'install_hit' AND blob2 != ''
GROUP BY slug
ORDER BY installs DESC
FORMAT JSON
SQL
```

## Event shape

| Column     | Meaning                                                  |
|------------|----------------------------------------------------------|
| `index1`   | event name (`install_hit`, `home_view`, `marketplace_view`, `tricks_view`, `powerhouse_view`, `submit_started`, `submit_completed`, `convert_success`, `convert_error`, `search_submitted`, `github_click`, `page_dwell`, `scroll_depth`, `api_error`) |
| `blob1`    | event name (mirrors `index1`)                            |
| `blob2`    | skill slug, bucket, route fragment, or hashed search query — depends on event |
| `blob3`    | country (`cf-ipcountry`, `??` if unknown)                |
| `blob4`    | referer host (empty for direct hits)                     |
| `blob5`    | UA category (`curl` / `browser` / `bot` / `other`)       |
| `blob6`    | daily visitor id (sha256(ip+ua+day) → 8 bytes)           |
| `double1`  | always `1`                                               |
| `double2`  | HTTP status (`api_error`, `convert_error` only)          |

Analytics Engine samples on write, so always use `sum(_sample_interval)` — not
`count()` — to get the true total.

## Install leaderboard (all-time)

```sql
SELECT
  blob2 AS slug,
  sum(_sample_interval) AS installs
FROM skillmake_metrics
WHERE index1 = 'install_hit' AND blob2 != ''
GROUP BY slug
ORDER BY installs DESC
LIMIT 50
```

## Installs per day (last 60 days)

```sql
SELECT
  toStartOfDay(timestamp) AS day,
  sum(_sample_interval) AS installs
FROM skillmake_metrics
WHERE index1 = 'install_hit'
  AND timestamp >= NOW() - INTERVAL '60' DAY
GROUP BY day
ORDER BY day ASC
```

## 8-week trend per skill (the screenshot you saw)

```sql
SELECT
  blob2 AS slug,
  toStartOfWeek(timestamp) AS week,
  sum(_sample_interval) AS installs
FROM skillmake_metrics
WHERE index1 = 'install_hit'
  AND blob2 != ''
  AND timestamp >= NOW() - INTERVAL '56' DAY
GROUP BY slug, week
ORDER BY slug, week
```

## Real installs vs bots

Curl + browser are humans (or human-driven). `bot` is anything matching
crawl/spider/preview UAs.

```sql
SELECT
  blob5 AS ua_category,
  sum(_sample_interval) AS hits
FROM skillmake_metrics
WHERE index1 = 'install_hit'
  AND timestamp >= NOW() - INTERVAL '30' DAY
GROUP BY ua_category
ORDER BY hits DESC
```

## Top installs from agent-style clients

```sql
SELECT
  blob2 AS slug,
  sum(_sample_interval) AS curl_installs
FROM skillmake_metrics
WHERE index1 = 'install_hit'
  AND blob5 = 'curl'
  AND blob2 != ''
  AND timestamp >= NOW() - INTERVAL '30' DAY
GROUP BY slug
ORDER BY curl_installs DESC
LIMIT 20
```

## Installs by country (last 30 days)

```sql
SELECT
  blob3 AS country,
  sum(_sample_interval) AS installs
FROM skillmake_metrics
WHERE index1 = 'install_hit'
  AND timestamp >= NOW() - INTERVAL '30' DAY
GROUP BY country
ORDER BY installs DESC
LIMIT 25
```

## Where installs come from (top referrers)

```sql
SELECT
  blob4 AS referer,
  sum(_sample_interval) AS installs
FROM skillmake_metrics
WHERE index1 = 'install_hit'
  AND blob4 != ''
  AND timestamp >= NOW() - INTERVAL '30' DAY
GROUP BY referer
ORDER BY installs DESC
LIMIT 25
```

## Daily unique visitors

`blob6` is `sha256(ip + ua + day)` truncated to 8 bytes — same visitor on the
same day collapses into one id, regardless of how many pages they hit.

```sql
SELECT
  toStartOfDay(timestamp) AS day,
  uniq(blob6) AS daily_uniques
FROM skillmake_metrics
WHERE timestamp >= NOW() - INTERVAL '30' DAY
GROUP BY day
ORDER BY day ASC
```

## Funnel: home view → install in same day

```sql
WITH
  home AS (
    SELECT blob6 AS visitor, toStartOfDay(timestamp) AS day
    FROM skillmake_metrics
    WHERE index1 = 'home_view'
      AND timestamp >= NOW() - INTERVAL '30' DAY
    GROUP BY visitor, day
  ),
  installs AS (
    SELECT blob6 AS visitor, toStartOfDay(timestamp) AS day
    FROM skillmake_metrics
    WHERE index1 = 'install_hit'
      AND timestamp >= NOW() - INTERVAL '30' DAY
    GROUP BY visitor, day
  )
SELECT
  home.day AS day,
  count(DISTINCT home.visitor) AS home_visitors,
  count(DISTINCT installs.visitor) AS installers,
  round(count(DISTINCT installs.visitor) / count(DISTINCT home.visitor) * 100, 2) AS pct
FROM home
LEFT JOIN installs ON home.visitor = installs.visitor AND home.day = installs.day
GROUP BY day
ORDER BY day ASC
```

## Top search queries (last 30 days)

`search_submitted` stores a **hashed** query in `blob2` (sha256 of normalized text).
Use this for volume trends, not to read literal search strings.

```sql
SELECT
  blob2 AS query_hash,
  sum(_sample_interval) AS searches
FROM skillmake_metrics
WHERE index1 = 'search_submitted'
  AND blob2 != ''
  AND timestamp >= NOW() - INTERVAL '30' DAY
GROUP BY query_hash
ORDER BY searches DESC
LIMIT 50
```

## Search → install (did the query land?)

Same-day visitors who searched and then installed something.

```sql
WITH
  searched AS (
    SELECT blob6 AS visitor, toStartOfDay(timestamp) AS day
    FROM skillmake_metrics
    WHERE index1 = 'search_submitted'
      AND timestamp >= NOW() - INTERVAL '30' DAY
    GROUP BY visitor, day
  ),
  installed AS (
    SELECT blob6 AS visitor, toStartOfDay(timestamp) AS day
    FROM skillmake_metrics
    WHERE index1 = 'install_hit'
      AND timestamp >= NOW() - INTERVAL '30' DAY
    GROUP BY visitor, day
  )
SELECT
  searched.day AS day,
  count(DISTINCT searched.visitor) AS searchers,
  count(DISTINCT installed.visitor) AS converted,
  round(count(DISTINCT installed.visitor) / count(DISTINCT searched.visitor) * 100, 2) AS pct
FROM searched
LEFT JOIN installed ON searched.visitor = installed.visitor AND searched.day = installed.day
GROUP BY day
ORDER BY day ASC
```

## Audience-filter demand (homepage pill clicks)

`home_view` writes the filter slug as `blob2`. Empty = unfiltered.

```sql
SELECT
  blob2 AS filter,
  sum(_sample_interval) AS views
FROM skillmake_metrics
WHERE index1 = 'home_view'
  AND blob2 != ''
  AND timestamp >= NOW() - INTERVAL '30' DAY
GROUP BY filter
ORDER BY views DESC
```

## Top GitHub outbound clicks

Which repos people actually open from the marketplace.

```sql
SELECT
  blob2 AS slug,
  sum(_sample_interval) AS github_clicks
FROM skillmake_metrics
WHERE index1 = 'github_click'
  AND blob2 != ''
  AND timestamp >= NOW() - INTERVAL '30' DAY
GROUP BY slug
ORDER BY github_clicks DESC
LIMIT 25
```

## Dwell-time distribution (engagement)

`page_dwell` buckets: `0-5s` / `5-15s` / `15-30s` / `30-60s` / `60-300s` / `300s+`.

```sql
SELECT
  blob2 AS bucket,
  sum(_sample_interval) AS sessions
FROM skillmake_metrics
WHERE index1 = 'page_dwell'
  AND timestamp >= NOW() - INTERVAL '30' DAY
GROUP BY bucket
ORDER BY bucket
```

## Scroll-depth distribution (did they read the page?)

`scroll_depth` buckets: `0` / `25` / `50` / `75` / `100`.

```sql
SELECT
  blob2 AS depth_pct,
  sum(_sample_interval) AS sessions
FROM skillmake_metrics
WHERE index1 = 'scroll_depth'
  AND timestamp >= NOW() - INTERVAL '30' DAY
GROUP BY depth_pct
ORDER BY depth_pct
```

## GitHub vs install (intent leak)

Are people clicking out to GitHub *instead of* installing? Pairs per skill.

```sql
SELECT
  coalesce(installs.slug, clicks.slug) AS slug,
  coalesce(installs.installs, 0) AS installs,
  coalesce(clicks.github_clicks, 0) AS github_clicks
FROM (
  SELECT blob2 AS slug, sum(_sample_interval) AS installs
  FROM skillmake_metrics
  WHERE index1 = 'install_hit' AND blob2 != ''
    AND timestamp >= NOW() - INTERVAL '30' DAY
  GROUP BY slug
) AS installs
FULL OUTER JOIN (
  SELECT blob2 AS slug, sum(_sample_interval) AS github_clicks
  FROM skillmake_metrics
  WHERE index1 = 'github_click' AND blob2 != ''
    AND timestamp >= NOW() - INTERVAL '30' DAY
  GROUP BY slug
) AS clicks ON installs.slug = clicks.slug
ORDER BY github_clicks DESC
LIMIT 50
```

## Submit funnel: page view → convert → publish

```sql
SELECT
  index1 AS step,
  sum(_sample_interval) AS hits
FROM skillmake_metrics
WHERE index1 IN ('submit_started', 'convert_success', 'convert_error', 'submit_completed')
  AND timestamp >= NOW() - INTERVAL '30' DAY
GROUP BY step
ORDER BY hits DESC
```

## Convert errors by code (last 30 days)

`blob2` holds the extract error code or `auth` / `internal`. `double2` is HTTP status.

```sql
SELECT
  blob2 AS error_code,
  double2 AS http_status,
  sum(_sample_interval) AS errors
FROM skillmake_metrics
WHERE index1 = 'convert_error'
  AND timestamp >= NOW() - INTERVAL '30' DAY
GROUP BY error_code, http_status
ORDER BY errors DESC
```

## API errors by route (last 7 days)

`blob2` is the route without `/api/` prefix (e.g. `convert`, `search`).

```sql
SELECT
  blob2 AS route,
  double2 AS http_status,
  sum(_sample_interval) AS errors
FROM skillmake_metrics
WHERE index1 = 'api_error'
  AND timestamp >= NOW() - INTERVAL '7' DAY
GROUP BY route, http_status
ORDER BY errors DESC
LIMIT 50
```

## Where to look in the Cloudflare dashboard

- **Workers Analytics** (free, built-in, no SQL): Workers & Pages → `skillmake` → Metrics → request volume, errors, CPU, latency. Good for ops, not for product.
- **Analytics Engine SQL** (paid plan): Workers & Pages → Analytics Engine. This is where the queries above run, and where to build dashboards.
- **Logs**: Workers & Pages → `skillmake` → Logs → live tail. For retention beyond ~24h, enable **Logpush** to R2 from the dashboard (Account → Logs → Logpush).
