import { z } from "zod";
import { json, loadData, normalizeData, requireAuth, saveData } from "../../_utils";

const USE_FAVICON_SERVICE = (s: unknown) => String(s ?? "").toLowerCase() === "true";

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

function normalizeFaviconUrl(siteUrl: string, useService: boolean) {
  const normalized = normalizeHttpUrl(siteUrl);
  const u = new URL(normalized);
  if (useService) {
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(u.hostname)}&sz=64`;
  }
  return `${u.origin}/favicon.ico`;
}

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

const UpdateLinkBody = z
  .object({
    groupId: z.string().min(1).optional(),
    title: z.string().trim().min(1).max(80).optional(),
    url: HttpUrl.optional(),
    description: z.string().trim().max(200).optional(),
    icon: IconUrl
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Empty patch" });

export const onRequestPut: PagesFunction = async (ctx) => {
  const env = ctx.env as any;
  const auth = await requireAuth(ctx.request, env);
  if (!auth.ok) return auth.res;

  const id = (ctx.params as any).id as string | undefined;
  if (!id) return json({ error: "Missing link id" }, { status: 400, headers: { "Cache-Control": "no-store" } });

  let parsed: z.infer<typeof UpdateLinkBody>;
  try {
    parsed = UpdateLinkBody.parse(await ctx.request.json());
  } catch (e: unknown) {
    return json(
      { error: "Invalid request body", details: e instanceof z.ZodError ? e.issues : undefined },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const data = await loadData(env);
  const idx = data.links.findIndex((l) => l.id === id);
  if (idx < 0) return json({ error: "Link not found" }, { status: 404, headers: { "Cache-Control": "no-store" } });

  const current = data.links[idx]!;
  const nextGroupId = parsed.groupId ?? current.groupId;
  if (!data.groups.some((g) => g.id === nextGroupId)) {
    return json({ error: "Group not found" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }

  const nextUrl = parsed.url ?? current.url;
  const iconFromBody = typeof parsed.icon === "string" ? parsed.icon : undefined;
  const icon =
    iconFromBody === undefined
      ? current.icon
      : iconFromBody.trim()
        ? iconFromBody.trim()
        : normalizeFaviconUrl(nextUrl, USE_FAVICON_SERVICE(env.USE_FAVICON_SERVICE));

  const updated = {
    ...current,
    ...parsed,
    groupId: nextGroupId,
    url: nextUrl,
    icon,
    description: parsed.description === "" ? undefined : parsed.description ?? current.description,
  };

  data.links[idx] = updated;
  const normalized = normalizeData(data);
  await saveData(env, normalized);

  const link = normalized.links.find((l) => l.id === id)!;
  return json({ ok: true, link }, { headers: { "Cache-Control": "no-store" } });
};

export const onRequestDelete: PagesFunction = async (ctx) => {
  const env = ctx.env as any;
  const auth = await requireAuth(ctx.request, env);
  if (!auth.ok) return auth.res;

  const id = (ctx.params as any).id as string | undefined;
  if (!id) return json({ error: "Missing link id" }, { status: 400, headers: { "Cache-Control": "no-store" } });

  const data = await loadData(env);
  const before = data.links.length;
  const links = data.links.filter((l) => l.id !== id);
  if (links.length === before) return json({ error: "Link not found" }, { status: 404, headers: { "Cache-Control": "no-store" } });

  const normalized = normalizeData({ groups: data.groups, links });
  await saveData(env, normalized);
  return json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
};
