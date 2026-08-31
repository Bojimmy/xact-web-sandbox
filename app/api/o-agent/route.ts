import type { ReasoningRequest } from "../../../src/telemetry/o-agent-provider";
import { env } from "cloudflare:workers";
import { JudgeLiveReasoningBudgetStore } from "../../../src/server/judge-live-reasoning-budget";
import { LiveReasoningAllowanceExhaustedError, MissingJudgeIdentityError, invokeWithLiveReasoningAllowance } from "../../../src/server/live-reasoning-quota-gate";
import { invokeOpenAIOAgent } from "../../../src/server/openai-o-agent";

const MAX_UNRESOLVED_FIELDS = 50;
const MAX_CONTEXT_BYTES = 8_000;

function response(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

function responseWithRemaining(body: unknown, remaining: number, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store", "x-oagent-remaining": String(remaining) },
  });
}

function budgetStore(): JudgeLiveReasoningBudgetStore {
  const db = (env as unknown as { DB?: D1Database }).DB;
  if (!db) throw new Error("Live reasoning budget storage is unavailable.");
  return new JudgeLiveReasoningBudgetStore(db);
}

function isReasoningRequest(value: unknown): value is ReasoningRequest {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ReasoningRequest>;
  if (!Array.isArray(candidate.unresolved) || candidate.unresolved.length > MAX_UNRESOLVED_FIELDS || candidate.unresolved.some((field) => typeof field !== "string" || field.length > 200)) return false;
  try { return JSON.stringify(candidate.context ?? {}).length <= MAX_CONTEXT_BYTES; }
  catch { return false; }
}

/**
 * Server-only transport boundary. OPENAI_API_KEY remains in the Sites runtime
 * environment and is never bundled into the browser. Model output is evidence
 * only and must re-enter Xact before any consequence can be authorized.
 */
export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try { body = await request.json(); }
  catch { return response({ error: "Structured reasoning request required." }, 400); }
  if (!isReasoningRequest(body)) return response({ error: "Reasoning request exceeds the public boundary." }, 400);

  const runtime = env as unknown as { OPENAI_API_KEY?: string };
  const openAIApiKey = runtime.OPENAI_API_KEY ?? process.env.OPENAI_API_KEY;
  if (!openAIApiKey) return response({ error: "Live Boss reasoning is not configured." }, 503);

  try {
    const result = await invokeWithLiveReasoningAllowance(
      request.headers.get("oai-authenticated-user-id"),
      budgetStore(),
      async () => {
        if (openAIApiKey) {
          const result = await invokeOpenAIOAgent(body, openAIApiKey);
          return { kind: "LIVE_SANDBOX_MEASUREMENT", provider: result.provider, result };
        }
        throw new Error("Live Boss reasoning is not configured.");
      },
    );
    return responseWithRemaining(result.value, result.remaining);
  } catch (cause) {
    if (cause instanceof MissingJudgeIdentityError) return response({ error: cause.message }, 401);
    if (cause instanceof LiveReasoningAllowanceExhaustedError) return response({ error: cause.message }, 429);
    if (cause instanceof Error && cause.message === "Live reasoning budget storage is unavailable.") return response({ error: cause.message }, 503);
    return response({ error: "Live O-Agent gateway is unavailable." }, 502);
  }
}
