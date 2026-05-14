# SkillMake Design System

## Product Feel

SkillMake is a terminal-native marketplace for reviewed agent skills. It should feel like a trusted registry built by someone who installs the things they list, not a SaaS landing page.

## Color Tokens

- Background: `#0b0d10`
- Elevated background: `#111418`
- Surface: `#15191e`
- Border: `#232830`
- Strong border: `#2f3540`
- Foreground: `#e8ecf1`
- Muted text: `#8b94a3`
- Dim text: `#5a6271`
- Install/accent green: `#a8ff60`
- Research/info blue: `#7cc7ff`
- Caution yellow: `#ffb547`
- Danger red: `#ff6e6e`

## Typography

- Use Geist Sans for promises, descriptions, and explanatory copy.
- Use Geist Mono for skill names, commands, counts, source hosts, short labels, and metadata.
- Avoid making full paragraphs monospace unless the content is a command or code-like artifact.

## Interface Rules

- Cards and primary containers use `8px` radius.
- Rows stay dense and flat. Density is part of the product value.
- Pills are for metadata only: audience, category, reviewed status, video count, source, install.
- Keep green-on-dark as the main identity. Use blue, yellow, and red only for information roles.
- Avoid decorative blobs, stock imagery, generic feature grids, and gradient hero treatments.

## Marketplace Row Anatomy

Each marketplace row should expose enough proof for a builder to decide whether to inspect or install:

- Rank
- Skill name
- Audience and category
- One-line description
- Source host
- Repository link when available
- Install affordance
- Reviewed status
- Video count when available
- Star count when available

## Collection Page Pattern

Collection pages should start with a compact index of included skills before any long narrative sections, videos, or install blocks. Users should be able to scan the whole collection before committing to scroll.
