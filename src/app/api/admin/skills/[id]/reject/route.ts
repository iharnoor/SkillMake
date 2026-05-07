import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-guard";
import { setSkillStatus } from "@/lib/storage";

export const runtime = "nodejs";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const updated = await setSkillStatus(id, "rejected");
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true, id: updated.id, status: updated.status });
}
