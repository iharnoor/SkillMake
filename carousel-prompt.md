# Carousel image-prompt brief for ChatGPT

Paste this into ChatGPT (with image generation). Fill the `<<...>>` blocks first.

---

You are designing a **9-slide social carousel** (1080×1350, IG/LinkedIn portrait) for **skillmake.xyz** — a directory of Claude Code skills.

**Topic:** the *Tricks* page on skillmake.xyz, plus a deep-dive on the `html-everything` skill (turn any blob — Markdown, JSON, text, or a URL — into a single self-contained editorial HTML page with clickable links, no deps, no API keys).

**Skills / authors to feature (use these exact GitHub handles as credits on the relevant slides):**

- `<<github-handle-1>>` — <<short label, e.g. html-everything author>>
- `<<github-handle-2>>` — <<short label>>
- `<<github-handle-3>>` — <<short label>>
- `<<github-handle-4>>` — <<short label>>

**Visual system (apply to every slide):**

- Style: clean editorial / Swiss-poster meets developer-tool aesthetic. Generous negative space. High-contrast. No stock-photo people, no generic 3D blobs, no AI-slop gradients.
- Palette: near-black background `#0B0B0F`, off-white type `#F5F5F7`, single accent (pick one and reuse on every slide): electric lime `#C6FF3D` **or** hot coral `#FF5A4E` **or** sky `#7CC5FF`.
- Type: bold geometric sans for titles (Inter Black / GT America / Söhne Mono accents for code). Tight tracking, large display sizes.
- Layout grid: 24px outer padding, 8-col baseline, slide number in top-right (`01 / 09`), small `skillmake.xyz` wordmark bottom-left on every slide.
- Recurring motif: a thin accent-color hairline that travels across the carousel — left edge on slide 1, drifts toward right edge by slide 9 (progress indicator).
- Code shown as crisp monospace blocks on a `#16161D` card with rounded 14px corners and a 1px `rgba(255,255,255,.08)` border. Real code, no Lorem.

**Slides — generate one image prompt + one short overlay copy block per slide:**

1. **Hook.** Big stop-scroll headline. e.g. *"You're not using Claude Code wrong. You're using it without skills."* No image, type-only.
2. **What is skillmake.xyz.** One-sentence definition + the URL set as a large UI element. Subtle browser-chrome motif.
3. **The Tricks page.** Show 3 tricks as numbered cards (T-01, T-02, T-03) — small headline + 2-line description each. Mono code snippet on one card.
4. **Spotlight: `html-everything`.** Hero slide. Skill name in display type, one-line tagline ("Any blob → one editorial HTML page"), GitHub handle of author as credit chip. Accent-color underline under the skill name.
5. **What it eats.** Four input chips arranged in a 2×2 grid: `Markdown`, `JSON`, `Plain text`, `URL`. Arrow pointing to a single HTML file icon.
6. **What it spits out.** Mockup of the resulting HTML page — minimal, editorial, monospace heading, body copy, a few clickable-link underlines. Small caption: *"Self-contained. No deps. No API keys."*
7. **Real command.** Single terminal card. Show the exact invocation a user would type, with the prompt symbol and a blinking cursor block. Caption below: *"That's the whole API."*
8. **Other tricks worth stealing.** Tight list of 3–4 more skills/tricks from the Tricks page, each with the author's GitHub handle as a small credit. Compact card grid.
9. **Follow for more.** Centered. Large display: **"follow for more"**. Below in smaller type: `skillmake.xyz` + the IG/X handle. Accent hairline completes its journey to the right edge. Optional: tiny QR code in the corner.

**Output format I want from you:**

For each slide, give me:

```
SLIDE N — <one-line purpose>
IMAGE PROMPT: <a single dense prompt I can paste into an image model — describe layout, type hierarchy, palette, motif, code/text content baked into the image>
OVERLAY COPY:
  Headline: ...
  Body: ...
  Credit: @<github-handle> (if applicable)
  Slide number: 0N / 09
```

Constraints:

- Real, legible text baked into each image — no gibberish lorem.
- Same accent color across all 9 slides.
- Slide 1 and slide 9 are type-only (no illustrations).
- Maintain the hairline-progress motif across all 9.
- Keep the `skillmake.xyz` wordmark visually identical on every slide (same size, same position).

Now generate all 9 slides.
