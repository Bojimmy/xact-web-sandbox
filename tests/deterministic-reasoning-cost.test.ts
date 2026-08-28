import assert from "node:assert/strict";
import test from "node:test";
import {
  COST_HYBRID_UNRESOLVED_CALLS,
  COST_NAIVE_STAGE_CALLS,
  COST_PROMOTED_HYBRID_CALLS,
  COST_VARIANCE_RUNS,
  DeterministicReasoningCostRunner,
  type DeterministicWorkloadProvider,
} from "../src/telemetry/deterministic-reasoning-cost";
import {
  SecureEndpointOAgentProvider,
  SimulatedOAgentProvider,
  type OAgentProvider,
  type ReasoningRequest,
  type ReasoningResult,
} from "../src/telemetry/o-agent-provider";

const workload: DeterministicWorkloadProvider = {
  async run() { return { operations: 10_011, schedulerTimeMs: 4, throughputOpsPerSec: 2_502.75, checksum: 3_125_889_056 }; },
};

class LiveFixtureProvider implements OAgentProvider {
  readonly telemetryKind = "LIVE_SANDBOX_MEASUREMENT" as const;
  readonly providerName = "Live fixture provider";
  async reason(request: ReasoningRequest): Promise<ReasoningResult> {
    return { provider: this.providerName, evidence: request.unresolved.map((field) => ({ claim: `Evidence for ${field}`, resolves: [field] })), inputTokens: 5, outputTokens: 3, latencyMs: 2 };
  }
}

test("cost modes preserve the same checksum while changing only reasoning fan-out", async () => {
  const runner = new DeterministicReasoningCostRunner(workload, new LiveFixtureProvider());
  const naive = await runner.run({ mode: "NAIVE_REASONING", estimatedPricePer1kTokensUsd: 0.002 });
  const hybrid = await runner.run({ mode: "XACT_HYBRID", estimatedPricePer1kTokensUsd: 0.002 });

  assert.equal(naive.checksum, hybrid.checksum);
  assert.equal(naive.reasoning.calls, COST_NAIVE_STAGE_CALLS);
  assert.equal(hybrid.reasoning.calls, COST_HYBRID_UNRESOLVED_CALLS);
  assert.equal(naive.deterministic.inferenceTokens, 0);
  assert.equal(hybrid.deterministic.inferenceCalls, 0);
  assert.equal(naive.reasoning.kind, "LIVE_SANDBOX_MEASUREMENT");
  assert.equal(naive.estimatedCostUsd?.kind, "ESTIMATED_COST");
  assert.equal(naive.estimatedCostUsd?.pricePer1kTokensUsd, 0.002);
});

test("offline simulated O-Agent output is explicitly labeled and shares the provider result shape", async () => {
  const provider = new SimulatedOAgentProvider();
  const result = await provider.reason({ context: {}, unresolved: ["construction:semantic-1"] });
  const run = await new DeterministicReasoningCostRunner(workload, provider).run({ mode: "XACT_HYBRID" });

  assert.equal(provider.telemetryKind, "SIMULATED_O_AGENT");
  assert.equal(result.evidence[0]?.resolves[0], "construction:semantic-1");
  assert.equal(run.reasoning.kind, "SIMULATED_O_AGENT");
  assert.equal(run.deterministic.kind, "LIVE_SANDBOX_MEASUREMENT");
});

test("secure endpoint provider accepts only an attested live structured result and exposes no credential", async () => {
  const provider = new SecureEndpointOAgentProvider("/api/o-agent", async () => new Response(JSON.stringify({
    kind: "LIVE_SANDBOX_MEASUREMENT",
    provider: "kimi",
    result: { evidence: [{ claim: "Bounded evidence", resolves: ["field"] }], inputTokens: 4, outputTokens: 2, latencyMs: 1 },
  }), { status: 200 }));

  const result = await provider.reason({ context: {}, unresolved: ["field"] });
  assert.equal(provider.telemetryKind, "LIVE_SANDBOX_MEASUREMENT");
  assert.equal(result.outputTokens, 2);
  assert.deepEqual(result.evidence[0]?.resolves, ["field"]);
});

test("secure endpoint provider refuses to relabel simulated reasoning as live", async () => {
  const provider = new SecureEndpointOAgentProvider("/api/o-agent", async () => new Response(JSON.stringify({
    kind: "SIMULATED_O_AGENT",
    provider: "ollama",
    result: { evidence: [], inputTokens: 0, outputTokens: 0, latencyMs: 0 },
  }), { status: 200 }));

  await assert.rejects(() => provider.reason({ context: {}, unresolved: ["field"] }), /did not attest a live measurement/);
});

test("variance protocol is serial, reports variance, and learning promotion reduces hybrid reasoning", async () => {
  const runner = new DeterministicReasoningCostRunner(workload, new LiveFixtureProvider());
  const before = await runner.runVariance({ mode: "XACT_HYBRID" }, COST_VARIANCE_RUNS);
  const after = await runner.runVariance({ mode: "XACT_HYBRID", promoted: true }, COST_VARIANCE_RUNS);

  assert.equal(before.samples.length, COST_VARIANCE_RUNS);
  assert.equal(before.samples[0]?.reasoning.calls, COST_HYBRID_UNRESOLVED_CALLS);
  assert.equal(after.samples[0]?.reasoning.calls, COST_PROMOTED_HYBRID_CALLS);
  assert.ok(after.samples[0]!.reasoning.totalTokens < before.samples[0]!.reasoning.totalTokens);
  assert.ok(before.stddev.deterministicSchedulerTimeMs >= 0);
  assert.ok(before.stddev.reasoningWallTimeMs >= 0);
  await assert.rejects(() => runner.runVariance({ mode: "XACT_HYBRID" }, COST_VARIANCE_RUNS - 1));
});
