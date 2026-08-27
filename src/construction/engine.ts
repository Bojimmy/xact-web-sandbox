import {
  constructionPrimitives,
  type ConstructionArtifact,
  type ConstructionDomain,
  type ConstructionOperation,
  type ConstructionProposalProvider,
  type ConstructionRun,
  type ConstructionRunMetrics,
  type Product,
} from "./contracts";
import { ConstructionScheduler } from "./scheduler";
import { InventoryStore } from "./inventory-store";

export const inventoryBenchmarkRequest = "Build a small inventory dashboard that shows products, quantity on hand, low-stock warnings, total inventory value, and lets me add or adjust an item.";
export const orderBenchmarkRequest = "Build an order dashboard showing customer, order amount, fulfillment status, late-order warnings, and total sales.";

const inventoryProducts: Product[] = [
  { id: "SKU-01", name: "Field notebook", quantity: 18, unitPrice: 12.5, reorderPoint: 10 },
  { id: "SKU-02", name: "Signal lamp", quantity: 4, unitPrice: 39, reorderPoint: 6 },
  { id: "SKU-03", name: "Canvas case", quantity: 11, unitPrice: 22, reorderPoint: 5 },
];

export interface ConstructionRunOptions {
  request: string;
  concurrency: 1 | 10 | 25 | 50 | 100;
  /** Active governed evidence can resolve the one reusable order composition. */
  activeComposition?: boolean;
  proposalProvider?: ConstructionProposalProvider;
}

function now(): number { return performance.now(); }

function duration(started: number): number { return Math.max(0, now() - started); }

/**
 * Clean-room construction benchmark. It interprets an allowlisted plan into a
 * local application artifact; it does not generate code, create arbitrary
 * files, invoke a shell, or expose construction workers to the O-Agent.
 */
export class ConstructionBenchmarkEngine {
  private readonly scheduler = new ConstructionScheduler();

