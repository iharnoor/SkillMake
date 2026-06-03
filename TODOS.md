# TODOS

## Packs / Famous-Prompts Radar

### Add packs.test.ts coverage
**Priority:** P2
**What:** Unit test for `lib/packs.ts` covering date-sort, the "new this week" boundary, and the `packSearchEntries()` mapping.
**Why:** `lib/packs.ts` is gaining real logic (freshness sort + search-entry mapping). The repo runs `node --test` on `src/lib/*.test.ts` files; there's no `packs.test.ts` yet. Untested sort/boundary logic is where off-by-one date bugs hide.
**Context:** Surfaced in /plan-ceo-review (2026-06-03), Section 6. Mirror the style of `src/lib/metrics.test.ts`. Test the boundary case where a prompt's `addedAt` is exactly 7 days old.
**Effort:** S
**Depends on:** the `addedAt` schema field landing first.

### Radar → pack-entry JSON helper
**Priority:** P2
**What:** A small script that turns `last72hours` / `reddit-x` radar output into `data/packs.json` pack-entry JSON (id, title, prompt, author, addedAt, sourceUrl).
**Why:** De-frictions the weekly sourcing pass so adding a viral prompt is paste-and-approve, not hand-authoring JSON.
**Context:** Surfaced in /plan-ceo-review (2026-06-03), Section 9. Part of the radar sourcing cadence. Keep human-approve in the loop — the script proposes, you commit.
**Effort:** S

### Sourcing cadence runbook
**Priority:** P2
**What:** Document the repeatable weekly flow: radar → shortlist → human approve → commit → deploy.
**Why:** The radar is only as good as the cadence behind it. Writing it down means it survives beyond memory and can be handed off or scheduled.
**Context:** Surfaced in /plan-ceo-review (2026-06-03). Pair with the radar→JSON helper above.
**Effort:** S

### Full provenance fields (deferred from schema decision)
**Priority:** P2
**What:** Extend `PromptItem` with `sourceViews` (virality signal), `authorHandle`, and `authorUrl` beyond the date+author landing this round.
**Why:** The full attribution card (avatar/handle, "400k views" badge, linked author) is the strongest trust signal. Narrowed this round to keep the first cut small.
**Context:** Surfaced in /plan-ceo-review (2026-06-03), Finding 1. Schema was scoped to date+author; this completes it. Consider running `/plan-design-review` for the card layout before building.
**Effort:** S

### Backfill provenance on the 2 flagship entries
**Priority:** P2
**What:** Add `author` + `addedAt` to the Suzanne and Cole entries in `data/packs.json` once those fields exist.
**Why:** Without backfill, the two showcase prompts render with no provenance line, so the entries meant to prove "real builders use this" look the least-sourced. Undercuts the trust pitch the whole vertical rests on.
**Context:** Surfaced in /plan-design-review (2026-06-03), Pass 2. Deferred by user decision (D4) — schema ships first, backfill follows. Suzanne: author "Suzanne · Anthropic", source already present (x.com/trq212). Cole: author "Cole Medin", source already present.
**Effort:** S
**Depends on:** the `author` + `addedAt` schema fields landing.

## Completed
