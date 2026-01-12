import { json, readBodyJson, requireAuth, saveData } from "../_utils";

export const onRequestPost: PagesFunction = async (ctx) => {
  const env = ctx.env as any;
  const auth = await requireAuth(ctx.request, env);
  if (!auth.ok) return auth.res;

  let body: any;
  try {
    body = await readBodyJson<any>(ctx.request);
  } catch (e: unknown) {
    return json({ error: e instanceof Error ? e.message : "Bad Request" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  if (!body || !Array.isArray(body.groups) || !Array.isArray(body.links)) {
    return json({ error: "Invalid data" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  await saveData(env, body);
  return json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
};
