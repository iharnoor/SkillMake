// For every seed in scripts/seeds/*.json:
//   1. copies demos/skillmake-demos/ → demos/<skill-name>/
//   2. rewrites index.html with the seed's name, tagline, 3 "what it does" beats, install URL, stars
//   3. updates meta.json with a unique project id (so HF gives a unique URL)
//   4. runs `hyperframes render` → MP4 in demos/<skill-name>/renders/
//   5. runs `yes | hyperframes publish` → captures the public hyperframes.dev URL
//
// Sequential by design (don't hammer HF cloud). Idempotent at the dir-copy step.
//
// Run: node scripts/build-and-publish-demos.mjs

import { readFile, writeFile, readdir, cp, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const SEEDS_DIR = path.join(__dirname, "seeds");
const DEMOS_ROOT = path.join(ROOT, "demos");
const TEMPLATE_DIR = path.join(DEMOS_ROOT, "skillmake-demos");

const PROD_MARKETPLACE = "https://skillmake.xyz/api/marketplace";

function fmtStars(n) {
  if (n == null) return null;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return String(n);
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildIndexHtml(seed, starsFmt) {
  const skill = seed.skill;
  const beats = (skill.whenToUse || []).slice(0, 3);
  const install = `curl --create-dirs -fsSL skillmake.xyz/i/${skill.name}`;
  const taglineMaxLen = 180;
  const tagline =
    skill.description.length > taglineMaxLen
      ? skill.description.slice(0, taglineMaxLen - 1).trim() + "…"
      : skill.description;

  // The skill-name title styling: split on the first hyphen so prefix is plain
  // and the rest is in the accent color. Single-word names get the whole word
  // in accent. This produces the same "hyper<accent>frames</accent>" treatment
  // we tested on the first demo, generalised.
  let nameHtml;
  const i = skill.name.indexOf("-");
  if (i === -1) {
    nameHtml = `<span class="accent">${escapeHtml(skill.name)}</span>`;
  } else {
    nameHtml = `${escapeHtml(skill.name.slice(0, i))}<span class="accent">${escapeHtml(
      skill.name.slice(i)
    )}</span>`;
  }

  // Title size shrinks on long names so it always fits the 1300px hero.
  const nameLen = skill.name.length;
  const titleSizePx =
    nameLen <= 12
      ? 152
      : nameLen <= 18
      ? 124
      : nameLen <= 24
      ? 102
      : nameLen <= 30
      ? 84
      : 70;

  const starsBadge = starsFmt
    ? `<div class="stars-badge clip" id="starsBadge" data-start="0.4" data-duration="8.6" data-track-index="1">
        <span class="star">★</span>
        <span class="count">${starsFmt}</span>
        <span>github</span>
      </div>`
    : "";

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1920, height=1080" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body {
        margin: 0; width: 1920px; height: 1080px; overflow: hidden;
        background: #0b0d10;
        font-family: ui-monospace, "SF Mono", Menlo, monospace;
        color: #e8ecf1;
      }
      .stage { position: relative; width: 100%; height: 100%; }

      .sm-mark {
        position: absolute; top: 64px; left: 96px;
        display: flex; align-items: center; gap: 16px;
        font-size: 22px; letter-spacing: -0.01em; color: #8b94a3;
      }
      .sm-dot {
        width: 12px; height: 12px; border-radius: 50%;
        background: #a8ff60; box-shadow: 0 0 22px #a8ff60;
      }
      .sm-mark .sm-accent { color: #a8ff60; }

      .hero {
        position: absolute; top: 50%; left: 50%;
        transform: translate(-50%, -50%); width: 1500px; text-align: center;
      }
      .hero .skill-name {
        font-family: "SF Pro Display", -apple-system, system-ui, sans-serif;
        font-size: ${titleSizePx}px; font-weight: 700;
        letter-spacing: -0.04em; line-height: 0.98; color: #e8ecf1;
      }
      .hero .skill-name .accent { color: #a8ff60; }
      .hero .skill-tagline {
        margin-top: 28px;
        font-family: "SF Pro Display", -apple-system, system-ui, sans-serif;
        font-size: 30px; font-weight: 400; line-height: 1.35;
        color: #8b94a3; max-width: 1200px; margin-left: auto; margin-right: auto;
      }

      .install-card {
        position: absolute; left: 50%; bottom: 130px;
        transform: translateX(-50%);
        background: #15191e; border: 1px solid #232830; border-radius: 14px;
        padding: 28px 36px; font-size: 24px; color: #d6dde6;
        white-space: nowrap; box-shadow: 0 24px 64px rgba(0, 0, 0, 0.6);
      }
      .install-card .prompt { color: #5a6271; margin-right: 12px; }
      .install-card .accent { color: #a8ff60; }

      .beats {
        position: absolute; left: 50%; bottom: 320px;
        transform: translateX(-50%); width: 1300px; text-align: center;
      }
      .beat {
        font-family: "SF Pro Display", -apple-system, system-ui, sans-serif;
        font-size: 28px; font-weight: 500; color: #e8ecf1;
        margin: 14px 0; letter-spacing: -0.01em;
      }
      .beat .check { color: #a8ff60; margin-right: 14px; font-weight: 700; }

      .url-mark {
        position: absolute; right: 96px; bottom: 64px;
        font-size: 20px; color: #5a6271; letter-spacing: 0.02em;
      }
      .url-mark .accent { color: #a8ff60; }

      .stars-badge {
        position: absolute; top: 64px; right: 96px;
        display: flex; align-items: center; gap: 10px;
        font-size: 20px; color: #8b94a3;
      }
      .stars-badge .star { color: #a8ff60; font-size: 24px; }
      .stars-badge .count { color: #e8ecf1; font-weight: 600; }

      .glow {
        position: absolute; top: 50%; left: 50%; width: 1600px; height: 1000px;
        background: radial-gradient(ellipse at center, rgba(168, 255, 96, 0.14) 0%, rgba(168, 255, 96, 0) 70%);
        transform: translate(-50%, -50%); pointer-events: none;
      }
      .grid-bg {
        position: absolute; inset: 0;
        background-image:
          linear-gradient(to right, rgba(35, 40, 48, 0.4) 1px, transparent 1px),
          linear-gradient(to bottom, rgba(35, 40, 48, 0.4) 1px, transparent 1px);
        background-size: 64px 64px;
        mask-image: radial-gradient(ellipse 60% 60% at 50% 50%, rgba(0, 0, 0, 0.9) 30%, transparent 80%);
        opacity: 0.5; pointer-events: none;
      }
    </style>
  </head>
  <body>
    <div id="root" class="stage" data-composition-id="main"
         data-start="0" data-duration="9" data-width="1920" data-height="1080">
      <div class="grid-bg" id="gridBg"></div>
      <div class="glow" id="glow"></div>

      <div class="sm-mark clip" id="smMark" data-start="0" data-duration="9" data-track-index="0">
        <span class="sm-dot"></span>
        <span>skill<span class="sm-accent">make</span></span>
        <span style="color: #232830">/</span>
        <span>skill demo</span>
      </div>

      ${starsBadge}

      <div class="hero">
        <div class="skill-name clip" id="skillName"
             data-start="0.3" data-duration="8.7" data-track-index="2">${nameHtml}</div>
        <div class="skill-tagline clip" id="skillTagline"
             data-start="0.9" data-duration="2.3" data-track-index="3">${escapeHtml(tagline)}</div>
      </div>

      <div class="beats">
        ${beats
          .map(
            (b, idx) => `<div class="beat clip" id="beat${idx + 1}"
             data-start="${(3.4 + idx * 0.5).toFixed(1)}" data-duration="${(5.4 - idx * 0.5).toFixed(1)}" data-track-index="${6 + idx}">
          <span class="check">✓</span>${escapeHtml(b)}
        </div>`
          )
          .join("\n        ")}
      </div>

      <div class="install-card clip" id="installCard"
           data-start="6.6" data-duration="2.4" data-track-index="4">
        <span class="prompt">$</span>
        <span>${escapeHtml(install).replace(skill.name, `<span class="accent">${skill.name}</span>`)}</span>
      </div>

      <div class="url-mark clip" id="urlMark"
           data-start="0" data-duration="9" data-track-index="5">
        skillmake<span class="accent">.xyz</span>
      </div>
    </div>

    <script>
      window.__timelines = window.__timelines || {};
      const tl = gsap.timeline({ paused: true });

      gsap.set("#smMark", { opacity: 0, y: -10 });
      gsap.set("#starsBadge", { opacity: 0, y: -10 });
      gsap.set("#urlMark", { opacity: 0 });
      gsap.set("#glow", { opacity: 0, scale: 0.8 });
      gsap.set("#gridBg", { opacity: 0 });
      gsap.set("#skillName", { opacity: 0, y: 60, scale: 0.96 });
      gsap.set("#skillTagline", { opacity: 0, y: 30 });
      gsap.set("#installCard", { opacity: 0, y: 30 });
      gsap.set(["#beat1", "#beat2", "#beat3"].filter(s => document.querySelector(s)),
               { opacity: 0, x: -40 });

      tl.to("#gridBg", { opacity: 0.5, duration: 0.6, ease: "power1.out" }, 0);
      tl.to("#glow", { opacity: 1, scale: 1, duration: 1.2, ease: "power2.out" }, 0);
      tl.to("#smMark", { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" }, 0.1);
      if (document.querySelector("#starsBadge")) {
        tl.to("#starsBadge", { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" }, 0.4);
      }
      tl.to("#urlMark", { opacity: 1, duration: 0.6, ease: "power1.out" }, 0.6);

      tl.to("#skillName",
            { opacity: 1, y: 0, scale: 1, duration: 0.7, ease: "back.out(1.4)" }, 0.3);
      tl.to("#skillTagline",
            { opacity: 1, y: 0, duration: 0.6, ease: "power2.out" }, 0.9);

      tl.to("#skillName",
            { scale: 0.55, y: -260, duration: 0.7, ease: "power3.inOut" }, 3.0);
      tl.to("#skillTagline",
            { opacity: 0, y: -10, duration: 0.4, ease: "power2.in" }, 3.0);

      const beats = ["#beat1", "#beat2", "#beat3"].filter(s => document.querySelector(s));
      beats.forEach((sel, i) => {
        tl.to(sel, { opacity: 1, x: 0, duration: 0.55, ease: "power2.out" }, 3.4 + i * 0.5);
      });

      tl.to("#installCard",
            { opacity: 1, y: 0, duration: 0.6, ease: "back.out(1.6)" }, 6.6);

      tl.to("#glow", { scale: 1.05, duration: 6, ease: "sine.inOut" }, 2.0);

      window.__timelines["main"] = tl;
    </script>
  </body>
</html>
`;
}

function exec(cmd, args, cwd, opts = {}) {
  return new Promise((resolve, reject) => {
    const env = { ...process.env, ...(opts.env || {}) };
    const child = spawn(cmd, args, { cwd, env, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    if (opts.stdin) child.stdin.write(opts.stdin);
    child.stdin.end();
    child.on("exit", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${cmd} exit ${code}: ${stderr || stdout.slice(-500)}`));
    });
  });
}

async function fetchProdStars() {
  try {
    const res = await fetch(PROD_MARKETPLACE);
    if (!res.ok) return new Map();
    const data = await res.json();
    const m = new Map();
    for (const e of data.entries || []) {
      if (typeof e.stars === "number" && e.stars > 0) m.set(e.name, e.stars);
    }
    return m;
  } catch {
    return new Map();
  }
}

async function loadSeeds() {
  // SEED_FILTER is a substring matched against the seed filename (e.g. SEED_FILTER=mp-
  // renders only the mp-*.json seeds). Empty/unset = render all.
  const filter = process.env.SEED_FILTER || "";
  const files = (await readdir(SEEDS_DIR))
    .filter((f) => f.endsWith(".json"))
    .filter((f) => (filter ? f.includes(filter) : true))
    .sort();
  const seeds = [];
  for (const f of files) {
    const raw = await readFile(path.join(SEEDS_DIR, f), "utf-8");
    seeds.push({ ...JSON.parse(raw), _file: f });
  }
  return seeds;
}

async function main() {
  const stars = await fetchProdStars();
  const seeds = await loadSeeds();
  console.log(`loaded ${seeds.length} seed file(s); ${stars.size} have ★ stars on prod`);

  const results = [];
  for (const [i, seed] of seeds.entries()) {
    const slug = seed.skill.name;
    const dir = path.join(DEMOS_ROOT, slug);
    const stamp = `[${i + 1}/${seeds.length}] ${slug}`;

    if (!existsSync(dir)) {
      await cp(TEMPLATE_DIR, dir, { recursive: true });
    }
    // Reset the renders folder so we always get a fresh MP4
    const rendersDir = path.join(dir, "renders");
    await mkdir(rendersDir, { recursive: true });

    // Update meta.json with a unique id so HF gives this project its own URL
    const meta = {
      id: `skillmake-demo-${slug}`,
      name: `skillmake-demo-${slug}`,
      createdAt: new Date().toISOString(),
    };
    await writeFile(path.join(dir, "meta.json"), JSON.stringify(meta, null, 2));

    // Templated index.html
    const starsFmt = fmtStars(stars.get(slug));
    await writeFile(path.join(dir, "index.html"), buildIndexHtml(seed, starsFmt));

    // Render
    process.stdout.write(`${stamp}  render … `);
    try {
      await exec("npx", ["--yes", "hyperframes@0.5.3", "render"], dir);
    } catch (e) {
      console.log("FAIL");
      console.error(`  ${e.message}`);
      results.push({ slug, status: "render-fail", error: e.message });
      continue;
    }
    // SKIP_PUBLISH=1 stops after render — useful when self-hosting via public/v/.
    if (process.env.SKIP_PUBLISH === "1") {
      console.log("OK (publish skipped)");
      results.push({ slug, status: "rendered-only" });
      continue;
    }
    process.stdout.write("OK · publish … ");

    // Publish (yes piped via stdin)
    try {
      const { stdout } = await exec(
        "npx",
        ["--yes", "hyperframes@0.5.3", "publish"],
        dir,
        { stdin: "y\n" }
      );
      const m = stdout.match(/https:\/\/hyperframes\.dev\/p\/[\w?=&_-]+/);
      const url = m ? m[0] : null;
      console.log(url ?? "URL-NOT-FOUND");
      results.push({ slug, status: url ? "ok" : "no-url", url });
    } catch (e) {
      console.log("FAIL");
      console.error(`  ${e.message}`);
      results.push({ slug, status: "publish-fail", error: e.message });
    }
  }

  console.log("\n=== summary ===");
  for (const r of results) {
    if (r.status === "ok") console.log(`✓ ${r.slug.padEnd(30)} ${r.url}`);
    else if (r.status === "rendered-only") console.log(`✓ ${r.slug.padEnd(30)} (rendered, publish skipped)`);
    else console.log(`✗ ${r.slug.padEnd(30)} ${r.status}: ${r.error ?? ""}`);
  }
  const okCount = results.filter((r) => r.status === "ok" || r.status === "rendered-only").length;
  console.log(`\n${okCount}/${results.length} ${process.env.SKIP_PUBLISH === "1" ? "rendered" : "published"}`);
}

main().catch((e) => {
  console.error(e.stack || e.message);
  process.exit(1);
});
