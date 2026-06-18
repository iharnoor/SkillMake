# Grafana to PostHog migration

SkillMake has migrated product analytics from Grafana to PostHog.

The old Grafana workflow used the Yesoreyeram Infinity data source to POST SQL
to Cloudflare Analytics Engine. That bridge is retired for product work because
PostHog now owns funnels, retention, journeys, replay, and ad-hoc analytics.

Current analytics paths:

- Product analytics: `docs/analytics-posthog.md`
- Backend/debug SQL: `docs/analytics-queries.md`
- Admin install checks: `/admin/analytics`

Do not recreate the old Grafana dashboard JSON. Cloudflare Analytics Engine
remains the backend source for install snapshots and SkillOpt telemetry; PostHog
is the dashboarding and exploration layer.
