/**
 * Admin session helpers — solo curator auth for /admin/*.
 *
 * Cookie format: <b64url(payload)>.<b64url(hmac-sha256(payload, ADMIN_TOKEN))>
 * payload: JSON `{ exp: <unix-seconds> }`
 *
 * - Web Crypto only (no node:crypto). Works in proxy.ts (edge-compatible) and
 *   route handlers without runtime-config gymnastics.
 * - Constant-time signature compare.
 * - Rotating ADMIN_TOKEN invalidates every existing session, so token rotation
 *   doubles as a global revoke.
 * - Cookie attributes: HttpOnly, SameSite=Lax, Path=/, Max-Age=7d. `Secure` is
 *   added only when the request was over HTTPS, so localhost dev still works.
 */

export const ADMIN_COOKIE = "admin_session";
const SESSION_TTL_SEC = 60 * 60 * 24 * 7; // 7 days

const enc = new TextEncoder();
const dec = new TextDecoder();

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): Uint8Array {
  let t = s.replace(/-/g, "+").replace(/_/g, "/");
  while (t.length % 4) t += "=";
  const bin = atob(t);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a[i] ^ b[i];
  return mismatch === 0;
}

// TS 5.7+ tightened BufferSource to require Uint8Array<ArrayBuffer> (not the
// generic ArrayBufferLike). enc.encode() returns the wider type, so cast at
// the WebCrypto boundary rather than fighting the lib defs everywhere.
async function hmac(key: string, data: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key) as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, data as BufferSource);
  return new Uint8Array(sig);
}

async function sha256(s: string): Promise<Uint8Array> {
  return new Uint8Array(
    await crypto.subtle.digest("SHA-256", enc.encode(s) as BufferSource)
  );
}

/** Constant-time compare of two strings via SHA-256 hashes. Hashing avoids
 *  variable-length leakage and produces fixed-size buffers for the XOR loop. */
export async function safeStringCompare(a: string, b: string): Promise<boolean> {
  const [ha, hb] = await Promise.all([sha256(a), sha256(b)]);
  return constantTimeEqual(ha, hb);
}

export async function signSession(adminToken: string, ttlSec = SESSION_TTL_SEC): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + ttlSec;
  const payloadBytes = enc.encode(JSON.stringify({ exp }));
  const sig = await hmac(adminToken, payloadBytes);
  return `${b64url(payloadBytes)}.${b64url(sig)}`;
}

export async function verifySession(adminToken: string, cookie: string | undefined): Promise<boolean> {
  if (!cookie || !adminToken) return false;
  const dot = cookie.indexOf(".");
  if (dot < 1 || dot >= cookie.length - 1) return false;
  const pPart = cookie.slice(0, dot);
  const sPart = cookie.slice(dot + 1);
  let payloadBytes: Uint8Array;
  let providedSig: Uint8Array;
  try {
    payloadBytes = b64urlDecode(pPart);
    providedSig = b64urlDecode(sPart);
  } catch {
    return false;
  }
  const expectedSig = await hmac(adminToken, payloadBytes);
  if (!constantTimeEqual(expectedSig, providedSig)) return false;
  try {
    const parsed = JSON.parse(dec.decode(payloadBytes)) as { exp?: unknown };
    if (typeof parsed.exp !== "number") return false;
    if (parsed.exp < Math.floor(Date.now() / 1000)) return false;
    return true;
  } catch {
    return false;
  }
}

/** Build the Set-Cookie header value for an admin session. */
export function buildSessionCookie(value: string, isHttps: boolean): string {
  const parts = [
    `${ADMIN_COOKIE}=${value}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${SESSION_TTL_SEC}`,
  ];
  if (isHttps) parts.push("Secure");
  return parts.join("; ");
}

export function buildLogoutCookie(isHttps: boolean): string {
  const parts = [`${ADMIN_COOKIE}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
  if (isHttps) parts.push("Secure");
  return parts.join("; ");
}

/** Detect whether the request reached us over HTTPS, accounting for the
 *  Cloudflare proxy. */
export function isRequestHttps(req: Request): boolean {
  const url = new URL(req.url);
  if (url.protocol === "https:") return true;
  const xfp = req.headers.get("x-forwarded-proto");
  return xfp === "https";
}