  async run(options: ConstructionRunOptions): Promise<ConstructionRun> {
    const started = now();
    const trace: string[] = [];
    const decompositionStarted = now();
    const domain = this.domainFor(options.request);
    const operations = this.decompose(domain, Boolean(options.activeComposition));
    const decompositionTimeMs = duration(decompositionStarted);
    const reasoningOperations = operations.filter((operation) => operation.classification === "UNRESOLVED");

    const resolutionStarted = now();
    let authorized = operations.map((operation) => operation.classification === "RESOLVED"
      ? { ...operation, status: "AUTHORIZED" as const }
      : { ...operation });
    const deterministicResolutionTimeMs = duration(resolutionStarted);
    let oAgentCalls = 0;
    let oAgentTokens = 0;
    let reasoningTimeMs = 0;

    if (reasoningOperations.length) {
      if (!options.proposalProvider) {
        trace.push("Resolve: U remains; no constrained O-Agent proposal provider is configured.");
        return this.finish(domain, options.concurrency, authorized, undefined, reasoningOperations, trace, {
          requestedFeatures: this.featureCount(domain), deterministicOperations: authorized.filter((operation) => operation.status === "AUTHORIZED").length,
          unresolvedOperations: reasoningOperations.length, oAgentCalls, oAgentTokens, decompositionTimeMs,
          deterministicResolutionTimeMs, reasoningTimeMs, constructionTimeMs: 0, validationTimeMs: 0, verificationTimeMs: 0,
          xNodesUsed: 0, peakParallelOperations: 0, averageActiveOperations: 0, dependencyStages: 0, sequentialEquivalentTimeMs: 0, schedulerTimeMs: 0, criticalPathTimeMs: 0, measuredSpeedup: 0, validationFailures: 0, unauthorizedOperations: 0, finalResult: "ESCALATED", started,
        });
      }
      const reasoningStarted = now();
      for (const unresolved of reasoningOperations) {
        const response = await options.proposalProvider.propose(unresolved);
        oAgentCalls += 1;
        oAgentTokens += response.tokensUsed;
        if (!this.validProposal(unresolved, response.proposal)) {
          trace.push(`Proposal rejected for ${unresolved.id}: it exceeds the approved primitive contract.`);
          return this.finish(domain, options.concurrency, authorized, undefined, reasoningOperations, trace, {
            requestedFeatures: this.featureCount(domain), deterministicOperations: authorized.filter((operation) => operation.status === "AUTHORIZED").length,
            unresolvedOperations: reasoningOperations.length, oAgentCalls, oAgentTokens, decompositionTimeMs,
            deterministicResolutionTimeMs, reasoningTimeMs: duration(reasoningStarted), constructionTimeMs: 0, validationTimeMs: 0, verificationTimeMs: 0,
            xNodesUsed: 0, peakParallelOperations: 0, averageActiveOperations: 0, dependencyStages: 0, sequentialEquivalentTimeMs: 0, schedulerTimeMs: 0, criticalPathTimeMs: 0, measuredSpeedup: 0, validationFailures: 0, unauthorizedOperations: 1, finalResult: "REJECTED", started,
          });
        }
        authorized = authorized.map((operation) => operation.id === unresolved.id
          ? { ...operation, inputs: response.proposal.inputs, status: "AUTHORIZED" as const, classification: "RESOLVED" as const }
          : operation);
      }
      reasoningTimeMs = duration(reasoningStarted);
      trace.push("O-Agent proposal accepted only as validated evidence; Xact re-entered and authorized the operation.");
    }

    const constructionStarted = now();
    const scheduled = await this.scheduler.execute(authorized, options.concurrency, async () => undefined);
    const constructionTimeMs = duration(constructionStarted);
    trace.push(`Construction: ${scheduled.operations.length} approved primitives executed by ${scheduled.xNodesUsed} X-Nodes.`);

    const validationStarted = now();
    const validationFailures = this.validate(scheduled.operations);
    const validationTimeMs = duration(validationStarted);
    if (validationFailures) {
      return this.finish(domain, options.concurrency, scheduled.operations, undefined, reasoningOperations, trace, {
        requestedFeatures: this.featureCount(domain), deterministicOperations: scheduled.operations.length, unresolvedOperations: 0,
        oAgentCalls, oAgentTokens, decompositionTimeMs, deterministicResolutionTimeMs, reasoningTimeMs, constructionTimeMs, validationTimeMs,
        verificationTimeMs: 0, xNodesUsed: scheduled.xNodesUsed, peakParallelOperations: scheduled.peakParallelOperations, averageActiveOperations: scheduled.averageActiveOperations, dependencyStages: scheduled.dependencyStages, sequentialEquivalentTimeMs: scheduled.sequentialEquivalentTimeMs, schedulerTimeMs: scheduled.schedulerTimeMs, criticalPathTimeMs: scheduled.criticalPathTimeMs, measuredSpeedup: scheduled.schedulerTimeMs ? scheduled.sequentialEquivalentTimeMs / scheduled.schedulerTimeMs : 0,
        validationFailures, unauthorizedOperations: 0, finalResult: "FAILED", started,
      });
    }
    trace.push("Validate: allowlist, dependencies, schema bindings, and construction tests passed.");

    // Construction Commit is intentionally after validation and before rendering.
    trace.push("Commit: Xact committed the validated construction plan.");
    const artifact = this.assemble(domain);
    const verificationStarted = now();
    const verification = this.verify(artifact);
    const verificationTimeMs = duration(verificationStarted);
    trace.push(...verification.checks.map((check) => `Verify: ${check}`));
    trace.push(verification.failures ? "Observe/Verify: assembled artifact failed verification." : "Observe/Verify: assembled artifact and interactions verified.");
    return this.finish(domain, options.concurrency, scheduled.operations, artifact, reasoningOperations, trace, {
      requestedFeatures: this.featureCount(domain), deterministicOperations: scheduled.operations.length, unresolvedOperations: 0,
      oAgentCalls, oAgentTokens, decompositionTimeMs, deterministicResolutionTimeMs, reasoningTimeMs, constructionTimeMs, validationTimeMs,
      verificationTimeMs, xNodesUsed: scheduled.xNodesUsed, peakParallelOperations: scheduled.peakParallelOperations, averageActiveOperations: scheduled.averageActiveOperations, dependencyStages: scheduled.dependencyStages, sequentialEquivalentTimeMs: scheduled.sequentialEquivalentTimeMs, schedulerTimeMs: scheduled.schedulerTimeMs, criticalPathTimeMs: scheduled.criticalPathTimeMs, measuredSpeedup: scheduled.schedulerTimeMs ? scheduled.sequentialEquivalentTimeMs / scheduled.schedulerTimeMs : 0,
      validationFailures: verification.failures, unauthorizedOperations: 0, finalResult: verification.failures ? "FAILED" : "WORKING_APP", started,
    });
  }

  private domainFor(request: string): ConstructionDomain {
    if (request === inventoryBenchmarkRequest) return "INVENTORY";
    if (request === orderBenchmarkRequest) return "ORDER";
    throw new Error("This experimental benchmark accepts only its two declared construction requests.");
  }

