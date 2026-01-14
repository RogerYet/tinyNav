export function json(data: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), { ...init, headers });
}

export async function readBodyJson<T>(req: Request): Promise<T> {
  const ct = req.headers.get("Content-Type") || "";
  if (!ct.includes("application/json")) throw new Error("Expected application/json");
  return (await req.json()) as T;
}

export function getClientIp(req: Request) {
  return (
    req.headers.get("CF-Connecting-IP") ||
    req.headers.get("X-Real-IP") ||
    req.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

export function isSecureRequest(req: Request) {
  try {
    return new URL(req.url).protocol === "https:";
  } catch {
    return false;
  }
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

