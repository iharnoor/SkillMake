import { NextResponse } from "next/server";
import { z } from "zod";
import {
  buildSessionCookie,
  isRequestHttps,
  safeStringCompare,
  signSession,
} from "@/lib/admin";
import { getEnv } from "@/lib/env";

export const runtime = "nodejs";

const Body = z.object({
  token: z.string().min(8).max(512),
});

export async function POST(req: Request) {
  const env = await getEnv();
  if (!env.ADMIN_TOKEN) {
    return NextResponse.json({ error: "ADMIN_TOKEN not configured" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Token required" }, { status: 400 });
  }

  const matches = await safeStringCompare(parsed.data.token, env.ADMIN_TOKEN);
  if (!matches) {
    // Same status + delay-free path either way; constant-time compare already
    // prevented the timing channel. No lockout — solo curator, low value to add.
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const value = await signSession(env.ADMIN_TOKEN);
  const cookie = buildSessionCookie(value, isRequestHttps(req));
  return new NextResponse(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "set-cookie": cookie,
    },
  });
}
