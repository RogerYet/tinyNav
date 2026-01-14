import { DATA_KEY, LOGIN_FAIL_KEY_PREFIX, type CloudNavData } from "./data";
import type { WorkerEnv } from "./cf";
import { json } from "./http";
import { normalizeData, seedIfEmpty } from "./normalize";
import type { DurableObjectState } from "./cf";

type LoginFailState = { fails: number; last: number };

function getStub(env: WorkerEnv) {
  const id = env.CLOUDNAV_DB.idFromName("global");
  return env.CLOUDNAV_DB.get(id);
}

async function doJson<T>(stub: { fetch: (req: Request) => Promise<Response> }, req: Request): Promise<T> {
  const res = await stub.fetch(req);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`DO error ${res.status}: ${text}`);
  }
  return (await res.json()) as T;
}

export async function loadData(env: WorkerEnv): Promise<CloudNavData> {
  const stub = getStub(env);
  const data = await doJson<{ data?: CloudNavData }>(
    stub,
    new Request("https://cloudnav.do/data", { method: "GET", headers: { Accept: "application/json" } })
  );
  return seedIfEmpty(data.data);
}

export async function saveData(env: WorkerEnv, data: CloudNavData) {
  const stub = getStub(env);
  await doJson<{ ok: true }>(
    stub,
    new Request("https://cloudnav.do/data", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data })
    })
  );
}

export async function getLoginFail(env: WorkerEnv, ip: string): Promise<LoginFailState | null> {
  const stub = getStub(env);
  const key = `${LOGIN_FAIL_KEY_PREFIX}${ip}`;
  const res = await doJson<{ state?: LoginFailState | null }>(
    stub,
    new Request(`https://cloudnav.do/kv?key=${encodeURIComponent(key)}`, { method: "GET" })
  );
  return res.state ?? null;
}

export async function putLoginFail(env: WorkerEnv, ip: string, state: LoginFailState) {
  const stub = getStub(env);
  const key = `${LOGIN_FAIL_KEY_PREFIX}${ip}`;
  await doJson<{ ok: true }>(
    stub,
    new Request("https://cloudnav.do/kv", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value: state })
    })
  );
}

export async function deleteLoginFail(env: WorkerEnv, ip: string) {
  const stub = getStub(env);
  const key = `${LOGIN_FAIL_KEY_PREFIX}${ip}`;
  await doJson<{ ok: true }>(
    stub,
    new Request("https://cloudnav.do/kv", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key }) })
  );
}

export class CloudNavDB {
  constructor(
    private state: DurableObjectState,
    private env: WorkerEnv
  ) {}

  async fetch(request: Request) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/data" && request.method === "GET") {
      const data = (await this.state.storage.get<CloudNavData>(DATA_KEY)) ?? undefined;
      return json({ data }, { headers: { "Cache-Control": "no-store" } });
    }

    if (path === "/data" && request.method === "PUT") {
      const body = (await request.json().catch(() => null)) as { data?: CloudNavData } | null;
      if (!body?.data) return json({ error: "Invalid request body" }, { status: 400, headers: { "Cache-Control": "no-store" } });
      const normalized = normalizeData(seedIfEmpty(body.data));
      await this.state.storage.put(DATA_KEY, normalized);
      return json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
    }

    if (path === "/kv" && request.method === "GET") {
      const key = url.searchParams.get("key") || "";
      if (!key) return json({ error: "Missing key" }, { status: 400, headers: { "Cache-Control": "no-store" } });
      const state = (await this.state.storage.get<LoginFailState>(key)) ?? null;
      if (!state) return json({ state: null }, { headers: { "Cache-Control": "no-store" } });
      // Soft TTL: 10 minutes
      if (Date.now() - state.last > 10 * 60 * 1000) {
        await this.state.storage.delete(key);
        return json({ state: null }, { headers: { "Cache-Control": "no-store" } });
      }
      return json({ state }, { headers: { "Cache-Control": "no-store" } });
    }

    if (path === "/kv" && request.method === "PUT") {
      const body = (await request.json().catch(() => null)) as { key?: string; value?: LoginFailState } | null;
      const key = (body?.key ?? "").toString();
      if (!key) return json({ error: "Missing key" }, { status: 400, headers: { "Cache-Control": "no-store" } });
      const value = body?.value;
      if (!value || typeof value.fails !== "number" || typeof value.last !== "number") {
        return json({ error: "Invalid value" }, { status: 400, headers: { "Cache-Control": "no-store" } });
      }
      await this.state.storage.put(key, value);
      return json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
    }

    if (path === "/kv" && request.method === "DELETE") {
      const body = (await request.json().catch(() => null)) as { key?: string } | null;
      const key = (body?.key ?? "").toString();
      if (!key) return json({ error: "Missing key" }, { status: 400, headers: { "Cache-Control": "no-store" } });
      await this.state.storage.delete(key);
      return json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
    }

    return json({ error: "Not Found" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
}
