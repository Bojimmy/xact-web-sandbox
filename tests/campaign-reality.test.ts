import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateAbsorptionGates,
  measureReasoningEvolution,
} from "../src/flagship/campaign-reality";
import { SecureEndpointOAgentProvider } from "../src/telemetry/o-agent-provider";
import type { FlagshipReasoningEvent } from "../src/flagship/learning-run";

function liveProvider(): SecureEndpointOAgentProvider {
  return new SecureEndpointOAgentProvider(
    "/api/o-agent",
    async () => new Response(JSON.stringify({
      kind: "LIVE_SANDBOX_MEASUREMENT",
      provider: "ollama",
      result: {
        evidence: [{ claim: "Governed evidence", resolves: ["semantic-field"] }],
        inputTokens: 3,
        outputTokens: 2,
        latencyMs: 1,
      },
    }), { status: 200 }),
  );
}

test("SUBMIT drives the four real gates to APPROVED → ACTIVATED", () => {
  const gates = evaluateAbsorptionGates(true);

  assert.equal(gates.door.admissible, true);
  assert.equal(gates.ledger.valid, true);
  assert.equal(gates.effective, true);
  assert.equal(gates.governance, true);
  assert.equal(gates.activated, true);

  assert.equal(gates.evidence.measurement.verdict, "EFFECTIVE");
  assert.equal(gates.candidate.id, "candidate:service-recovery-rationale");
});

test("DECLINE leaves the gates admissible/valid/effective but never activates", () => {
  const gates = evaluateAbsorptionGates(false);

  assert.equal(gates.door.admissible, true);
  assert.equal(gates.ledger.valid, true);
  assert.equal(gates.effective, true);
  assert.equal(gates.governance, false);
  assert.equal(gates.activated, false);
});

test("ACTIVATED is resolution-only and does not grant commit authority", () => {
  const gates = evaluateAbsorptionGates(true);
  assert.equal(gates.activated, true);

  assert.equal("execute" in gates.candidate, false);
  assert.equal("artifact" in gates.candidate, false);
});

test("the reasoning evolution is the real run: 30 → 4, −86.7%, four live calls, no simulation", async () => {
  const streamed: FlagshipReasoningEvent[] = [];
  const evolution = await measureReasoningEvolution(liveProvider(), true, (event) => streamed.push(event));

  assert.equal(evolution.before, 30);
  assert.equal(evolution.after, 4);
  assert.equal(evolution.executedConstructionOperations, 10_011);
  assert.equal(evolution.deterministicallyResolvedOperations, 10_007);
  assert.equal(evolution.checksumIdentical, true);
  assert.equal(evolution.deltaPercent, -86.7);
  assert.ok(evolution.note.includes("didn't get faster"));

  // Live telemetry, attested by the real provider boundary — never simulated.
  assert.equal(evolution.provenance, "LIVE_O_AGENT_MEASUREMENT");
  assert.notEqual(evolution.provenance, "SIMULATED_O_AGENT");
  assert.equal(evolution.provider, "ollama");
  assert.equal(evolution.reasoningEvents.length, 4);
  assert.equal(streamed.length, 4); // onReasoning fired once per call
  assert.ok(evolution.totalTokens > 0);
  assert.ok(evolution.wallTimeMs >= 0);
  assert.ok(evolution.reasoningEvents.every((event) => event.provenance === "LIVE_O_AGENT_MEASUREMENT"));
});

test("a declined absorption runs no live proof: reasoning unchanged, no simulation", async () => {
  const evolution = await measureReasoningEvolution(liveProvider(), false);

  assert.equal(evolution.before, 30);
  assert.equal(evolution.after, 30);
  assert.equal(evolution.deltaPercent, 0);
  assert.equal(evolution.checksumIdentical, true);
  assert.equal(evolution.provenance, "NOT_MEASURED");
  assert.equal(evolution.provider, "not-run");
  assert.equal(evolution.reasoningEvents.length, 0);
  assert.equal(evolution.totalTokens, 0);
});

test("fail closed: an unavailable provider throws and never substitutes a simulation", async () => {
  const unavailable = new SecureEndpointOAgentProvider(
    "/api/o-agent",
    async () => new Response("unavailable", { status: 503 }),
  );

  await assert.rejects(() => measureReasoningEvolution(unavailable), /unavailable/);
});
