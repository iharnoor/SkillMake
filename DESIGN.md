# DESIGN.md — skillmake.xyz

The contract every agent (and human) reads before touching the UI. If a change
disagrees with this file, update this file first, then write the code.

## Voice + first principles

- **Terminal-influenced, not retro.** Mono for labels and small print; sans for
  body and headlines. ASCII title is the brand anchor on `/`.
- **One accent.** `--accent` (`#a8ff60`) earns every appearance. Never
  decorative.
- **Hairlines, not boxes.** 1px borders on `--border` do most of the layout
  work. Cards are the exception, not the rule.
- **No gradients on chrome.** `.grid-bg` is reserved for internal/decorative
  one-offs. Not on `/`, not on `/submit`, not on headers.
- **Mono UPPERCASE eyebrows.** Every secondary page hero starts with a
  `tracking-[0.2em] uppercase text-[11px] text-[color:var(--fg-dim)]` eyebrow.
- **Subtraction default.** If a tag, pill, or sentence doesn't earn its pixels,
  cut it.

## Tokens

Defined in `src/app/globals.css`. Do not hardcode hexes outside that file.

| Token             | Value     | Used for                          |
| ----------------- | --------- | --------------------------------- |
| `--bg`            | `#0b0d10` | page background                   |
| `--bg-elevated`   | `#111418` | inputs, code blocks, raised rows  |
| `--surface`       | `#15191e` | `.card`                           |
| `--border`        | `#232830` | hairlines                         |
| `--border-strong` | `#2f3540` | input borders, ghost buttons      |
| `--fg`            | `#e8ecf1` | primary text                      |
| `--fg-muted`      | `#8b94a3` | body, descriptions                |
| `--fg-dim`        | `#6a7384` | metadata, install one-liners      |
| `--accent`        | `#a8ff60` | CTA, links, active state          |
| `--accent-soft`   | `#a8ff6022` | hover glow, accent tag bg       |
| `--warn`          | `#ffb547` | yaml keys, warnings               |
| `--danger`        | `#ff6e6e` | errors                            |

`--fg-dim` was nudged from `#5a6271` to `#6a7384` to clear WCAG AA (4.5:1) when
used for body-size text on `--bg`. Anything below 14px on `--bg` should still
use `--fg-muted` for safety.

## Type scale

One family: **Geist** (sans) + **Geist Mono**.

| Role            | Font        | Size           | Tracking | Weight |
| --------------- | ----------- | -------------- | -------- | ------ |
| Eyebrow (UPPER) | Geist Mono  | 11px           | 0.20em   | 400    |
| H1 (hero)       | Geist Sans  | 36–60px clamp  | -0.02em  | 600    |
| H2 (section)    | Geist Sans  | 24–28px        | -0.01em  | 600    |
| Body (lede)     | Geist Sans  | 17px           | 0        | 400    |
| Body            | Geist Sans  | 15px           | 0        | 400    |
| Small / mono    | Geist Mono  | 11.5–12.5px    | 0        | 400    |
| Code block      | Geist Mono  | 12px           | 0        | 400    |

## Container widths

One rule, applied everywhere:

- `max-w-6xl` — header / footer chrome.
- `max-w-5xl` — index/list/landing pages: `/`, `/tricks`, `/powerhouse`, and
  the `/submit` shell.
- `max-w-4xl` — skill detail (`/marketplace/[id]`) — paired with the video
  grid.
- `max-w-3xl` — prose-only pages: `/security`, future `/about`, `/changelog`.

`px-6` everywhere. `mx-auto` everywhere.

## Secondary-page hero recipe

Every page that isn't `/` opens with the same shape:

```tsx
<Link href="/">← all skills</Link>            {/* mono 12px fg-muted */}
<div className="eyebrow">{section}</div>      {/* mono 11px 0.2em fg-dim UPPER */}
<h1>{headline}</h1>                           {/* 30–40px tracking -0.02em */}
<p className="lede">{one-or-two sentences}</p>{/* 15–17px fg-muted */}
{optional tag row}                            {/* .tag .tag-accent */}
```

## Component vocabulary

Implemented in `src/app/globals.css`. Reuse before inventing:

- `.card` — `--surface` + 1px border + radius 14px + padding 20px.
- `.tag`, `.tag-accent` — pill tag, optionally accented.
- `.btn-accent`, `.btn-ghost` — primary green CTA, ghost border button.
- `.input-shell` — text input wrapper with focus glow.
- `.dot` — 6px accent dot with glow (used in brand mark + section H2).
- `.mono` — Geist Mono with feature settings.
- `.skill-pre` — code preview block.
- `.pulse-dot` — animated dot for loading states.

## Interaction states (must-spec per surface)

Every interactive surface must spec **loading**, **empty**, **error**. Partial
is recommended when data fans out (e.g., star counts).

- Loading: prefer `.pulse-dot` + short mono label.
- Empty: must include a primary action and one sentence of warmth. Never just
  "No results."
- Error: must surface the error category (network, permission, validation),
  not a stack trace.

## Accessibility floor

- `:focus-visible` outline is a 2px accent ring with 2px offset (global).
- Touch targets ≥ 44px on `<sm` viewports.
- Use `aria-current="page"` on active filter pills + nav items.
- Layout exposes a skip-to-content link (target: `#main`).
- Honor `prefers-reduced-motion`: pause autoplay video, disable `.scan`.

## What we do not do

- Light mode. Dark only.
- Multiple accent colors.
- Marketing-style hero with gradient background. (No `.grid-bg` on `/submit`.)
- Card-grids for decoration (icon-in-circle 3-column SaaS template look).
  Cards are interactions.
- Emoji as design elements. Emoji in copy (cavemen, install steps) is fine.
- Rounded-2xl everywhere. Inputs and buttons keep ~6–8px radius. Cards keep
  14px via `.card`.
- Center-aligned everything. Left-align by default; center is reserved for the
  `/` closing line and decorative tag rows.

## Audiences

Live: `creators`, `engineers`. Coming-soon audiences render dimmed in the
home audience-filter row with a `·soon` badge. The home pill row contains
audience filters **only** — feature pages (Tricks, Powerhouse) live in the
header nav.