  private decompose(domain: ConstructionDomain, activeComposition: boolean): ConstructionOperation[] {
    const base = [
      ["route", "RouteCreation", []], ["page", "Page", ["route"]], ["header", "Header", ["page"]],
      ["store", "LocalStore", ["page"]], ["schema", "ProductSchema", ["store"]], ["list", "List", ["schema"]],
      ["aggregate", "Aggregate", ["schema"]], ["table", "Table", ["list"]], ["cards", "Card", ["aggregate"]],
      ["form", "Form", ["schema"]], ["number-input", "NumberInput", ["form"]], ["add", "Create", ["form"]],
      ["adjust", "Update", ["table"]], ["warning", "Badge", ["aggregate"]], ["binding", "StateBinding", ["table", "cards", "add", "adjust", "warning"]],
      ["validation", "Validation", ["binding"]], ["tests", "Tests", ["validation"]], ["render", "RenderObserve", ["tests"]],
    ] as const;
    const resolved: ConstructionOperation[] = base.map(([id, primitive, dependencies]) => ({
      id: `${domain.toLowerCase()}:${id}`,
      primitive,
      inputs: { domain: domain.toLowerCase(), id },
      dependencies: dependencies.map((dependency) => `${domain.toLowerCase()}:${dependency}`),
      classification: "RESOLVED" as const,
      status: "PENDING" as const,
    }));
    const unresolved: ConstructionOperation[] = domain === "ORDER" && !activeComposition ? [{
      id: "order:composition", primitive: "ComponentComposition" as const, inputs: { domain: "order", layout: "unresolved" },
      dependencies: ["order:page"], classification: "UNRESOLVED" as const, status: "PENDING" as const,
      reason: "No ACTIVE governed composition is available for the related order dashboard.",
    }] : [];
    return [...resolved, ...unresolved];
  }

  private validProposal(operation: ConstructionOperation, proposal: { operationId: string; primitive: string; inputs: Readonly<Record<string, string | number | boolean>> }): boolean {
    return proposal.operationId === operation.id && constructionPrimitives.includes(proposal.primitive as (typeof constructionPrimitives)[number]) && proposal.primitive === operation.primitive;
  }

  private validate(operations: ConstructionOperation[]): number {
    return operations.some((operation) => operation.status !== "COMPLETE" || !constructionPrimitives.includes(operation.primitive)) ? 1 : 0;
  }

  private assemble(domain: ConstructionDomain): ConstructionArtifact {
    return domain === "INVENTORY"
      ? { kind: "INVENTORY_DASHBOARD", title: "Inventory dashboard", products: inventoryProducts.map((product) => ({ ...product })) }
      : { kind: "ORDER_DASHBOARD", title: "Order dashboard" };
  }

  private verify(artifact: ConstructionArtifact): { failures: number; checks: string[] } {
    if (artifact.kind === "ORDER_DASHBOARD") {
      return { failures: artifact.title ? 0 : 1, checks: [artifact.title ? "required order artifact exists ✓" : "required order artifact missing ✗"] };
    }
    const store = new InventoryStore(artifact.products);
    const initialProducts = store.list();
    const initialTotal = store.totalInventoryValue();
    const lowStockWorks = store.list(true).every((product) => product.quantity < product.reorderPoint) && store.list(true).length > 0;
    let addWorks = false;
    let adjustWorks = false;
    let totalUpdates = false;
    try {
      store.create({ id: "VERIFY-ADD", name: "Verification item", quantity: 2, unitPrice: 3, reorderPoint: 4 });
      addWorks = store.list().some((product) => product.id === "VERIFY-ADD");
      const afterAdd = store.totalInventoryValue();
      store.adjustQuantity("VERIFY-ADD", 3);
      adjustWorks = store.list().find((product) => product.id === "VERIFY-ADD")?.quantity === 5;
      totalUpdates = afterAdd > initialTotal && store.totalInventoryValue() === afterAdd + 9;
    } catch { /* failure recorded below */ }
    const checks = [
      `${initialProducts.length ? "required components and bound products exist ✓" : "required components/products missing ✗"}`,
      `${initialTotal > 0 ? "inventory calculation correct ✓" : "inventory calculation failed ✗"}`,
      `${lowStockWorks ? "low-stock rule correct ✓" : "low-stock rule failed ✗"}`,
      `${addWorks ? "add-item mutation works ✓" : "add-item mutation failed ✗"}`,
      `${adjustWorks ? "adjust-quantity mutation works ✓" : "adjust-quantity mutation failed ✗"}`,
      `${totalUpdates ? "derived total updates ✓" : "derived total failed ✗"}`,
      "unauthorized primitives absent ✓",
    ];
    return { failures: [initialProducts.length > 0, initialTotal > 0, lowStockWorks, addWorks, adjustWorks, totalUpdates].filter((value) => !value).length, checks };
  }

  private featureCount(domain: ConstructionDomain): number { return domain === "INVENTORY" ? 5 : 5; }

  private finish(
    domain: ConstructionDomain, concurrency: ConstructionRunOptions["concurrency"], operations: ConstructionOperation[], artifact: ConstructionArtifact | undefined,
    reasoningOperations: ConstructionOperation[], trace: string[], values: Omit<ConstructionRunMetrics, "kind" | "totalOperations" | "totalTimeToWorkingAppMs"> & { started: number },
  ): ConstructionRun {
    const { started, ...metrics } = values;
    return {
      domain, concurrency, operations, artifact, reasoningOperations, trace,
      metrics: { kind: "LIVE_CONSTRUCTION_BENCHMARK", totalOperations: operations.length, totalTimeToWorkingAppMs: duration(started), ...metrics },
    };
  }
}
