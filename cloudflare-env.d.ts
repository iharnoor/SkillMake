interface CloudflareEnv {
  ASSETS: Fetcher;
  MARKETPLACE_KV?: KVNamespace;
  METRICS?: AnalyticsEngineDataset;
  ANTHROPIC_API_KEY?: string;
  HYDRADB_API_KEY?: string;
  HYDRADB_TENANT_ID?: string;
  HYDRADB_SUB_TENANT_ID?: string;
  SKILLMAKE_MODEL?: string;
  ADMIN_TOKEN?: string;
  GITHUB_TOKEN?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
}
