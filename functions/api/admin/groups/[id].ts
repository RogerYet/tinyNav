import { z } from "zod";
import { json, loadData, normalizeData, requireAuth, saveData } from "../../_utils";

const UpdateGroupBody = z
  .object({
    name: z.string().trim().min(1).max(64).optional(),
    enabled: z.boolean().optional()
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Empty patch" });

export const onRequestPut: PagesFunction = async (ctx) => {
  const env = ctx.env as any;
  const auth = await requireAuth(ctx.request, env);
  if (!auth.ok) return auth.res;

  const id = (ctx.params as any).id as string | undefined;
  if (!id) return json({ error: "Missing group id" }, { status: 400, headers: { "Cache-Control": "no-store" } });

  let parsed: z.infer<typeof UpdateGroupBody>;
  try {
    parsed = UpdateGroupBody.parse(await ctx.request.json());
  } catch (e: unknown) {
    return json(
      { error: "Invalid request body", details: e instanceof z.ZodError ? e.issues : undefined },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const data = await loadData(env);
  const idx = data.groups.findIndex((g) => g.id === id);
  if (idx < 0) return json({ error: "Group not found" }, { status: 404, headers: { "Cache-Control": "no-store" } });

  data.groups[idx] = {
    ...data.groups[idx],
    ...(typeof parsed.name === "string" ? { name: parsed.name } : null),
    ...(typeof parsed.enabled === "boolean" ? { enabled: parsed.enabled } : null)
  } as any;
  const normalized = normalizeData(data);
  await saveData(env, normalized);

  const group = normalized.groups.find((g) => g.id === id)!;
  return json({ ok: true, group }, { headers: { "Cache-Control": "no-store" } });
};

export const onRequestDelete: PagesFunction = async (ctx) => {
  const env = ctx.env as any;
  const auth = await requireAuth(ctx.request, env);
  if (!auth.ok) return auth.res;

  const id = (ctx.params as any).id as string | undefined;
  if (!id) return json({ error: "Missing group id" }, { status: 400, headers: { "Cache-Control": "no-store" } });

  const data = await loadData(env);
  const before = data.groups.length;
  const groups = data.groups.filter((g) => g.id !== id);
  if (groups.length === before) return json({ error: "Group not found" }, { status: 404, headers: { "Cache-Control": "no-store" } });

  const links = data.links.filter((l) => l.groupId !== id);
  const normalized = normalizeData({ groups, links });
  await saveData(env, normalized);
  return json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
};
