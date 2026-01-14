import type { ExecutionContext, WorkerEnv } from "./server/cf";
import { handleApi } from "./server/routes";
import { CloudNavDB } from "./server/storage";

export { CloudNavDB };

function acceptsHtml(req: Request) {
  const accept = req.headers.get("Accept") || "";
  return accept.includes("text/html");
}

export default {
  async fetch(request: Request, env: WorkerEnv, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      return await handleApi(request, env);
    }

    const res = await env.ASSETS.fetch(request);
    if (res.status !== 404) return res;

    if (!acceptsHtml(request)) return res;
    const indexReq = new Request(new URL("/index.html", url.origin), request);
    return await env.ASSETS.fetch(indexReq);
  }
};
