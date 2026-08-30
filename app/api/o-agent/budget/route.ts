import { env } from "cloudflare:workers";
import { JudgeLiveReasoningBudgetStore } from "../../../../src/server/judge-live-reasoning-budget";

function response(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

export async function GET(request: Request): Promise<Response> {
  const userId = request.headers.get("oai-authenticated-user-id");
  if (!userId) return response({ error: "Sign in is required to view live Boss reasoning allowance." }, 401);
  const db = (env as unknown as { DB?: D1Database }).DB;
  if (!db) return response({ error: "Live reasoning budget storage is unavailable." }, 503);
  try {
    return response(await new JudgeLiveReasoningBudgetStore(db).read(userId));
  } catch {
    return response({ error: "Live reasoning budget storage is unavailable." }, 503);
  }
}
