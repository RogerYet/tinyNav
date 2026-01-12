import { z } from "zod";
import { json, loadData, normalizeData, requireAuth, saveData } from "../_utils";

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

const CreateLinkBody = z.object({
  groupId: z.string().min(1),
  title: z.string().trim().min(1).max(80),
  url: HttpUrl,
  description: z.string().trim().max(200).optional(),
  icon: IconUrl
});

export const onRequestPost: PagesFunction = async (ctx) => {
  const env = ctx.env as any;
  const auth = await requireAuth(ctx.request, env);
  if (!auth.ok) return auth.res;

  let parsed: z.infer<typeof CreateLinkBody>;
  try {
    parsed = CreateLinkBody.parse(await ctx.request.json());
  } catch (e: unknown) {
    return json(
      { error: "Invalid request body", details: e instanceof z.ZodError ? e.issues : undefined },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const data = await loadData(env);
  const group = data.groups.find((g) => g.id === parsed.groupId);
  if (!group) return json({ error: "Group not found" }, { status: 404, headers: { "Cache-Control": "no-store" } });

  const inGroup = data.links.filter((l) => l.groupId === parsed.groupId);
  const nextOrder = inGroup.length ? Math.max(...inGroup.map((l) => l.order)) + 1 : 0;
  const icon = parsed.icon && parsed.icon.trim() ? parsed.icon.trim() : normalizeFaviconUrl(parsed.url, USE_FAVICON_SERVICE(env.USE_FAVICON_SERVICE));
  const link = {
    id: crypto.randomUUID(),
    groupId: parsed.groupId,
    title: parsed.title,
    url: parsed.url,
    icon,
    description: parsed.description || undefined,
    order: nextOrder
  };

  data.links.push(link);
  const normalized = normalizeData(data);
  await saveData(env, normalized);

  const savedLink = normalized.links.find((l) => l.id === link.id)!;
  return json({ ok: true, link: savedLink }, { headers: { "Cache-Control": "no-store" } });
};
