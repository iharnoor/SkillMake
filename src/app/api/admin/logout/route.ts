import { NextResponse } from "next/server";
import { buildLogoutCookie, isRequestHttps } from "@/lib/admin";

export const runtime = "nodejs";

export async function POST(req: Request) {
  return new NextResponse(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "set-cookie": buildLogoutCookie(isRequestHttps(req)),
    },
  });
}
