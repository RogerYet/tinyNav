import {
  cookieSerialize,
  getClientIp,
  getSessionSecret,
  isSecureRequest,
  json,
  LOGIN_FAIL_KEY_PREFIX,
  readBodyJson,
  SESSION_COOKIE,
  SESSION_DAYS,
  signSession,
  sleep
} from "./_utils";

type LoginBody = { password?: string };

export const onRequestPost: PagesFunction = async (ctx) => {
  const req = ctx.request;
  const env = ctx.env as any;

  const serverPassword = (env.PASSWORD ?? "").toString().trim();
  if (!serverPassword) {
    return json(
      { error: "Server misconfigured: missing PASSWORD (set it in .dev.vars or Pages Environment variables)" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }

  const ip = getClientIp(req);
  const failKey = `${LOGIN_FAIL_KEY_PREFIX}${ip}`;
  const failState = (await env.CLOUDNAV_KV.get(failKey, "json")) as { fails?: number; last?: number } | null;
  const fails = Math.max(0, failState?.fails ?? 0);

  if (fails > 0) {
    const penalty = Math.min(8000, 700 + fails * 700);
    await sleep(penalty);
  }

  let body: LoginBody;
  try {
    body = await readBodyJson<LoginBody>(req);
  } catch (e: unknown) {
    return json({ error: e instanceof Error ? e.message : "Bad Request" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  const provided = (body.password ?? "").toString().trim();
  if (!provided) return json({ error: "Missing password" }, { status: 400, headers: { "Cache-Control": "no-store" } });

  if (provided !== serverPassword) {
    const nextFails = fails + 1;
    await env.CLOUDNAV_KV.put(failKey, JSON.stringify({ fails: nextFails, last: Date.now() }), {
      expirationTtl: 10 * 60
    });
    return json({ error: "Invalid password" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  await env.CLOUDNAV_KV.delete(failKey);

  const now = Math.floor(Date.now() / 1000);
  const exp = now + SESSION_DAYS * 24 * 60 * 60;
  const secret = await getSessionSecret(env);
  const token = await signSession({ sub: "admin", iat: now, exp }, secret);

  const headers = new Headers();
  headers.set("Cache-Control", "no-store");
  headers.append(
    "Set-Cookie",
    cookieSerialize({
      name: SESSION_COOKIE,
      value: token,
      maxAge: exp - now,
      httpOnly: true,
      sameSite: "Lax",
      secure: isSecureRequest(req)
    })
  );
  return json({ ok: true }, { headers });
};
