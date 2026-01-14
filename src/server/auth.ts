import { SESSION_COOKIE, SESSION_DAYS } from "./data";
import { cookieGet, cookieSerialize } from "./cookies";
import { isSecureRequest } from "./http";
import { json } from "./http";
import type { WorkerEnv } from "./cf";

function base64UrlEncode(input: ArrayBuffer | Uint8Array) {
  let bin = "";
  const arr = input instanceof Uint8Array ? input : new Uint8Array(input);
  for (const b of arr) bin += String.fromCharCode(b);
  const b64 = btoa(bin);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecodeToBytes(s: string): Uint8Array<ArrayBuffer> {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out as Uint8Array<ArrayBuffer>;
}

async function hmacKeyFromSecret(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyBytes = enc.encode(secret);
  return crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

async function deriveSecretFromPassword(password: string): Promise<string> {
  const enc = new TextEncoder();
  const bytes = enc.encode(`cloudnav:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return base64UrlEncode(digest);
}

type SessionPayload = { sub: "admin"; iat: number; exp: number };

export async function getSessionSecret(env: WorkerEnv): Promise<string> {
  if (env.SESSION_SECRET && env.SESSION_SECRET.trim()) return env.SESSION_SECRET.trim();
  const pw = (env.PASSWORD ?? "").toString().trim();
  if (!pw) throw new Error("missing PASSWORD");
  return await deriveSecretFromPassword(pw);
}

export async function signSession(payload: SessionPayload, secret: string) {
  const raw = JSON.stringify(payload);
  const key = await hmacKeyFromSecret(secret);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw));
  return `${base64UrlEncode(new TextEncoder().encode(raw))}.${base64UrlEncode(sig)}`;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a[i] ^ b[i];
  return out === 0;
}

export async function verifySession(token: string, secret: string): Promise<SessionPayload | null> {
  const i = token.indexOf(".");
  if (i < 0) return null;
  const payloadPart = token.slice(0, i);
  const sigPart = token.slice(i + 1);
  let payloadBytes: Uint8Array<ArrayBuffer>;
  let sigBytes: Uint8Array<ArrayBuffer>;
  try {
    payloadBytes = base64UrlDecodeToBytes(payloadPart);
    sigBytes = base64UrlDecodeToBytes(sigPart);
  } catch {
    return null;
  }
  const key = await hmacKeyFromSecret(secret);
  const expected = new Uint8Array(await crypto.subtle.sign("HMAC", key, payloadBytes));
  if (!timingSafeEqual(sigBytes, expected)) return null;

  let payload: SessionPayload;
  try {
    payload = JSON.parse(new TextDecoder().decode(payloadBytes)) as SessionPayload;
  } catch {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  if (!payload || payload.sub !== "admin") return null;
  if (typeof payload.exp !== "number" || payload.exp <= now) return null;
  if (typeof payload.iat !== "number" || payload.iat > now + 30) return null;
  return payload;
}

export async function requireAuthed(req: Request, env: WorkerEnv): Promise<{ ok: true } | { ok: false; res: Response }> {
  const pw = (env.PASSWORD ?? "").toString().trim();
  if (!pw) {
    return { ok: false, res: json({ error: "Server misconfigured: missing PASSWORD" }, { status: 503, headers: { "Cache-Control": "no-store" } }) };
  }

  const token = cookieGet(req, SESSION_COOKIE);
  if (!token) return { ok: false, res: json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } }) };
  const secret = await getSessionSecret(env);
  const payload = await verifySession(token, secret);
  if (!payload) {
    const headers = new Headers();
    headers.set("Cache-Control", "no-store");
    headers.append(
      "Set-Cookie",
      cookieSerialize({ name: SESSION_COOKIE, value: "", maxAge: 0, httpOnly: true, secure: isSecureRequest(req) })
    );
    return { ok: false, res: json({ error: "Unauthorized" }, { status: 401, headers }) };
  }
  return { ok: true };
}

export async function requireAuth(req: Request, env: WorkerEnv) {
  return requireAuthed(req, env);
}

export function makeSessionCookie(req: Request) {
  return async (env: WorkerEnv) => {
    const pw = (env.PASSWORD ?? "").toString().trim();
    if (!pw) throw new Error("missing PASSWORD");
    const now = Math.floor(Date.now() / 1000);
    const exp = now + SESSION_DAYS * 24 * 60 * 60;
    const secret = await getSessionSecret(env);
    const token = await signSession({ sub: "admin", iat: now, exp }, secret);
    return cookieSerialize({
      name: SESSION_COOKIE,
      value: token,
      maxAge: exp - now,
      httpOnly: true,
      sameSite: "Lax",
      secure: isSecureRequest(req)
    });
  };
}
