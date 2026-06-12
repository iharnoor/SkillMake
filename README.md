# skillmake

**Install better workflows into Claude, Codex, and every agent.**

[skillmake.xyz](https://skillmake.xyz) is a curated marketplace and prompt library for AI agent skills. Find a vetted `SKILL.md`, inspect the source, watch a demo when one exists, then install the exact workflow your next session needs. Alongside the marketplace it ships hand-curated **Prompt Packs** — copy-paste prompt collections for the models people actually use.

---

## What's inside

- **Marketplace** (`/marketplace`) — Reviewed agent skills. Each entry is a real `SKILL.md` with source, audience, and an optional demo.
- **Submit + convert** (`/submit`, `/api/convert`) — Paste a URL to docs and an LLM distills it into a structured, schema-validated `SKILL.md`. An admin reviews before anything goes live.
- **Prompt Packs** (`/packs`) — Editorial, copy-paste prompt collections (Nano Banana, AI video, agent rules, the salary→wealth set, and more). Source of truth is the bundled [`data/packs.json`](data/packs.json) — add a pack by appending to the file and the routes pick it up.
- **Semantic search** (`/api/search`) — Vector search over the marketplace, backed by HydraDB, with a graceful substring fallback.
- **Universe** (`/universe`) — A Three.js galaxy view of the skill corpus.
- **Admin** (`/admin`) — Token-gated review, edit, approve/reject, reindex, and skill-optimization tooling.

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS v4 |
| 3D | Three.js (the `/universe` view) |
| LLM | Anthropic via the [`ai`](https://www.npmjs.com/package/ai) SDK (skill distillation + optimization) |
| Vector search | **HydraDB** ([`@hydra_db/node`](https://www.npmjs.com/package/@hydra_db/node)) |
| Storage | Cloudflare KV (`MARKETPLACE_KV`) |
| Runtime / deploy | Cloudflare Workers via [OpenNext](https://opennext.js.org/cloudflare) (`@opennextjs/cloudflare` + `wrangler`) |

## How we're using HydraDB

HydraDB powers semantic search and duplicate detection over the marketplace. The integration lives in [`src/lib/vector.ts`](src/lib/vector.ts).

**Indexing.** When a skill is published, we store it as a HydraDB *memory* entry via `upload.addMemory`. The `source_id` is the marketplace entry id, the body is a compact, searchable rendering of the skill (name, audience, description, "when to use", key concepts), and we `upsert` so re-publishing updates the existing record instead of duplicating it. Category and audience ride along in `document_metadata`.

```ts
await client.upload.addMemory({
  memories: [{
    source_id: id,
    title: skill.name,
    text: searchableText(skill),   // name + audience + description + when-to-use + concepts
    is_markdown: true,
    document_metadata: JSON.stringify({ skill_id: id, name, category, audience }),
  }],
  tenant_id, sub_tenant_id, upsert: true,
});
```

**Search.** `/api/search` runs the user query through `recall.recallPreferences` in `fast` mode, then collapses the returned chunks down to their best score per `source_id` and ranks them. The caller hydrates those ids from KV. ([`src/app/api/search/route.ts`](src/app/api/search/route.ts))

**Deduplication.** On submit, `findDuplicate` recalls against the new skill's description; if the top hit clears a 0.78 relevancy threshold we flag it as a likely duplicate so a near-identical skill never gets queued for review twice.

**Multi-tenancy.** Every call is scoped by `tenant_id` + `sub_tenant_id` (default `skillmake-marketplace`), so one HydraDB tenant can host multiple collections.

**Graceful degradation.** If `HYDRADB_API_KEY` / `HYDRADB_TENANT_ID` are absent, indexing and dedup become no-ops and search falls back to a substring scan over approved entries. The app runs fully without HydraDB — you just lose semantic ranking. This is what keeps local dev and CI green without secrets.

To rebuild the index from current storage, hit the admin reindex endpoint ([`/api/admin/reindex`](src/app/api/admin/reindex/route.ts)), which iterates published entries and calls `indexSkill` for each.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The marketplace hydrates from the seed corpus in [`scripts/seeds/`](scripts/seeds) when KV is empty, so you get a working site with no external services.

### Environment variables

All are optional for local browsing — the app degrades gracefully. Set what you need:

| Variable | Purpose |
|---|---|
| `HYDRADB_API_KEY` | HydraDB token. Absent → search falls back to substring matching. |
| `HYDRADB_TENANT_ID` | HydraDB tenant. |
| `HYDRADB_SUB_TENANT_ID` | Collection within the tenant (default `skillmake-marketplace`). |
| `ANTHROPIC_API_KEY` | Skill distillation (`/api/convert`) and optimization. |
| `SKILLMAKE_MODEL` | Override the default Claude model id. |
| `ADMIN_TOKEN` | Gates the `/admin` routes. |
| `GITHUB_TOKEN` | Higher rate limits when fetching skill source from GitHub. |
| `GOOGLE_ANALYTICS_MEASUREMENT_ID`, `GOOGLE_ANALYTICS_API_SECRET` | GA4 server-side events. |
| `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_ANALYTICS_API_TOKEN` | Analytics dashboard. |

In production these come from the Cloudflare Workers binding; locally they come from `process.env` (use `.dev.vars` or `.env.local`). KV (`MARKETPLACE_KV`) and the metrics binding (`METRICS`) are configured in [`wrangler.jsonc`](wrangler.jsonc).

### Scripts

```bash
npm run dev        # Next dev server
npm run build      # production build
npm run test       # node --test unit suite (metrics, validators, packs)
npm run preview    # OpenNext build + local Cloudflare Workers preview
npm run deploy     # OpenNext build + deploy to Cloudflare
npm run cf-typegen # regenerate cloudflare-env.d.ts from wrangler bindings
```

## Project structure

```
src/
  app/            # App Router routes (marketplace, packs, universe, admin, api/*)
  lib/            # vector.ts (HydraDB), convert.ts, env.ts, packs.ts, skill-schema.ts, ...
  components/     # UI
data/
  packs.json      # source of truth for Prompt Packs
scripts/seeds/    # seed corpus used when KV is empty
docs/             # seo-setup.md, analytics-queries.md, grafana/
```

## Deployment

skillmake runs on Cloudflare Workers via OpenNext.

```bash
npm run deploy
```

Bindings (KV, metrics) and routes live in `wrangler.jsonc`; secrets are set with `wrangler secret put <NAME>`. SEO wiring (sitemap, robots, Search Console, GA4) is documented in [docs/seo-setup.md](docs/seo-setup.md).

## Contributing

Issues and PRs welcome. To add a prompt pack, append to `data/packs.json` (see the schema in [`src/lib/packs.ts`](src/lib/packs.ts)) and add an icon in `src/app/packs/page.tsx`. To add a marketplace skill, use `/submit` or open a PR against the seed corpus. Run `npm run test` before pushing.

## License

MIT — see [LICENSE](LICENSE).
