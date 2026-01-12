import { json } from "../_utils";

function isLocalDev(req: Request) {
  try {
    const url = new URL(req.url);
    const host = url.hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return false;
  }
}

export const onRequestGet: PagesFunction = async (ctx) => {
  if (!isLocalDev(ctx.request)) return new Response("Not Found", { status: 404 });

  const env = ctx.env as any;
  const hasPassword = !!(env.PASSWORD && String(env.PASSWORD).trim());
  const hasSecret = !!(env.SESSION_SECRET && String(env.SESSION_SECRET).trim());
  return json({ hasPassword, hasSecret }, { headers: { "Cache-Control": "no-store" } });
};

