# Plan: Trust Factor + New Skills Across Categories

## Goal

1. Add a **tiered trust factor** to every skill (schema → seed data → UI badge).
2. Add **~1–2 real, researched skills per category**, biased toward the thin categories.

Decisions locked from the kickoff: tiered enum (not numeric/computed); real researched seeds; this doc is for approval before any code.

---

## Part 1 — Trust factor

### 1.1 The field

Add to `SkillSchema` in `src/lib/skill-schema.ts` (after `audience`):

```ts
export const TRUST_TIERS = ["official", "verified", "community", "experimental"] as const;
export type TrustTier = (typeof TRUST_TIERS)[number];

// inside SkillSchema:
trust: z
  .enum(TRUST_TIERS)
  .default("community")
  .describe("Trust tier. official = maintained by the tool's own vendor; verified = curator-reviewed & known-good; community = default unreviewed; experimental = new/unproven."),
```

**Why an enum, where it lives, and why `default`:**
- Lives **inside the `Skill` object** (so inside `MarketplaceEntry.skill`). That means **no KV storage migration** — `trust` rides along with the skill blob already stored at `skill:<id>`.
- `.default("community")` makes it **backward-compatible**: any existing entry (prod KV or old seed) that lacks the field parses cleanly as `community`. No data is broken by deploying the schema change alone.

### 1.2 Tier semantics (how I'll assign values)

| Tier | Meaning | Assignment rule for the 156 existing seeds |
|------|---------|--------------------------------------------|
| `official` | Published/maintained by the tool's own vendor | `repoUrl` host org matches the tool (e.g. `anthropics/*`, `cloudflare/*`, `vercel/*`, `nvidia/*`) **and** it's the canonical repo |
| `verified` | Curator-reviewed, reputable third party, real repo with traction | Has `repoUrl`, well-known project, not vendor-owned (e.g. community MCP servers, popular OSS) |
| `community` | Default — unreviewed or no strong signal | Everything else, incl. workflow/concept skills with no repo |
| `experimental` | New / unproven / explicitly beta | New seeds I add this round that are early-stage, or anything flagged beta |

I'll assign tiers seed-by-seed with a **scripted first pass** (derive a *proposed* tier from `repoUrl` org + a curated vendor-org allowlist), then **hand-correct** the proposals. Output is a per-seed `trust` value written into each `scripts/seeds/*.json`. I'll show you the proposed distribution before committing the backfill.

> Backfill is data-only and re-runnable: re-running `seed.mjs` is idempotent by name, but it **skips existing names** — so for already-seeded prod entries I'll need either (a) a one-off admin refresh path, or (b) accept that trust lands on next content edit. **Open question A** below.

### 1.3 UI rendering

A small `<TrustBadge tier={...} />` component, rendered in three places:

1. **Catalog list** — `src/components/MarketplaceSearch.tsx` (the search result rows, ~line 106 where `category` is rendered). Needs `trust` threaded into the `MarketplaceItem` type (line 5–6) and into the item builder in `src/app/page.tsx` (~line 326) and `src/app/marketplace/page.tsx`.
2. **Skill detail** — `src/app/marketplace/[id]/page.tsx`.
3. **Converter preview** — `src/components/Converter.tsx` (~line 215, next to the category `tag`) so submitters see the tier.

Badge visual language (matches existing `.tag`/mono dim style — no new color system):

```
✓ Official      accent/green border
◆ Verified      neutral-strong border
○ Community      dim (default, low emphasis)
⚠ Experimental   amber/warn border
```

Default `community` renders as a quiet `○` so it doesn't shout on the bulk of entries. Optionally add `trust` as a **search keyword** (so "official" filters) in `MarketplaceSearch` haystack (~line 77) — cheap, I'll include it.

### 1.4 Submission path

`trust` is **not** submitter-settable to anything but `community`/`experimental` — `official`/`verified` are curator-granted. I'll clamp this in `src/app/api/admin/seed/route.ts` / the convert path so a public submission can't self-declare `official`. **Open question B** below on exact policy.

---

## Part 2 — New skills per category

Current distribution: `tool 73 · concept 44 · platform 15 · api 8 · framework 6 · library 5 · other 3 · language 1 · job-search 1`.

I'll prioritize the **thin** categories. Proposed real additions (1–2 each, all with real repos / docs I'll research for accurate `apiReference` + `gotchas`):

| Category | Proposed real skills | Likely trust |
|----------|---------------------|--------------|
| `language` | `zig`, `gleam` | verified |
| `job-search` | `resume-tailoring` (workflow), `linkedin-optimization` | community |
| `library` | `drizzle-orm`, `tanstack-query` | verified |
| `framework` | `hono`, `svelte-kit` | verified |
| `api` | `stripe-api`, `resend-api` | official/verified |
| `other` | `bun-runtime`, `biome` | verified |
| `platform` | `railway`, `supabase` | verified |
| `tool` | `ripgrep`, `uv` (python pkg mgr) | verified |
| `concept` | `rag-evaluation`, `prompt-caching` | community |

~18 new seeds. Each gets the full required shape (name, description starting "Use when…", 2–4 `whenToUse`, 3–6 `keyConcepts`, exhaustive `apiReference`, ≤8 `gotchas`, category, audience, `repoUrl`, `trust`). **You can edit this list** — Open question C.

---

## Files touched

- `src/lib/skill-schema.ts` — add `TRUST_TIERS`, `trust` field.
- `scripts/seeds/*.json` — backfill `trust` on 156 + add ~18 new files.
- `scripts/backfill-trust.mjs` (new, throwaway) — derive proposed tiers, write into seeds.
- `src/components/TrustBadge.tsx` (new).
- `src/components/MarketplaceSearch.tsx` — thread + render + searchable.
- `src/app/page.tsx`, `src/app/marketplace/page.tsx`, `src/app/marketplace/[id]/page.tsx` — pass `trust` through, render badge.
- `src/components/Converter.tsx` — show tier in preview.
- `src/app/api/admin/seed/route.ts` (+ convert route) — clamp submitter-set trust.

No storage-layer (`storage.ts`) change. No KV migration.

---

## Open questions before I build

- **A — prod backfill:** For the ~156 *already-seeded* prod entries, do you want a one-off admin endpoint/script to push `trust` onto live KV, or is "lands on next edit / re-seed of a fresh env" fine? (Affects whether I write a migration script.)
- **B — submitter policy:** Confirm public submissions may only ever be `community` (or `experimental`), with `verified`/`official` curator-only.
- **C — new-skill list:** Approve / edit the ~18 proposed skills above.

---

## Sequencing

1. Schema field + `TrustBadge` + UI wiring (deployable alone; everything defaults to `community`).
2. Backfill script → review proposed tier distribution → commit seed `trust` values.
3. Add ~18 new researched seeds.
4. (If A = yes) prod backfill script + run.
