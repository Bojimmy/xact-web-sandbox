import assert from "node:assert/strict";
import test from "node:test";
import { InventoryStore } from "../src/construction/inventory-store";
import {
  ConstructionBenchmarkEngine,
  inventoryBenchmarkRequest,
  orderBenchmarkRequest,
} from "../src/construction/engine";
import type { ConstructionProposalProvider } from "../src/construction/contracts";

test("cold inventory construction assembles and verifies a functioning dashboard without reasoning", async () => {
  const run = await new ConstructionBenchmarkEngine().run({ request: inventoryBenchmarkRequest, concurrency: 10 });

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
  assert.equal(run.artifact?.kind, "INVENTORY_DASHBOARD");
});

test("constructed inventory store lists, aggregates, creates, adjusts, and filters low stock", async () => {
  const run = await new ConstructionBenchmarkEngine().run({ request: inventoryBenchmarkRequest, concurrency: 1 });
  assert.equal(run.artifact?.kind, "INVENTORY_DASHBOARD");
  const store = new InventoryStore(run.artifact?.products ?? []);
  const initialValue = store.totalInventoryValue();
  store.create({ id: "SKU-04", name: "Signal cord", quantity: 2, unitPrice: 5, reorderPoint: 3 });
  store.adjustQuantity("SKU-01", -10);

  assert.notEqual(store.totalInventoryValue(), initialValue);
  assert.ok(store.list(true).some((product) => product.id === "SKU-01"));
  assert.ok(store.list(true).some((product) => product.id === "SKU-04"));
});

test("unresolved related composition escalates without an O-Agent provider and no workers run", async () => {
  const run = await new ConstructionBenchmarkEngine().run({ request: orderBenchmarkRequest, concurrency: 25 });

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
        proposal: { operationId: operation.id, primitive: "ComponentComposition", inputs: { domain: "order", layout: "table-first" }, rationale: "Bounded composition proposal" },
        tokensUsed: 17,
      };
    },
  };
  const run = await new ConstructionBenchmarkEngine().run({ request: orderBenchmarkRequest, concurrency: 25, proposalProvider: provider });

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
  const run = await new ConstructionBenchmarkEngine().run({ request: orderBenchmarkRequest, concurrency: 1, proposalProvider: provider });

  assert.equal(run.metrics.finalResult, "REJECTED");
  assert.equal(run.metrics.unauthorizedOperations, 1);
  assert.equal(run.metrics.xNodesUsed, 0);
});

test("ACTIVE governed composition removes the related-build unresolved operation without changing Commit", async () => {
  const run = await new ConstructionBenchmarkEngine().run({ request: orderBenchmarkRequest, concurrency: 50, activeComposition: true });

  assert.equal(run.metrics.finalResult, "WORKING_APP");
  assert.equal(run.metrics.unresolvedOperations, 0);
  assert.equal(run.metrics.oAgentCalls, 0);
  assert.ok(run.trace.some((entry) => entry.startsWith("Commit:")));
});

test("benchmark concurrency is real, bounded, and measured rather than extrapolated", async () => {
  const engine = new ConstructionBenchmarkEngine();
  for (const concurrency of [1, 10, 25, 50, 100] as const) {
    const run = await engine.run({ request: inventoryBenchmarkRequest, concurrency });
    assert.equal(run.metrics.finalResult, "WORKING_APP");
    assert.ok(run.metrics.peakParallelOperations <= concurrency);
    assert.ok(run.metrics.xNodesUsed <= Math.min(concurrency, run.metrics.totalOperations));
    assert.ok(run.metrics.totalTimeToWorkingAppMs >= 0);
    assert.ok(run.metrics.averageActiveOperations <= run.metrics.peakParallelOperations);
  }
});
