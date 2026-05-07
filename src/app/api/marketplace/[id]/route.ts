import { NextResponse } from "next/server";
import { getApprovedSkill } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const entry = await getApprovedSkill(id);
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(entry);
}
