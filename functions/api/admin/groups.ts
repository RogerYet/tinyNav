import { z } from "zod";
import { json, loadData, normalizeData, requireAuth, saveData } from "../_utils";

const CreateGroupBody = z.object({
  name: z.string().trim().min(1).max(64)
});

export const onRequestPost: PagesFunction = async (ctx) => {
  const env = ctx.env as any;
  const auth = await requireAuth(ctx.request, env);
  if (!auth.ok) return auth.res;

  let parsed: z.infer<typeof CreateGroupBody>;
  try {
    parsed = CreateGroupBody.parse(await ctx.request.json());
  } catch (e: unknown) {
    return json(
      { error: "Invalid request body", details: e instanceof z.ZodError ? e.issues : undefined },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const data = await loadData(env);
  const nextOrder = data.groups.length ? Math.max(...data.groups.map((g) => g.order)) + 1 : 0;
  const group = { id: crypto.randomUUID(), name: parsed.name, order: nextOrder, enabled: true };
  data.groups.push(group);
  await saveData(env, normalizeData(data));
  return json({ ok: true, group }, { headers: { "Cache-Control": "no-store" } });
};
