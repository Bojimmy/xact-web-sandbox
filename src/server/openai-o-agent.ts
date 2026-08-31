import type { ReasoningRequest, ReasoningResult } from "../telemetry/o-agent-provider";

export const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
export const OPENAI_BOSS_MODEL = "gpt-5-mini";

export function openAIInputFor(request: ReasoningRequest) {
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
  const value = payload as { output_text?: unknown; output?: Array<{ content?: Array<{ type?: unknown; text?: unknown }> }> };
  if (typeof value.output_text === "string" && value.output_text.trim()) return value.output_text.trim();
  const text = value.output
    ?.flatMap((item) => item.content ?? [])
    .filter((item) => item.type === "output_text" && typeof item.text === "string")
    .map((item) => String(item.text).trim())
    .filter(Boolean)
    .join(" ");
  if (text) return text;
  throw new Error("OpenAI returned no usable reasoning content.");
}

/** Server-side OpenAI transport. Callers receive evidence only, never authority. */
export async function invokeOpenAIOAgent(
  request: ReasoningRequest,
  apiKey: string,
  fetcher: typeof fetch = fetch,
): Promise<ReasoningResult> {
  const started = performance.now();
  const upstream = await fetcher(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: OPENAI_BOSS_MODEL, input: openAIInputFor(request) }),
  });
  if (!upstream.ok) throw new Error(`OpenAI upstream failed (${upstream.status}).`);
  const payload = await upstream.json() as { usage?: { input_tokens?: unknown; output_tokens?: unknown } };
  const inputTokens = typeof payload.usage?.input_tokens === "number" ? payload.usage.input_tokens : 0;
  const outputTokens = typeof payload.usage?.output_tokens === "number" ? payload.usage.output_tokens : 0;
  return {
    provider: `openai:${OPENAI_BOSS_MODEL}`,
    evidence: [{ claim: contentFrom(payload), resolves: request.unresolved }],
    inputTokens,
    outputTokens,
    latencyMs: Math.max(0, performance.now() - started),
  };
}
