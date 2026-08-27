import type { ReasoningRequest } from "../../../src/telemetry/o-agent-provider";

const MAX_UNRESOLVED_FIELDS = 50;
const MAX_CONTEXT_BYTES = 8_000;

function response(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
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
    const upstream = await fetch(gatewayUrl, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${gatewayToken}` },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (!upstream.ok) return response({ error: "Live O-Agent gateway failed closed." }, 502);
    const payload = await upstream.json();
    return response(payload);
  } catch {
    return response({ error: "Live O-Agent gateway is unavailable." }, 502);
  }
}
