import { z } from "zod";
import { SESSION_COOKIE, SESSION_DAYS, defaultSettings } from "./data";
import type { WorkerEnv } from "./cf";
import { json, readBodyJson, sleep, getClientIp, isSecureRequest } from "./http";
import { cookieGet, cookieSerialize } from "./cookies";
import { getSessionSecret, signSession, verifySession, requireAuth } from "./auth";
import { loadData, saveData, deleteLoginFail, getLoginFail, putLoginFail } from "./storage";
import { normalizeData, normalizeSettings } from "./normalize";

const noStore = { "Cache-Control": "no-store" };

function USE_FAVICON_SERVICE(env: WorkerEnv) {
  return String(env.USE_FAVICON_SERVICE ?? "").toLowerCase() === "true";
}

function normalizeHttpUrl(s: string) {
  const v = s.trim();
  if (!v) return v;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(v)) return v;
  return `https://${v}`;
}

const HttpUrl = z
  .string()
  .trim()
  .min(1)
  .transform((s) => normalizeHttpUrl(s))
  .refine((s) => {
    try {
      const u = new URL(s);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch {
      return false;
    }
  }, "URL must be http/https");

const IconUrl = z
  .string()
  .trim()
  .max(512)
  .transform((s) => (s ? normalizeHttpUrl(s) : ""))
  .refine((s) => {
    if (!s) return true;
    try {
      const u = new URL(s);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch {
      return false;
    }
  }, "Icon URL must be http/https")
  .optional();

function normalizeFaviconUrl(siteUrl: string, useService: boolean) {
  const normalized = normalizeHttpUrl(siteUrl);
  const u = new URL(normalized);
  if (useService) {
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(u.hostname)}&sz=64`;
  }
  return `${u.origin}/favicon.ico`;
}

function missingPassword(env: WorkerEnv) {
  return !(env.PASSWORD && String(env.PASSWORD).trim());
}

function isLocalDev(req: Request) {
  try {
    const url = new URL(req.url);
    const host = url.hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return false;
  }
}

// ---- Schemas (ported from Pages Functions) ----

const CreateGroupBody = z.object({ name: z.string().trim().min(1).max(64) });

const UpdateGroupBody = z
  .object({ name: z.string().trim().min(1).max(64).optional(), enabled: z.boolean().optional() })
  .refine((v) => Object.keys(v).length > 0, { message: "Empty patch" });

const CreateSectionBody = z.object({ groupId: z.string().min(1), name: z.string().trim().min(1).max(60) });

const UpdateSectionBody = z
  .object({ name: z.string().trim().min(1).max(60).optional(), order: z.number().int().min(0).optional() })
  .refine((v) => Object.keys(v).length > 0, { message: "Empty patch" });

const CreateLinkBody = z.object({
  groupId: z.string().min(1),
  sectionId: z.string().trim().min(1).optional(),
  title: z.string().trim().min(1).max(80),
  url: HttpUrl,
  description: z.string().trim().max(200).optional(),
  icon: IconUrl
});

const UpdateLinkBody = z
  .object({
    groupId: z.string().min(1).optional(),
    sectionId: z.string().trim().min(1).optional().nullable(),
    title: z.string().trim().min(1).max(80).optional(),
    url: HttpUrl.optional(),
    description: z.string().trim().max(200).optional(),
    icon: IconUrl
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Empty patch" });

const ReorderBody = z.object({
  groups: z.array(z.object({ id: z.string().min(1), order: z.number().int().min(0) })).optional(),
  sections: z.array(z.object({ id: z.string().min(1), order: z.number().int().min(0) })).optional(),
  links: z
    .array(
      z.object({
        id: z.string().min(1),
        order: z.number().int().min(0),
        groupId: z.string().min(1).optional(),
        sectionId: z.string().trim().min(1).optional().nullable()
      })
    )
    .optional()
});

const SettingsPatch = z.object({
  siteTitle: z.string().trim().min(1).max(40).optional(),
  siteSubtitle: z.string().trim().min(1).max(60).optional(),
  homeTagline: z.string().trim().min(1).max(120).optional(),
  siteIconDataUrl: z.string().trim().max(360000).optional(),
  faviconDataUrl: z.string().trim().max(360000).optional(),
  siteIconFit: z.enum(["contain", "cover"]).optional()
});

function validateImageRefOrEmpty(v: string) {
  if (!v) return true;
  if (v.startsWith("data:")) return /^data:image\//.test(v);
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

// ---- Router ----

export async function handleApi(req: Request, env: WorkerEnv) {
  const url = new URL(req.url);
  const path = url.pathname;

  // Public
  if (req.method === "GET" && path === "/api/links") {
    const data = normalizeData(await loadData(env));
    return json(data, { headers: { "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=86400" } });
  }

  if (req.method === "GET" && path === "/api/me") {
    const token = cookieGet(req, SESSION_COOKIE);
    if (!token) return json({ authed: false }, { headers: noStore });
    if (missingPassword(env)) return json({ authed: false }, { headers: noStore });
    const secret = await getSessionSecret(env);
    const payload = await verifySession(token, secret);
    if (payload) return json({ authed: true }, { headers: noStore });

    const headers = new Headers(noStore);
    headers.append("Set-Cookie", cookieSerialize({ name: SESSION_COOKIE, value: "", maxAge: 0, httpOnly: true, secure: isSecureRequest(req) }));
    return json({ authed: false }, { headers });
  }

  if (req.method === "POST" && path === "/api/logout") {
    const headers = new Headers(noStore);
    headers.append(
      "Set-Cookie",
      cookieSerialize({ name: SESSION_COOKIE, value: "", maxAge: 0, httpOnly: true, sameSite: "Lax", secure: isSecureRequest(req) })
    );
    return json({ ok: true }, { headers });
  }

  if (req.method === "POST" && path === "/api/login") {
    const serverPassword = (env.PASSWORD ?? "").toString().trim();
    if (!serverPassword) {
      return json({ error: "Server misconfigured: missing PASSWORD" }, { status: 503, headers: noStore });
    }

    const ip = getClientIp(req);
    const failState = await getLoginFail(env, ip);
    const fails = Math.max(0, failState?.fails ?? 0);
    if (fails > 0) {
      const penalty = Math.min(8000, 700 + fails * 700);
      await sleep(penalty);
    }

    let body: { password?: string };
    try {
      body = await readBodyJson(req);
    } catch (e: unknown) {
      return json({ error: e instanceof Error ? e.message : "Bad Request" }, { status: 400, headers: noStore });
    }

    const provided = (body.password ?? "").toString().trim();
    if (!provided) return json({ error: "Missing password" }, { status: 400, headers: noStore });

    if (provided !== serverPassword) {
      await putLoginFail(env, ip, { fails: fails + 1, last: Date.now() });
      return json({ error: "Invalid password" }, { status: 401, headers: noStore });
    }

    await deleteLoginFail(env, ip);
    const now = Math.floor(Date.now() / 1000);
    const exp = now + SESSION_DAYS * 24 * 60 * 60;
    const secret = await getSessionSecret(env);
    const token = await signSession({ sub: "admin", iat: now, exp }, secret);

    const headers = new Headers(noStore);
    headers.append(
      "Set-Cookie",
      cookieSerialize({ name: SESSION_COOKIE, value: token, maxAge: exp - now, httpOnly: true, sameSite: "Lax", secure: isSecureRequest(req) })
    );
    return json({ ok: true }, { headers });
  }

  // Debug
  if (req.method === "GET" && path === "/api/debug/env") {
    if (!isLocalDev(req)) return new Response("Not Found", { status: 404 });
    const hasPassword = !!(env.PASSWORD && String(env.PASSWORD).trim());
    const hasSecret = !!(env.SESSION_SECRET && String(env.SESSION_SECRET).trim());
    return json({ hasPassword, hasSecret }, { headers: noStore });
  }

  // Admin (auth)
  if (path.startsWith("/api/admin/")) {
    const auth = await requireAuth(req, env);
    if (!auth.ok) return auth.res;

    // groups
    if (req.method === "POST" && path === "/api/admin/groups") {
      let parsed: z.infer<typeof CreateGroupBody>;
      try {
        parsed = CreateGroupBody.parse(await req.json());
      } catch (e: unknown) {
        return json({ error: "Invalid request body", details: e instanceof z.ZodError ? e.issues : undefined }, { status: 400, headers: noStore });
      }
      const data = await loadData(env);
      const nextOrder = data.groups.length ? Math.max(...data.groups.map((g) => g.order)) + 1 : 0;
      const group = { id: crypto.randomUUID(), name: parsed.name, order: nextOrder, enabled: true };
      data.groups.push(group);
      await saveData(env, normalizeData(data));
      return json({ ok: true, group }, { headers: noStore });
    }

    const groupIdMatch = path.match(/^\/api\/admin\/groups\/([^/]+)$/);
    if (groupIdMatch) {
      const id = decodeURIComponent(groupIdMatch[1]!);
      if (req.method === "PUT") {
        let parsed: z.infer<typeof UpdateGroupBody>;
        try {
          parsed = UpdateGroupBody.parse(await req.json());
        } catch (e: unknown) {
          return json({ error: "Invalid request body", details: e instanceof z.ZodError ? e.issues : undefined }, { status: 400, headers: noStore });
        }
        const data = await loadData(env);
        const idx = data.groups.findIndex((g) => g.id === id);
        if (idx < 0) return json({ error: "Group not found" }, { status: 404, headers: noStore });
        data.groups[idx] = { ...data.groups[idx], ...(typeof parsed.name === "string" ? { name: parsed.name } : null), ...(typeof parsed.enabled === "boolean" ? { enabled: parsed.enabled } : null) } as any;
        const normalized = normalizeData(data);
        await saveData(env, normalized);
        const group = normalized.groups.find((g) => g.id === id)!;
        return json({ ok: true, group }, { headers: noStore });
      }
      if (req.method === "DELETE") {
        const data = await loadData(env);
        const before = data.groups.length;
        const groups = data.groups.filter((g) => g.id !== id);
        if (groups.length === before) return json({ error: "Group not found" }, { status: 404, headers: noStore });
        const links = data.links.filter((l) => l.groupId !== id);
        const sections = (data.sections ?? []).filter((s) => s.groupId !== id);
        const normalized = normalizeData({ ...data, groups, sections, links });
        await saveData(env, normalized);
        return json({ ok: true }, { headers: noStore });
      }
    }

    // sections
    if (req.method === "POST" && path === "/api/admin/sections") {
      let parsed: z.infer<typeof CreateSectionBody>;
      try {
        parsed = CreateSectionBody.parse(await req.json());
      } catch (e: unknown) {
        return json({ error: "Invalid request body", details: e instanceof z.ZodError ? e.issues : undefined }, { status: 400, headers: noStore });
      }
      const data = await loadData(env);
      const group = data.groups.find((g) => g.id === parsed.groupId);
      if (!group) return json({ error: "Group not found" }, { status: 404, headers: noStore });
      const sections = data.sections ?? [];
      const inGroup = sections.filter((s) => s.groupId === parsed.groupId);
      const nextOrder = inGroup.length ? Math.max(...inGroup.map((s) => s.order)) + 1 : 0;
      const section = { id: crypto.randomUUID(), groupId: parsed.groupId, name: parsed.name, order: nextOrder };
      const merged = normalizeData({ ...data, sections: [...sections, section] });
      await saveData(env, merged);
      const saved = merged.sections?.find((s) => s.id === section.id)!;
      return json({ ok: true, section: saved }, { headers: noStore });
    }

    const sectionIdMatch = path.match(/^\/api\/admin\/sections\/([^/]+)$/);
    if (sectionIdMatch) {
      const id = decodeURIComponent(sectionIdMatch[1]!);
      if (req.method === "PUT") {
        let parsed: z.infer<typeof UpdateSectionBody>;
        try {
          parsed = UpdateSectionBody.parse(await req.json());
        } catch (e: unknown) {
          return json({ error: "Invalid request body", details: e instanceof z.ZodError ? e.issues : undefined }, { status: 400, headers: noStore });
        }
        const data = await loadData(env);
        const sections = data.sections ?? [];
        const idx = sections.findIndex((s) => s.id === id);
        if (idx < 0) return json({ error: "Section not found" }, { status: 404, headers: noStore });
        const nextSections = sections.slice();
        nextSections[idx] = { ...sections[idx]!, ...parsed };
        const merged = normalizeData({ ...data, sections: nextSections });
        await saveData(env, merged);
        const saved = merged.sections?.find((s) => s.id === id)!;
        return json({ ok: true, section: saved }, { headers: noStore });
      }
      if (req.method === "DELETE") {
        const data = await loadData(env);
        const sections = data.sections ?? [];
        if (!sections.some((s) => s.id === id)) return json({ error: "Section not found" }, { status: 404, headers: noStore });
        const nextSections = sections.filter((s) => s.id !== id);
        const nextLinks = data.links.map((l) => (l.sectionId === id ? { ...l, sectionId: undefined } : l));
        const merged = normalizeData({ ...data, sections: nextSections, links: nextLinks });
        await saveData(env, merged);
        return json({ ok: true }, { headers: noStore });
      }
    }

    // links
    if (req.method === "POST" && path === "/api/admin/links") {
      let parsed: z.infer<typeof CreateLinkBody>;
      try {
        parsed = CreateLinkBody.parse(await req.json());
      } catch (e: unknown) {
        return json({ error: "Invalid request body", details: e instanceof z.ZodError ? e.issues : undefined }, { status: 400, headers: noStore });
      }
      const data = await loadData(env);
      const group = data.groups.find((g) => g.id === parsed.groupId);
      if (!group) return json({ error: "Group not found" }, { status: 404, headers: noStore });
      const rawSectionId = parsed.sectionId?.trim() ? parsed.sectionId.trim() : undefined;
      const validSectionId =
        rawSectionId && (data.sections ?? []).some((s) => s.id === rawSectionId && s.groupId === parsed.groupId) ? rawSectionId : undefined;
      const inBucket = data.links.filter((l) => l.groupId === parsed.groupId && (l.sectionId?.trim() || undefined) === validSectionId);
      const nextOrder = inBucket.length ? Math.max(...inBucket.map((l) => l.order)) + 1 : 0;
      const icon = parsed.icon && parsed.icon.trim() ? parsed.icon.trim() : normalizeFaviconUrl(parsed.url, USE_FAVICON_SERVICE(env));
      const link = { id: crypto.randomUUID(), groupId: parsed.groupId, sectionId: validSectionId, title: parsed.title, url: parsed.url, icon, description: parsed.description || undefined, order: nextOrder };
      data.links.push(link);
      const normalized = normalizeData(data);
      await saveData(env, normalized);
      const savedLink = normalized.links.find((l) => l.id === link.id)!;
      return json({ ok: true, link: savedLink }, { headers: noStore });
    }

    const linkIdMatch = path.match(/^\/api\/admin\/links\/([^/]+)$/);
    if (linkIdMatch) {
      const id = decodeURIComponent(linkIdMatch[1]!);
      if (req.method === "PUT") {
        let parsed: z.infer<typeof UpdateLinkBody>;
        try {
          parsed = UpdateLinkBody.parse(await req.json());
        } catch (e: unknown) {
          return json({ error: "Invalid request body", details: e instanceof z.ZodError ? e.issues : undefined }, { status: 400, headers: noStore });
        }
        const data = await loadData(env);
        const idx = data.links.findIndex((l) => l.id === id);
        if (idx < 0) return json({ error: "Link not found" }, { status: 404, headers: noStore });
        const current = data.links[idx]!;
        const nextGroupId = parsed.groupId ?? current.groupId;
        if (!data.groups.some((g) => g.id === nextGroupId)) return json({ error: "Group not found" }, { status: 404, headers: noStore });
        const rawSectionId = parsed.sectionId === null || parsed.sectionId === "" ? undefined : parsed.sectionId;
        const nextSectionId =
          rawSectionId && (data.sections ?? []).some((s) => s.id === rawSectionId && s.groupId === nextGroupId) ? rawSectionId : undefined;
        const nextUrl = parsed.url ?? current.url;
        const iconFromBody = typeof parsed.icon === "string" ? parsed.icon : undefined;
        const icon =
          iconFromBody === undefined
            ? current.icon
            : iconFromBody.trim()
              ? iconFromBody.trim()
              : normalizeFaviconUrl(nextUrl, USE_FAVICON_SERVICE(env));
        const movedBucket = nextGroupId !== current.groupId || nextSectionId !== (current.sectionId?.trim() || undefined);
        const nextOrder = (() => {
          if (!movedBucket) return current.order;
          const bucket = data.links.filter((l) => l.groupId === nextGroupId && (l.sectionId?.trim() || undefined) === nextSectionId);
          return bucket.length ? Math.max(...bucket.map((l) => l.order)) + 1 : 0;
        })();
        data.links[idx] = {
          ...current,
          ...parsed,
          groupId: nextGroupId,
          sectionId: nextSectionId,
          url: nextUrl,
          icon,
          description: parsed.description === "" ? undefined : parsed.description ?? current.description,
          order: nextOrder
        };
        const normalized = normalizeData(data);
        await saveData(env, normalized);
        const link = normalized.links.find((l) => l.id === id)!;
        return json({ ok: true, link }, { headers: noStore });
      }
      if (req.method === "DELETE") {
        const data = await loadData(env);
        const before = data.links.length;
        const links = data.links.filter((l) => l.id !== id);
        if (links.length === before) return json({ error: "Link not found" }, { status: 404, headers: noStore });
        const normalized = normalizeData({ ...data, links });
        await saveData(env, normalized);
        return json({ ok: true }, { headers: noStore });
      }
    }

    // reorder
    if (req.method === "POST" && path === "/api/admin/reorder") {
      let parsed: z.infer<typeof ReorderBody>;
      try {
        parsed = ReorderBody.parse(await req.json());
      } catch (e: unknown) {
        return json({ error: "Invalid request body", details: e instanceof z.ZodError ? e.issues : undefined }, { status: 400, headers: noStore });
      }

      const data = await loadData(env);
      const groupPatch = new Map((parsed.groups ?? []).map((g) => [g.id, g.order] as const));
      const sectionPatch = new Map((parsed.sections ?? []).map((s) => [s.id, s.order] as const));
      const linkPatch = new Map((parsed.links ?? []).map((l) => [l.id, { order: l.order, groupId: l.groupId, sectionId: l.sectionId }] as const));

      if (groupPatch.size) data.groups = data.groups.map((g) => (groupPatch.has(g.id) ? { ...g, order: groupPatch.get(g.id)! } : g));
      if (sectionPatch.size) data.sections = (data.sections ?? []).map((s) => (sectionPatch.has(s.id) ? { ...s, order: sectionPatch.get(s.id)! } : s));
      if (linkPatch.size) {
        data.links = data.links.map((l) => {
          const p = linkPatch.get(l.id);
          if (!p) return l;
          const nextGroupId = p.groupId ?? l.groupId;
          const nextSectionId = p.sectionId === null || p.sectionId === "" ? undefined : p.sectionId;
          return { ...l, groupId: nextGroupId, sectionId: nextSectionId, order: p.order };
        });
      }

      const normalized = normalizeData(data);
      await saveData(env, normalized);
      return json({ ok: true }, { headers: noStore });
    }

    // settings
    if (req.method === "GET" && path === "/api/admin/settings") {
      const data = normalizeData(await loadData(env));
      return json({ settings: data.settings ?? defaultSettings }, { headers: noStore });
    }

    if (req.method === "PUT" && path === "/api/admin/settings") {
      let parsed: z.infer<typeof SettingsPatch>;
      try {
        parsed = SettingsPatch.parse(await req.json());
      } catch (e: unknown) {
        return json({ error: "Invalid request body", details: e instanceof z.ZodError ? e.issues : undefined }, { status: 400, headers: noStore });
      }

      const data = normalizeData(await loadData(env));
      const current = normalizeSettings(data.settings);
      const next = normalizeSettings({
        ...current,
        ...(parsed.siteTitle != null ? { siteTitle: parsed.siteTitle } : null),
        ...(parsed.siteSubtitle != null ? { siteSubtitle: parsed.siteSubtitle } : null),
        ...(parsed.homeTagline != null ? { homeTagline: parsed.homeTagline } : null),
        ...(parsed.siteIconDataUrl != null ? { siteIconDataUrl: parsed.siteIconDataUrl } : null),
        ...(parsed.faviconDataUrl != null ? { faviconDataUrl: parsed.faviconDataUrl } : null),
        ...(parsed.siteIconFit != null ? { siteIconFit: parsed.siteIconFit } : null)
      });

      if (!validateImageRefOrEmpty(next.siteIconDataUrl)) {
        return json({ error: "Invalid request body", details: [{ path: ["siteIconDataUrl"], message: "Icon must be data:image/... or http/https URL" }] }, { status: 400, headers: noStore });
      }
      if (!validateImageRefOrEmpty(next.faviconDataUrl)) {
        return json({ error: "Invalid request body", details: [{ path: ["faviconDataUrl"], message: "Favicon must be data:image/... or http/https URL" }] }, { status: 400, headers: noStore });
      }

      data.settings = next as any;
      await saveData(env, normalizeData(data));
      return json({ ok: true, settings: next }, { headers: noStore });
    }

    // legacy save
    if (req.method === "POST" && path === "/api/admin/save") {
      let body: any;
      try {
        body = await readBodyJson<any>(req);
      } catch (e: unknown) {
        return json({ error: e instanceof Error ? e.message : "Bad Request" }, { status: 400, headers: noStore });
      }
      if (!body || !Array.isArray(body.groups) || !Array.isArray(body.links)) {
        return json({ error: "Invalid data" }, { status: 400, headers: noStore });
      }
      const existing = await loadData(env);
      const merged = normalizeData({
        ...existing,
        ...body,
        settings: body?.settings ?? (existing as any).settings,
        sections: Array.isArray(body.sections) ? body.sections : (existing as any).sections
      });
      await saveData(env, merged);
      return json({ ok: true }, { headers: noStore });
    }
  }

  return json({ error: "Not Found" }, { status: 404, headers: noStore });
}

