/**
 * Unified env access. Works in three modes:
 *  - npm run dev (Node.js): reads process.env, falls back to file storage.
 *  - opennextjs preview/deploy (Workers): reads bindings via getCloudflareContext.
 *  - test/SSG: returns a stub with whatever process.env has.
 */

interface EnvShape {
  ANTHROPIC_API_KEY?: string;
  HYDRADB_API_KEY?: string;
  HYDRADB_TENANT_ID?: string;
  HYDRADB_SUB_TENANT_ID?: string;
  SKILLMAKE_MODEL?: string;
  ADMIN_TOKEN?: string;
  GITHUB_TOKEN?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_ANALYTICS_API_TOKEN?: string;
  MARKETPLACE_KV?: KVNamespace;
  METRICS?: AnalyticsEngineDataset;
}

let cached: EnvShape | null = null;

export async function getEnv(): Promise<EnvShape> {
  if (cached) return cached;
  let cf: { env?: Partial<EnvShape> } = {};
  try {
    const mod = await import("@opennextjs/cloudflare");
    if (typeof mod.getCloudflareContext === "function") {
      cf = (await mod.getCloudflareContext({ async: true })) as { env?: Partial<EnvShape> };
    }
  } catch {
    // not running on Cloudflare; fall through to process.env
  }
  const proc = (typeof process !== "undefined" ? process.env : {}) as Record<string, string | undefined>;
  cached = {
    ANTHROPIC_API_KEY: cf.env?.ANTHROPIC_API_KEY ?? proc.ANTHROPIC_API_KEY,
    HYDRADB_API_KEY: cf.env?.HYDRADB_API_KEY ?? proc.HYDRADB_API_KEY,
    HYDRADB_TENANT_ID: cf.env?.HYDRADB_TENANT_ID ?? proc.HYDRADB_TENANT_ID,
    HYDRADB_SUB_TENANT_ID:
      cf.env?.HYDRADB_SUB_TENANT_ID ?? proc.HYDRADB_SUB_TENANT_ID ?? "skillmake-marketplace",
    SKILLMAKE_MODEL: cf.env?.SKILLMAKE_MODEL ?? proc.SKILLMAKE_MODEL,
    ADMIN_TOKEN: cf.env?.ADMIN_TOKEN ?? proc.ADMIN_TOKEN,
    GITHUB_TOKEN: cf.env?.GITHUB_TOKEN ?? proc.GITHUB_TOKEN,
    CLOUDFLARE_ACCOUNT_ID: cf.env?.CLOUDFLARE_ACCOUNT_ID ?? proc.CLOUDFLARE_ACCOUNT_ID,
    CLOUDFLARE_ANALYTICS_API_TOKEN:
      cf.env?.CLOUDFLARE_ANALYTICS_API_TOKEN ?? proc.CLOUDFLARE_ANALYTICS_API_TOKEN,
    MARKETPLACE_KV: cf.env?.MARKETPLACE_KV,
    METRICS: cf.env?.METRICS,
  };
  return cached;
}
