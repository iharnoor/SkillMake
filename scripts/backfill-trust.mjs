#!/usr/bin/env node
/**
 * One-off: backfill the `trust` tier onto existing seed files.
 *
 * Heuristic (curator-overridable afterwards):
 *   - official  : repoUrl owner is the tool's own first-party vendor (allowlist)
 *   - verified  : has a repoUrl but not a first-party vendor org
 *   - community : no repoUrl (default — left IMPLICIT, not written, since the
 *                 schema already defaults to "community")
 *
 * Seeds that already declare `trust` are left untouched. Community-tier seeds
 * are intentionally NOT written so the diff only touches entries earning a
 * visible badge.
 *
 * Insertion is a MINIMAL TEXTUAL edit (a single line added after the existing
 * `"audience": ...,` line) so the rest of each file — including any \uXXXX
 * escaping and key ordering — is preserved byte-for-byte. Re-runnable.
 *
 * Usage: node scripts/backfill-trust.mjs [--dry]
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const seedsDir = resolve(dirname(fileURLToPath(import.meta.url)), "seeds");
const dry = process.argv.includes("--dry");

// First-party vendor GitHub orgs → repo owned by these = "official".
const VENDOR_ORGS = new Set([
  "anthropics", "openai", "cloudflare", "vercel", "nvidia", "microsoft",
  "google", "googleapis", "google-gemini", "googlecloudplatform", "facebook",
  "meta", "stripe", "supabase", "astral-sh", "oven-sh", "biomejs", "denoland",
  "remotion-dev", "honojs", "sveltejs", "withastro", "vuejs", "angular",
  "tailwindlabs", "shadcn-ui", "drizzle-team", "tanstack", "prisma", "pola-rs",
  "ziglang", "gleam-lang", "rust-lang", "golang", "nodejs", "python",
  "elastic", "hashicorp", "grafana", "posthog", "resend", "clerk", "neondatabase",
]);

function ownerOf(repoUrl) {
  try {
    return (new URL(repoUrl).pathname.replace(/^\/+/, "").split("/")[0] || "").toLowerCase();
  } catch {
    return "";
  }
}

const counts = { official: 0, verified: 0, community: 0, "already-set": 0, skipped: 0 };
let written = 0;

for (const file of readdirSync(seedsDir).filter((f) => f.endsWith(".json"))) {
  const path = resolve(seedsDir, file);
  const raw = readFileSync(path, "utf8");
  let doc;
  try {
    doc = JSON.parse(raw);
  } catch {
    counts.skipped++;
    console.warn(`! skip unparseable ${file}`);
    continue;
  }
  if (!doc.skill) { counts.skipped++; continue; }
  if (typeof doc.skill.trust === "string") { counts["already-set"]++; continue; }

  const tier = doc.skill.repoUrl
    ? (VENDOR_ORGS.has(ownerOf(doc.skill.repoUrl)) ? "official" : "verified")
    : "community";
  counts[tier]++;
  if (tier === "community") continue; // leave implicit (schema default)

  // Insert a `"trust": "<tier>",` line right after the `"audience": ...,` line,
  // matching its indentation. Pure text edit — nothing else moves.
  const m = raw.match(/^([ \t]*)"audience"\s*:\s*.*,\s*$/m);
  if (!m) {
    console.warn(`! no audience line to anchor in ${file}; skipping`);
    counts.skipped++;
    counts[tier]--;
    continue;
  }
  const indent = m[1];
  const next = `${m[0]}\n${indent}"trust": "${tier}",`;
  const updated = raw.replace(m[0], next);
  written++;
  if (!dry) writeFileSync(path, updated);
}

console.log(`\n${dry ? "[dry] " : ""}backfill-trust — proposed distribution:`);
console.table(counts);
console.log(`wrote trust to ${written} files${dry ? " (dry-run, nothing written)" : ""}.`);
