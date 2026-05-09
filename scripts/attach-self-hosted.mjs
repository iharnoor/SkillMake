// Attach self-hosted demo URLs (skillmake.xyz/v/<slug>.mp4) to every skill
// whose name matches a slug we have a render for in public/v/.
//
// Run: ADMIN_TOKEN=… node scripts/attach-self-hosted.mjs

import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const BASE_URL = process.env.BASE_URL || "https://skillmake.xyz";
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
if (!ADMIN_TOKEN) {
  console.error("ADMIN_TOKEN env var is required.");
  process.exit(1);
}

let cookie = null;
async function login() {
  const res = await fetch(`${BASE_URL}/api/admin/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: ADMIN_TOKEN }),
  });
  if (!res.ok) throw new Error(`login ${res.status}: ${await res.text()}`);
  const setCookie =
    typeof res.headers.getSetCookie === "function"
      ? res.headers.getSetCookie()[0]
      : res.headers.get("set-cookie");
  const m = setCookie.match(/admin_session=([^;]+)/);
  cookie = `admin_session=${m[1]}`;
}

async function api(method, p, body) {
  const res = await fetch(`${BASE_URL}${p}`, {
    method,
    headers: { "content-type": "application/json", cookie },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${p} → ${res.status}: ${text}`);
  return JSON.parse(text);
}

async function main() {
  const videoDir = path.join(ROOT, "public", "v");
  const files = (await readdir(videoDir)).filter((f) => f.endsWith(".mp4"));
  const slugs = files.map((f) => f.replace(/\.mp4$/, ""));
  console.log(`found ${slugs.length} self-hosted MP4(s) in public/v/`);

  await login();
  console.log("✓ logged in");

  const market = await api("GET", "/api/marketplace");
  const idByName = new Map(market.entries.map((e) => [e.name, e.id]));

  let ok = 0;
  for (const slug of slugs) {
    const id = idByName.get(slug);
    if (!id) {
      console.log(`✗ ${slug} — no marketplace entry`);
      continue;
    }
    const url = `${BASE_URL}/v/${slug}.mp4`;
    try {
      const res = await api("POST", `/api/admin/skills/${id}/refresh`, {
        videoUrls: [url],
      });
      console.log(`✓ ${slug.padEnd(34)} → ${url}`);
      ok++;
    } catch (e) {
      console.log(`✗ ${slug} — ${e.message}`);
    }
  }
  console.log(`\n${ok}/${slugs.length} attached`);
}

main().catch((e) => {
  console.error(e.stack || e.message);
  process.exit(1);
});
