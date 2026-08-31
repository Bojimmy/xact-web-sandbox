import assert from "node:assert/strict";
import test from "node:test";
import { invokeOpenAIOAgent, OPENAI_BOSS_MODEL, openAIInputFor } from "../src/server/openai-o-agent";

const request = { unresolved: ["timekeeping policy"], context: { request: "Employees clock in and out" } };

test("OpenAI adapter keeps the key server-side and returns evidence only", async () => {
  let received: RequestInit | undefined;
  const result = await invokeOpenAIOAgent(request, "secret-key", async (_url, init) => {
    received = init;
    return Response.json({ output_text: "A timekeeping capability needs governed employee identity and attendance rules.", usage: { input_tokens: 14, output_tokens: 11 } });
  });
  assert.equal(result.provider, `openai:${OPENAI_BOSS_MODEL}`);
  assert.deepEqual(result.evidence[0].resolves, ["timekeeping policy"]);
  assert.equal(result.inputTokens, 14);
  assert.equal(result.outputTokens, 11);
  assert.equal((received?.headers as Record<string, string>).authorization, "Bearer secret-key");
  assert.deepEqual(JSON.parse(String(received?.body)), { model: OPENAI_BOSS_MODEL, input: openAIInputFor(request) });
  assert.ok(!JSON.stringify(openAIInputFor(request)).includes("secret-key"));
});

test("OpenAI adapter fails closed on an upstream error or empty response", async () => {
  await assert.rejects(() => invokeOpenAIOAgent(request, "secret-key", async () => new Response("unavailable", { status: 503 })), /OpenAI upstream failed/);
  await assert.rejects(() => invokeOpenAIOAgent(request, "secret-key", async () => Response.json({ output_text: "" })), /no usable reasoning content/);
});
