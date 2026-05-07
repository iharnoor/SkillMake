import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-guard";
import { listSkillsByStatus } from "@/lib/storage";
import { indexSkill } from "@/lib/vector";

export const runtime = "nodejs";

/**
 * Curator-only: walk every approved skill and re-upsert it into HydraDB
 * under its current id. Use after a tenant rebuild or when KV ids drift
 * from indexed source_ids (search returns chunks but the search route
 * filters them all out).
 */
export async function POST() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const entries = await listSkillsByStatus("approved");
  let indexed = 0;
  let skipped = 0;
  const errors: Array<{ id: string; error: string }> = [];
  for (const e of entries) {
    try {
      const r = await indexSkill(e.id, e.skill);
      if (r.indexed) indexed += 1;
      else skipped += 1;
    } catch (err) {
      errors.push({ id: e.id, error: (err as Error).message });
    }
  }
  return NextResponse.json({ ok: true, total: entries.length, indexed, skipped, errors });
}
