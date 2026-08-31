import type { ReasoningRequest, ReasoningResult } from "../telemetry/o-agent-provider";

export const KIMI_CHAT_COMPLETIONS_URL = "https://api.moonshot.ai/v1/chat/completions";

export function kimiMessagesFor(request: ReasoningRequest) {
  return [
    {
      role: "system",
      content: "You are the Xact Boss, a governed O-Agent. Resolve genuine semantic uncertainty and return concise evidence. You never authorize a consequence; your output is evidence for a later Xact re-entry.",
    },
    {
      role: "user",
      content: `Resolve these unresolved fields with one concise evidence claim each.\nUnresolved fields: ${request.unresolved.join(", ")}\nContext: ${JSON.stringify(request.context ?? {})}`,
    },
  ] as const;
}

function contentFrom(payload: unknown): string {
  const value = payload as { choices?: Array<{ message?: { content?: unknown } }> };
  const content = value.choices?.[0]?.message?.content;
  if (typeof content === "string" && content.trim()) return content.trim();
  if (Array.isArray(content)) {
    const text = content.map((part) => typeof part === "object" && part ? String((part as { text?: unknown }).text ?? "") : "").join(" ").trim();
    if (text) return text;
  }
  throw new Error("Kimi returned no usable reasoning content.");
}

/**
 * Server-side Kimi transport. The API key remains at the hosting boundary;
 * callers receive only evidence in the established OAgentProvider shape.
 */
export async function invokeKimiOAgent(
  request: ReasoningRequest,
  apiKey: string,
  fetcher: typeof fetch = fetch,
): Promise<ReasoningResult> {
  const started = performance.now();
  const upstream = await fetcher(KIMI_CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: "kimi-k3", messages: kimiMessagesFor(request), stream: false }),
  });
  if (!upstream.ok) throw new Error(`Kimi upstream failed (${upstream.status}).`);
  const payload = await upstream.json() as { usage?: { prompt_tokens?: unknown; completion_tokens?: unknown } };
  const inputTokens = typeof payload.usage?.prompt_tokens === "number" ? payload.usage.prompt_tokens : 0;
  const outputTokens = typeof payload.usage?.completion_tokens === "number" ? payload.usage.completion_tokens : 0;
  return {
    provider: "kimi",
    evidence: [{ claim: contentFrom(payload), resolves: request.unresolved }],
    inputTokens,
    outputTokens,
    latencyMs: Math.max(0, performance.now() - started),
  };
}
