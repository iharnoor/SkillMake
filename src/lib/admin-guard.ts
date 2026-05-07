import { cookies } from "next/headers";
import { ADMIN_COOKIE, verifySession } from "@/lib/admin";
import { getEnv } from "@/lib/env";

/**
 * Server-side admin gate for route handlers and Server Components.
 * The proxy already gates these paths, but we re-check here so that an
 * accidental matcher change can't quietly drop the wall.
 */
export async function isAdmin(): Promise<boolean> {
  const env = await getEnv();
  if (!env.ADMIN_TOKEN) return false;
  const jar = await cookies();
  const value = jar.get(ADMIN_COOKIE)?.value;
  return verifySession(env.ADMIN_TOKEN, value);
}
