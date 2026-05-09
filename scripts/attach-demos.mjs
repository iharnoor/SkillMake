// Reads the output of build-and-publish-demos.mjs (or any stream of
// "[N/M] <slug>  ... <hf-url>" lines), looks up each slug's marketplace id
// via /api/marketplace, and POSTs the URL to /api/admin/skills/<id>/refresh
// as the entry's videoUrls.
//
// Run:
//   ADMIN_TOKEN=… node scripts/attach-demos.mjs <log-file>
//
// Or pipe:
//   cat build.log | ADMIN_TOKEN=… node scripts/attach-demos.mjs -

import { readFile } from "node:fs/promises";

const BASE_URL = process.env.BASE_URL || "https://skillmake.xyz";
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
if (!ADMIN_TOKEN) {
  console.error("ADMIN_TOKEN env var is required.");
  process.exit(1);
}
const logArg = process.argv[2];
if (!logArg) {
  console.error("Usage: node scripts/attach-demos.mjs <log-file | ->");
  process.exit(1);
}

let cookie = null;
async function login() {
  const res = await fetch(`${BASE_URL}/api/admin/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: ADMIN_TOKEN }),
  });
  if (!res.ok) throw new Error(`login failed: ${res.status}`);
  const setCookie =
    typeof res.headers.getSetCookie === "function"
      ? res.headers.getSetCookie()[0]
      : res.headers.get("set-cookie");
  const m = setCookie.match(/admin_session=([^;]+)/);
  if (!m) throw new Error("no admin_session cookie returned");
  cookie = `admin_session=${m[1]}`;
}

async function api(method, path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { "content-type": "application/json", cookie },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

function parseLog(text) {
  // [N/M] <slug>  render … OK · publish … <https-url>
  const re = /^\[\d+\/\d+\]\s+(\S+).*?(https:\/\/hyperframes\.dev\/p\/[\w?=&_-]+)/gm;
  const out = [];
  let m;
  while ((m = re.exec(text)) !== null) out.push({ slug: m[1], url: m[2] });
  return out;
}

async function main() {
  let raw;
  if (logArg === "-") {
    const chunks = [];
    for await (const c of process.stdin) chunks.push(c);
    raw = Buffer.concat(chunks).toString("utf-8");
  } else {
    raw = await readFile(logArg, "utf-8");
  }
  const items = parseLog(raw);
  if (items.length === 0) {
    console.error("no [N/M] slug → URL pairs found in log");
    process.exit(1);
  }
  console.log(`found ${items.length} slug → URL pair(s)`);

  await login();
  console.log("✓ logged in");

  const market = await api("GET", "/api/marketplace");
  const idByName = new Map(market.entries.map((e) => [e.name, e.id]));

  let ok = 0;
  for (const { slug, url } of items) {
    const id = idByName.get(slug);
    if (!id) {
      console.log(`✗ ${slug} — no matching marketplace entry`);
      continue;
    }
    try {
      const res = await api("POST", `/api/admin/skills/${id}/refresh`, {
        videoUrls: [url],
      });
      console.log(`✓ ${slug} → ${(res.videoUrls || []).length} video(s) attached`);
      ok++;
    } catch (e) {
      console.log(`✗ ${slug} — ${e.message}`);
    }
  }
  console.log(`\n${ok}/${items.length} attached`);
}

main().catch((e) => {
  console.error(e.stack || e.message);
  process.exit(1);
});
