import assert from "node:assert/strict";
import test from "node:test";
import { XactAgentLiaison } from "../src/flagship/xact-agent-liaison";
import { XactFoundryLiaison } from "../src/flagship/foundry-liaison";
import { SecureEndpointOAgentProvider } from "../src/telemetry/o-agent-provider";

function liveProvider(): SecureEndpointOAgentProvider {
  return new SecureEndpointOAgentProvider(
    "/api/o-agent",
    async () => new Response(JSON.stringify({
      kind: "LIVE_SANDBOX_MEASUREMENT",
      provider: "ollama",
      result: {
        evidence: [{ claim: "Eligibility evidence", resolves: ["credit eligibility"] }],
        inputTokens: 3,
        outputTokens: 2,
        latencyMs: 1,
      },
    }), { status: 200 }),
  );
}

function agent(): XactAgentLiaison {
  return new XactAgentLiaison(new XactFoundryLiaison(liveProvider()));
}

test("a complete request flows understand → propose → build without clarification", async () => {
  const turns = await agent().converse("Build me a WebMCP tool that lets support agents issue a service credit up to $25");

  assert.deepEqual(turns.map((t) => t.kind), ["UNDERSTAND", "PROPOSE", "BUILD_RESULT"]);
  assert.ok(turns[0].text.includes("2 need(s) interpretation"));
  assert.ok(turns[0].text.includes("credit eligibility"));
  assert.equal(turns[2].result?.outcome, "COMPOSED_DEFINITION");
});

test("a request missing both amount and actor asks for both bounds", async () => {
  const turns = await agent().converse("Build a tool that issues a service credit");

  assert.deepEqual(turns.map((t) => t.kind), ["UNDERSTAND", "CLARIFY"]);
  assert.equal(turns[1].questions?.length, 2);
  assert.ok(turns[1].questions?.some((q) => q.includes("maximum amount")));
  assert.ok(turns[1].questions?.some((q) => q.includes("actor role")));
});

test("a request with an amount but no actor asks only for the actor", async () => {
  const turns = await agent().converse("Build a tool that issues a service credit up to $40");

  assert.deepEqual(turns.map((t) => t.kind), ["UNDERSTAND", "CLARIFY"]);
  assert.equal(turns[1].questions?.length, 1);
  assert.ok(turns[1].questions?.[0].includes("actor role"));
});

test("a request with an actor but no amount asks only for the amount", async () => {
  const turns = await agent().converse("Build a tool that lets support agents issue a service credit");

  assert.deepEqual(turns.map((t) => t.kind), ["UNDERSTAND", "CLARIFY"]);
  assert.equal(turns[1].questions?.length, 1);
  assert.ok(turns[1].questions?.[0].includes("maximum amount"));
});

test("a forbidden delete is understood but refused", async () => {
  const turns = await agent().converse("Build a WebMCP tool that lets any agent delete any customer");

  assert.deepEqual(turns.map((t) => t.kind), ["UNDERSTAND", "REFUSED"]);
  assert.ok(turns[1].text.includes("knowing how is not authority to act"));
});

test("an unfamiliar request is reasoned about, not rejected", async () => {
  const turns = await agent().converse("Keep me updated on user stats and requests");

  assert.deepEqual(turns.map((t) => t.kind), ["UNDERSTAND", "PENDING_GOVERNANCE"]);
  assert.ok(turns[0].text.includes("reason"));
  assert.ok(turns[1].text.includes("governance"));
  assert.equal(turns[1].result?.outcome, "PENDING_GOVERNANCE");
});
