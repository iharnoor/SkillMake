// Drives the admin API to seed and backfill the marketplace:
//   1. logs in with ADMIN_TOKEN to get a curator session cookie
//   2. POSTs every JSON file in scripts/seeds/ to /api/admin/seed
//   3. POSTs /api/admin/skills/<id>/refresh for existing entries whose
//      `name` maps to a known GitHub repo, populating repoUrl + ★ stars
//
// Idempotent: re-running won't duplicate skills (skipped by name), and
// entries that already have a repoUrl are passed unchanged.
//
// Each seed lives at scripts/seeds/<slug>.json with shape:
//   { sourceUrl: string, skill: SkillObject }
//
// Env:
//   BASE_URL      default http://localhost:3003
//   ADMIN_TOKEN   required (matches the server's ADMIN_TOKEN secret)
//
// Run: ADMIN_TOKEN=… node scripts/seed.mjs

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const BASE_URL = process.env.BASE_URL || "http://localhost:3003";
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
if (!ADMIN_TOKEN) {
  console.error("ADMIN_TOKEN env var is required.");
  process.exit(1);
}

// Resolve seeds dir relative to this file, not cwd, so the script works
// regardless of where it's run from.
const SEEDS_DIR = path.join(__dirname, "seeds");

async function loadSeedsFromDir() {
  const entries = await readdir(SEEDS_DIR);
  const files = entries.filter((f) => f.endsWith(".json")).sort();
  const seeds = [];
  for (const f of files) {
    const raw = await readFile(path.join(SEEDS_DIR, f), "utf-8");
    seeds.push({ ...JSON.parse(raw), _file: f });
  }
  return seeds;
}

// --- entries already in the marketplace get repoUrl backfilled by name ----
const REPO_BY_NAME = {
  "nextjs-server-client-components": "https://github.com/vercel/next.js",
  "remotion-fundamentals": "https://github.com/remotion-dev/remotion",
  "clerk-react-custom-sign-in-page": "https://github.com/clerk/javascript",
  "shadcn-ui-nextjs-setup": "https://github.com/shadcn-ui/ui",
  "hono-getting-started": "https://github.com/honojs/hono",
  "zod-validation": "https://github.com/colinhacks/zod",
  "tanstack-query-react-quick-start": "https://github.com/TanStack/query",
  "drizzle-orm-schema-declaration": "https://github.com/drizzle-team/drizzle-orm",
};

// --- HTTP helpers ----------------------------------------------------------
let cookie = null;

async function login() {
  const res = await fetch(`${BASE_URL}/api/admin/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: ADMIN_TOKEN }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`login failed ${res.status}: ${body}`);
  }
  // Capture the admin_session cookie. Headers.getSetCookie isn't on every Node;
  // fall back to raw header parsing.
  const setCookie =
    typeof res.headers.getSetCookie === "function"
      ? res.headers.getSetCookie()[0]
      : res.headers.get("set-cookie");
  if (!setCookie) throw new Error("login response had no Set-Cookie");
  const m = setCookie.match(/admin_session=([^;]+)/);
  if (!m) throw new Error("login response Set-Cookie missing admin_session");
  cookie = `admin_session=${m[1]}`;
  console.log("✓ logged in");
}

async function api(method, path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      cookie,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // non-JSON response — keep text for error reporting
  }
  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  }
  return json;
}

// --- main ------------------------------------------------------------------
async function main() {
  await login();
  const seeds = await loadSeedsFromDir();
  console.log(`loaded ${seeds.length} seed file${seeds.length === 1 ? "" : "s"} from scripts/seeds/`);

  // 1. Insert hand-authored seeds (idempotent: skip if name already exists).
  const existing = (await api("GET", "/api/marketplace")).entries;
  const existingNames = new Set(existing.map((e) => e.name));
  for (const seed of seeds) {
    if (existingNames.has(seed.skill.name)) {
      console.log(`skip ${seed.skill.name} — already in marketplace`);
      continue;
    }
    const out = await api("POST", "/api/admin/seed", {
      sourceUrl: seed.sourceUrl,
      skill: seed.skill,
    });
    console.log(
      `+ seeded ${seed.skill.name} → ${out.id} (status=${out.status}, stars=${out.stars ?? "-"})`
    );
  }

  // 2. Backfill repoUrl + stars on existing entries.
  const after = (await api("GET", "/api/marketplace")).entries;
  for (const e of after) {
    const repo = REPO_BY_NAME[e.name];
    if (!repo) continue;
    const out = await api("POST", `/api/admin/skills/${e.id}/refresh`, { repoUrl: repo });
    console.log(
      `★ ${e.name} → ${out.stars != null ? out.stars.toLocaleString() : "stars-unknown"}`
    );
  }

  console.log("✓ done");
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
