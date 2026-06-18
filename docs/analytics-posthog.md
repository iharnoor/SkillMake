# PostHog product analytics

PostHog is the primary product analytics UI for SkillMake. It replaces the old
Grafana dashboard workflow for funnels, journeys, retention, replay, and ad-hoc
questions. Cloudflare Analytics Engine stays in place as the server-side event
sink for install counting, admin snapshots, and SkillOpt telemetry reads.

| Layer | Owns | Why |
| --- | --- | --- |
| **Cloudflare Analytics Engine** | Install/agent counting, UA classification (curl/bot/browser), durable all-time totals (90-day-retention-proof via KV). | Server-side, zero-cookie, cheap at agent-traffic scale. |
| **PostHog Cloud** | Funnels, retention, per-user journeys, session replay, web analytics, ad-hoc questions. | Hosted UI; no Grafana/Infinity bridge or hand-maintained dashboard JSON. |
| **GA4 (mirror)** | Legacy GA reporting. | Unchanged. |

## Two emission paths

1. **Server-side** — `mirrorPostHogEvent()` in `src/lib/metrics.ts`, called from the
   single `track()` chokepoint right after the GA4 mirror. Fire-and-forget `fetch`
   to `${POSTHOG_HOST}/capture/`, same style as `mirrorGoogleAnalyticsEvent`. Carries
   the server-origin events: `install_hit`, `*_view`, `convert_*`, `search_submitted`,
   `skill_*` lifecycle, `api_error`.

2. **Client-side** — `PostHogScript` in `src/app/layout.tsx` loads `posthog-js`
   (`/static/array.js`) via an inline gated `<script type="module">`, same injection
   style as `GoogleAnalyticsScript`. Gives autocapture, `$pageview` (history-based,
   via `defaults: '2025-05-24'`), and session replay for free. The 5 client events
   (`github_click`, `prompt_copy`, `prompt_source_click`, `page_dwell`, `scroll_depth`)
   are captured here through `posthog.capture()` and **skipped** in the server mirror
   (`POSTHOG_CLIENT_EVENTS`) to avoid double-counting.

## distinct_id stitching

`mirrorPostHogEvent()` resolves the distinct_id via `phDistinctId()`:

- **Browser request** → reuse the id from the `ph_<key>_posthog` cookie that
  `posthog-js` sets, so server events stitch onto the same PostHog person as the
  client pageviews → real funnels and per-user journeys.
- **Agent / CLI / no cookie** → fall back to the daily visitor hash (`ctx.visitor`)
  and set `$process_person_profile: false`, so high-volume `install_hit` traffic stays
  as cheap events-only rows and doesn't explode the person table (billing + perf).

## Setup

1. Create a **PostHog Cloud** project. Pick **US** (`https://us.i.posthog.com`) or
   **EU** (`https://eu.i.posthog.com`).
2. Build-time env (Next.js `NEXT_PUBLIC_*`, inlined into the client bundle — set in
   `.env` / Workers Builds env, **not** wrangler runtime `vars`):
   - `NEXT_PUBLIC_POSTHOG_KEY` = project API key (`phc_...`)
   - `NEXT_PUBLIC_POSTHOG_HOST` = ingest host (omit for the US default)
3. Server mirror secret: `wrangler secret put POSTHOG_API_KEY` (the same `phc_` key;
   `getEnv()` falls back to `NEXT_PUBLIC_POSTHOG_KEY` if unset, and `POSTHOG_HOST`
   defaults to `https://us.i.posthog.com`).
4. Build dashboards/funnels in the PostHog UI using the event plan below.

The current production project is configured with the US ingest host. The
project token is intentionally supplied through ignored local env and Cloudflare
secrets/build env rather than committed to source.

## Event plan

These events all originate from `track()` unless noted.

| Event | Source | Useful properties |
| --- | --- | --- |
| `home_view`, `marketplace_view`, `packs_view`, `mcps_view`, `budget_view`, `powerhouse_view` | Server page views | `country`, `referer_host`, `ua_category` |
| `install_hit` | `/i/[name]` install route | `skill_slug`, `ua_category`, `country`, `$process_person_profile=false` for CLI/agent traffic |
| `search_submitted` | Search route | hashed query slug, `ua_category`, `country` |
| `convert_success`, `convert_error`, `api_error` | API routes | `http_status`, route/status slug where set |
| `skill_added`, `skill_submission_rejected`, `skill_version_promoted` | Admin lifecycle | `skill_slug`, `skill_audience`, `skill_category` |
| `github_click`, `prompt_copy`, `prompt_source_click`, `page_dwell`, `scroll_depth` | Browser SDK bridge | `skill_slug` when present; skipped by server mirror to avoid double-counting |

For browser requests, server events reuse the `ph_<key>_posthog` cookie
distinct id so funnels can stitch page views, clicks, and server-side install
events into one person journey. For CLI/agent installs without a browser cookie,
the server uses the daily visitor hash and disables person profile processing to
keep high-volume install traffic cheap.

## Dashboards to build

- **Acquisition → install funnel:** `home_view` or `marketplace_view` →
  `skill page view`/autocapture → `github_click` or `prompt_copy` →
  `install_hit`, broken down by `skill_slug`.
- **Skill leaderboard:** `install_hit` count by `skill_slug`, with filters for
  `ua_category = curl|bot|browser`.
- **Search quality:** `search_submitted` volume, followed by `prompt_copy`,
  `github_click`, or `install_hit` within the same session.
- **Submission health:** `skill_submission_started` → `skill_submitted` →
  admin lifecycle events.
- **Content engagement:** session replay and scroll/dwell events for skill pages
  and prompt packs.
- **Ops errors:** `api_error` and `convert_error` by `http_status`.

## Migration from Grafana

The previous Grafana setup used the Infinity plugin to POST SQL directly to
Cloudflare Analytics Engine. That path is deprecated for product analytics:

- Do not create new Grafana panels or dashboard JSON.
- Keep `docs/analytics-queries.md` for backend/debug queries and snapshot
  maintenance.
- Use `/admin/analytics` for quick install/system-of-record checks.
- Use PostHog for ongoing product dashboarding and exploration.

## Safety / no-key behavior

With the keys unset, `PostHogScript` isn't rendered and `mirrorPostHogEvent()`
early-returns — identical to the optional GA4 behavior. PostHog can be disabled
at any time by clearing the keys, with zero impact on Analytics Engine.
