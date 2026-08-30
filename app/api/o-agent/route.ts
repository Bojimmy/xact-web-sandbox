import type { ReasoningRequest } from "../../../src/telemetry/o-agent-provider";
import { env } from "cloudflare:workers";
import { JudgeLiveReasoningBudgetStore } from "../../../src/server/judge-live-reasoning-budget";
import { LiveReasoningAllowanceExhaustedError, MissingJudgeIdentityError, invokeWithLiveReasoningAllowance } from "../../../src/server/live-reasoning-quota-gate";

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
 * Server-only transport boundary. Configure a protected model gateway with
 * OAGENT_PROVIDER_URL and OAGENT_PROVIDER_TOKEN; neither value is bundled into
 * the browser. The gateway must return the structured `{ kind, result }`
 * contract consumed by SecureEndpointOAgentProvider.
 */
export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try { body = await request.json(); }
  catch { return response({ error: "Structured reasoning request required." }, 400); }
  if (!isReasoningRequest(body)) return response({ error: "Reasoning request exceeds the public boundary." }, 400);

  const gatewayUrl = process.env.OAGENT_PROVIDER_URL;
  const gatewayToken = process.env.OAGENT_PROVIDER_TOKEN;
  if (!gatewayUrl || !gatewayToken) return response({ error: "Live O-Agent is not configured; use the labeled simulation fallback." }, 503);

  try {
    const result = await invokeWithLiveReasoningAllowance(
      request.headers.get("oai-authenticated-user-id"),
      budgetStore(),
      async () => {
        const upstream = await fetch(gatewayUrl, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${gatewayToken}` },
          body: JSON.stringify(body),
          cache: "no-store",
        });
        if (!upstream.ok) throw new Error("Live O-Agent gateway failed closed.");
        return upstream.json();
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
