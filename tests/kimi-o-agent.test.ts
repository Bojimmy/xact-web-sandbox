import assert from "node:assert/strict";
import test from "node:test";
import { invokeKimiOAgent, kimiMessagesFor } from "../src/server/kimi-o-agent";

const request = { unresolved: ["timekeeping policy"], context: { request: "Employees clock in and out" } };

test("Kimi adapter keeps the key server-side and returns evidence only", async () => {
  let received: RequestInit | undefined;
  const result = await invokeKimiOAgent(request, "secret-key", async (_url, init) => {
    received = init;
    return Response.json({ choices: [{ message: { content: "A timekeeping capability needs governed employee identity and attendance rules." } }], usage: { prompt_tokens: 14, completion_tokens: 11 } });
  });
  assert.equal(result.provider, "kimi");
  assert.deepEqual(result.evidence[0].resolves, ["timekeeping policy"]);
  assert.equal(result.inputTokens, 14);
  assert.equal(result.outputTokens, 11);
  assert.equal((received?.headers as Record<string, string>).authorization, "Bearer secret-key");
  assert.deepEqual(JSON.parse(String(received?.body)), {
    model: "kimi-k3",
    messages: kimiMessagesFor(request),
    stream: false,
    temperature: 1,
    max_tokens: 1024,
  });
  assert.ok(!JSON.stringify(kimiMessagesFor(request)).includes("secret-key"));
});

test("Kimi adapter fails closed on an upstream error or empty content", async () => {
  await assert.rejects(() => invokeKimiOAgent(request, "secret-key", async () => new Response("unavailable", { status: 503 })), /Kimi upstream failed/);
  await assert.rejects(() => invokeKimiOAgent(request, "secret-key", async () => Response.json({ choices: [{ message: { content: "" } }] })), /no usable reasoning content/);
});
