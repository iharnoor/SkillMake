# PostHog (Cloud) — product analytics layer

PostHog Cloud runs **alongside** Cloudflare Analytics Engine. It is purely
additive — nothing about Analytics Engine, the `/admin/analytics` wallboard, the
durable KV install total, or the GA4 mirror was removed.

| Layer | Owns | Why |
| --- | --- | --- |
| **Cloudflare Analytics Engine** | Install/agent counting, UA classification (curl/bot/browser), durable all-time totals (90-day-retention-proof via KV). | Server-side, zero-cookie, cheap at agent-traffic scale. |
| **PostHog Cloud** | Funnels, retention, per-user journeys, session replay, web analytics, ad-hoc questions. | Hosted UI — no hand-maintained SQL or dashboard code. |
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
4. Build dashboards/funnels in the PostHog UI (e.g. `home_view → install_hit`
   conversion, skill retention) — this is what replaces the hand-maintained SQL.

## Safety / no-key behavior

With the keys unset, `PostHogScript` isn't rendered and `mirrorPostHogEvent()`
early-returns — identical to the optional GA4 behavior. PostHog can be disabled at
any time by clearing the keys, with zero impact on Analytics Engine.
