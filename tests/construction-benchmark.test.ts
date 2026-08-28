import assert from "node:assert/strict";
import test from "node:test";
import { ServiceOperationsStore } from "../src/construction/service-operations-store";
import {
  ConstructionBenchmarkEngine,
  serviceOperationsBenchmarkRequest,
  serviceOperationsSemanticRequest,
  serviceOperationsTools,
} from "../src/construction/engine";
import type { ConstructionProposalProvider } from "../src/construction/contracts";
import { createScaleGraph, executeDeterministicRange, SCALE_DEPENDENCY_STAGES, SCALE_TOTAL_OPERATIONS, SCALE_WORK_ROUNDS } from "../src/construction/scale-work";

test("cold Service Operations construction assembles and verifies the flagship console without reasoning", async () => {
  const run = await new ConstructionBenchmarkEngine().run({ request: serviceOperationsBenchmarkRequest, concurrency: 10 });

  assert.equal(run.metrics.kind, "LIVE_CONSTRUCTION_BENCHMARK");
  assert.equal(run.metrics.finalResult, "WORKING_APP");
  assert.equal(run.metrics.oAgentCalls, 0);
  assert.equal(run.metrics.oAgentTokens, 0);
  assert.equal(run.metrics.unresolvedOperations, 0);
  assert.ok(run.metrics.deterministicOperations > 0);
  assert.ok(run.metrics.peakParallelOperations > 1);
  assert.ok(run.metrics.dependencyStages > 1);
  assert.ok(run.metrics.schedulerTimeMs >= 0);
  assert.ok(run.metrics.sequentialEquivalentTimeMs >= 0);
  assert.equal(run.artifact?.kind, "SERVICE_OPERATIONS_CONSOLE");
});

test("constructed console exposes the six Service Operations capabilities as data, not executable authority", async () => {
  const run = await new ConstructionBenchmarkEngine().run({ request: serviceOperationsBenchmarkRequest, concurrency: 1 });
  assert.equal(run.artifact?.kind, "SERVICE_OPERATIONS_CONSOLE");
  const artifact = run.artifact!;
  const store = new ServiceOperationsStore(artifact.customers, artifact.auditHistory);

  assert.equal(store.getCustomer("1042")?.name, "Avery Chen");
  assert.equal(store.getAccountStatus("1042"), "ACTIVE");
  assert.ok(store.listAvailableActions("1042").includes("Request service credit"));
  assert.equal(store.getAuditHistory("1042").length, 2);
  assert.deepEqual(artifact.tools.map((tool) => tool.name), serviceOperationsTools.map((tool) => tool.name));
  assert.ok(artifact.tools.filter((tool) => tool.kind === "CONSEQUENCE_REQUEST").every((tool) => tool.requiresCommit));
  assert.ok(artifact.tools.every((tool) => !("execute" in tool)));
});

test("unresolved related composition escalates without an O-Agent provider and no workers run", async () => {
  const run = await new ConstructionBenchmarkEngine().run({ request: serviceOperationsSemanticRequest, concurrency: 25 });

  assert.equal(run.metrics.finalResult, "ESCALATED");
  assert.equal(run.metrics.unresolvedOperations, 1);
  assert.equal(run.metrics.oAgentCalls, 0);
  assert.equal(run.metrics.xNodesUsed, 0);
  assert.equal(run.artifact, undefined);
});

test("a constrained O-Agent proposal re-enters through validation and cannot add arbitrary construction capability", async () => {
  const provider: ConstructionProposalProvider = {
    async propose(operation) {
      return {
        proposal: { operationId: operation.id, primitive: "ComponentComposition", inputs: { domain: "service_operations", layout: "table-first" }, rationale: "Bounded composition proposal" },
        tokensUsed: 17,
      };
    },
  };
  const run = await new ConstructionBenchmarkEngine().run({ request: serviceOperationsSemanticRequest, concurrency: 25, proposalProvider: provider });

  assert.equal(run.metrics.finalResult, "WORKING_APP");
  assert.equal(run.metrics.oAgentCalls, 1);
  assert.equal(run.metrics.oAgentTokens, 17);
  assert.equal(run.metrics.unresolvedOperations, 0);
});

test("an O-Agent proposal cannot expand the approved construction primitive registry", async () => {
  const provider: ConstructionProposalProvider = {
    async propose(operation) {
      return {
        proposal: { operationId: operation.id, primitive: "ShellCommand" as never, inputs: { command: "write arbitrary code" }, rationale: "Must be rejected" },
        tokensUsed: 3,
      };
    },
  };
  const run = await new ConstructionBenchmarkEngine().run({ request: serviceOperationsSemanticRequest, concurrency: 1, proposalProvider: provider });

  assert.equal(run.metrics.finalResult, "REJECTED");
  assert.equal(run.metrics.unauthorizedOperations, 1);
  assert.equal(run.metrics.xNodesUsed, 0);
});

test("ACTIVATED governed composition removes the Service Operations unresolved operation without changing Commit", async () => {
  const run = await new ConstructionBenchmarkEngine().run({ request: serviceOperationsSemanticRequest, concurrency: 50, activeComposition: true });

  assert.equal(run.metrics.finalResult, "WORKING_APP");
  assert.equal(run.metrics.unresolvedOperations, 0);
  assert.equal(run.metrics.oAgentCalls, 0);
  assert.ok(run.trace.some((entry) => entry.startsWith("Commit:")));
});

test("benchmark concurrency is real, bounded, and measured rather than extrapolated", async () => {
  const engine = new ConstructionBenchmarkEngine();
  for (const concurrency of [1, 10, 25, 50, 100] as const) {
    const run = await engine.run({ request: serviceOperationsBenchmarkRequest, concurrency });
    assert.equal(run.metrics.finalResult, "WORKING_APP");
    assert.ok(run.metrics.peakParallelOperations <= concurrency);
    assert.ok(run.metrics.xNodesUsed <= Math.min(concurrency, run.metrics.totalOperations));
    assert.ok(run.metrics.totalTimeToWorkingAppMs >= 0);
    assert.ok(run.metrics.averageActiveOperations <= run.metrics.peakParallelOperations);
  }
});

test("6A.2 deterministic scale graph has real work, 47 stages, and enough width to occupy 100 workers", () => {
  const graph = createScaleGraph();
  assert.equal(graph.length, SCALE_DEPENDENCY_STAGES);
  assert.equal(graph.reduce((total, stage) => total + stage.count, 0), SCALE_TOTAL_OPERATIONS);
  assert.ok(Math.max(...graph.map((stage) => stage.count)) >= 100);
  assert.ok(SCALE_WORK_ROUNDS >= 40_000, "default work must exceed the measured worker-overhead regime");
  const whole = executeDeterministicRange(0, 20);
  const split = executeDeterministicRange(0, 10).checksum ^ executeDeterministicRange(10, 10).checksum;
  assert.equal(whole.completed, 20);
  assert.equal(whole.checksum, split >>> 0);
});
