import assert from "node:assert/strict";
import test from "node:test";
import { FlagshipLearningRunner } from "../src/flagship/learning-run";
import { SimulatedOAgentProvider } from "../src/telemetry/o-agent-provider";

test("flagship cold and ACTIVATED rebuild execute equal work with 30 to 4 evidence calls", async () => {
  const runner = new FlagshipLearningRunner(new SimulatedOAgentProvider());
  const cold = await runner.run(false);
  const rebuild = await runner.run(true);

  assert.equal(cold.executedConstructionOperations, 10_011);
  assert.equal(rebuild.executedConstructionOperations, 10_011);
  assert.equal(cold.reasoningOperations, 30);
  assert.equal(rebuild.reasoningOperations, 4);
  assert.equal(cold.deterministicallyResolvedOperations, 9_981);
  assert.equal(rebuild.deterministicallyResolvedOperations, 10_007);
  assert.equal(cold.checksum, rebuild.checksum);
  assert.equal(cold.provenance, "SIMULATED_O_AGENT");
  assert.equal(cold.trace.length, 30);
  assert.equal(rebuild.trace.length, 4);
  assert.ok(cold.trace.every((event) => event.provider === "Public-safe simulated O-Agent"));
});
