import { HydraDBClient } from "@hydra_db/node";
import type { Skill } from "./skill-schema";
import { getEnv } from "./env";

/**
 * Semantic search over the skill marketplace, backed by HydraDB.
 *
 * Each published skill is stored as a "memory" entry whose source_id == the
 * marketplace entry id. Search returns ranked source_ids that the caller looks
 * up in KV/file storage.
 *
 * If HYDRADB_API_KEY is missing, all functions degrade gracefully: index/dedup
 * become no-ops, and search falls back to substring matching against a list of
 * candidate entries provided by the caller.
 */

export interface SearchHit {
  id: string;
  score: number;
}

export interface DedupHit {
  id: string;
  score: number;
}

let cachedClient: {
  client: HydraDBClient;
  tenantId: string;
  subTenantId: string;
} | null = null;

async function getClient() {
  if (cachedClient) return cachedClient;
  const env = await getEnv();
  if (!env.HYDRADB_API_KEY || !env.HYDRADB_TENANT_ID) return null;
  const client = new HydraDBClient({
    token: env.HYDRADB_API_KEY,
    baseUrl: "https://api.hydradb.com",
  });
  cachedClient = {
    client,
    tenantId: env.HYDRADB_TENANT_ID,
    subTenantId: env.HYDRADB_SUB_TENANT_ID ?? "skillmake-marketplace",
  };
  return cachedClient;
}

function searchableText(skill: Skill): string {
  return [
    `# ${skill.name}`,
    `Audience: ${skill.audience}`,
    skill.description,
    "When to use:",
    ...skill.whenToUse.map((t) => `- ${t}`),
    "Concepts:",
    ...skill.keyConcepts.map((c) => `- ${c.term}: ${c.explanation}`),
  ].join("\n");
}

export async function indexSkill(id: string, skill: Skill): Promise<{ indexed: boolean }> {
  const ctx = await getClient();
  if (!ctx) return { indexed: false };
  await ctx.client.upload.addMemory({
    memories: [
      {
        source_id: id,
        title: skill.name,
        text: searchableText(skill),
        is_markdown: true,
        infer: false,
        document_metadata: JSON.stringify({
          skill_id: id,
          name: skill.name,
          category: skill.category,
          audience: skill.audience,
        }),
      },
    ],
    tenant_id: ctx.tenantId,
    sub_tenant_id: ctx.subTenantId,
    upsert: true,
  });
  return { indexed: true };
}

export async function searchSkills(query: string, max = 10): Promise<SearchHit[] | null> {
  const ctx = await getClient();
  if (!ctx) return null;
  // addMemory writes to the memory collection, which recallPreferences searches.
  const result = await ctx.client.recall.recallPreferences({
    tenant_id: ctx.tenantId,
    sub_tenant_id: ctx.subTenantId,
    query,
    max_results: max,
    mode: "fast",
  });
  const chunks = result?.chunks ?? [];
  const bySource = new Map<string, number>();
  for (const c of chunks) {
    const score = c.relevancy_score ?? 0;
    const prev = bySource.get(c.source_id) ?? 0;
    if (score > prev) bySource.set(c.source_id, score);
  }
  return Array.from(bySource.entries())
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, max);
}

export async function findDuplicate(skill: Skill, threshold = 0.78): Promise<DedupHit | null> {
  const ctx = await getClient();
  if (!ctx) return null;
  const result = await ctx.client.recall.recallPreferences({
    tenant_id: ctx.tenantId,
    sub_tenant_id: ctx.subTenantId,
    query: skill.description,
    max_results: 3,
    mode: "fast",
  });
  const top = (result?.chunks ?? [])[0];
  if (!top) return null;
  const score = top.relevancy_score ?? 0;
  if (score < threshold) return null;
  return { id: top.source_id, score };
}
