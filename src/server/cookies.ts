import { isSecureRequest } from "./http";

export function cookieGet(req: Request, name: string): string | null {
  const raw = req.headers.get("Cookie");
  if (!raw) return null;
  const parts = raw.split(";").map((p) => p.trim());
  for (const p of parts) {
    if (!p) continue;
    const i = p.indexOf("=");
    if (i < 0) continue;
    const k = p.slice(0, i);
    const v = p.slice(i + 1);
    if (k === name) return decodeURIComponent(v);
  }
  return null;
}

export function cookieSerialize({
  name,
  value,
  maxAge,
  expires,
  httpOnly = true,
  sameSite = "Lax",
  path = "/",
  secure
}: {
  name: string;
  value: string;
  maxAge?: number;
  expires?: Date;
  httpOnly?: boolean;
  sameSite?: "Lax" | "Strict" | "None";
  path?: string;
  secure?: boolean;
}) {
  const chunks = [`${name}=${encodeURIComponent(value)}`];
  chunks.push(`Path=${path}`);
  chunks.push(`SameSite=${sameSite}`);
  if (httpOnly) chunks.push("HttpOnly");
  if (typeof maxAge === "number") chunks.push(`Max-Age=${Math.floor(maxAge)}`);
  if (expires) chunks.push(`Expires=${expires.toUTCString()}`);
  if (secure) chunks.push("Secure");
  return chunks.join("; ");
}

export function clearCookieHeader(req: Request, name: string) {
  return cookieSerialize({ name, value: "", maxAge: 0, httpOnly: true, secure: isSecureRequest(req) });
}

