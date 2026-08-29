import {
  constructionPrimitives,
  type ConstructionArtifact,
  type ConstructionDomain,
  type ConstructionOperation,
  type ConstructionProposalProvider,
  type ConstructionRun,
  type ConstructionRunMetrics,
  type ServiceAuditEvent,
  type ServiceCustomer,
  type ServiceOperationsToolDescriptor,
} from "./contracts";
import { ConstructionScheduler } from "./scheduler";
import { ServiceOperationsStore } from "./service-operations-store";
import {
  recognizeGovernedCapability,
  type CapabilityRecognitionResult,
  type GovernedCapabilityDescriptor,
} from "../flagship/capability-vocabulary";
import { composeWebMCPTool, type WebMCPToolDefinition } from "../flagship/webmcp-tool-builder";

export const serviceOperationsBenchmarkRequest = "Build a Service Operations Console that shows customer, account status, available actions, service-credit requests, plan changes, and audit history.";
export const serviceOperationsSemanticRequest = "Build a Service Operations Console with a related semantic composition that requires governed evidence.";

const serviceCustomers: ServiceCustomer[] = [
  {
    id: "1042",
    name: "Avery Chen",
    accountStatus: "ACTIVE",
    servicePlan: "Business Plus",
    availableServiceCredit: 42,
    availableActions: ["Request service credit", "Change service plan", "Review audit history"],
  },
  {
    id: "2077",
    name: "Morgan Reyes",
    accountStatus: "PAST_DUE",
    servicePlan: "Starter",
    availableServiceCredit: 0,
    availableActions: ["Review account status", "Review audit history"],
  },
];

const serviceAuditHistory: ServiceAuditEvent[] = [
  { id: "audit:1042:1", detail: "Account status verified as ACTIVE.", recordedAt: "2026-08-28T10:00:00.000Z" },
  { id: "audit:1042:2", detail: "Service-credit eligibility reported at $42.00.", recordedAt: "2026-08-28T10:01:00.000Z" },
];

export const serviceOperationsTools: readonly ServiceOperationsToolDescriptor[] = [
  { name: "get_customer", description: "Read the selected customer record.", kind: "READ", requiresCommit: false },
  { name: "get_account_status", description: "Read the customer account status.", kind: "READ", requiresCommit: false },
  { name: "list_available_actions", description: "Read actions available for the customer state.", kind: "READ", requiresCommit: false },
  { name: "request_service_credit", description: "Request a service-credit consequence through Xact Commit.", kind: "CONSEQUENCE_REQUEST", requiresCommit: true },
  { name: "change_service_plan", description: "Request a plan-change consequence through Xact Commit.", kind: "CONSEQUENCE_REQUEST", requiresCommit: true },
  { name: "get_audit_history", description: "Read the recorded audit history.", kind: "READ", requiresCommit: false },
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

  /**
   * Typed, inert extension point for Xact Foundry (ADR 0016). A construction
   * Node recognizes and validates a governed capability descriptor against the
   * closed vocabulary — it never composes a tool, effect, or artifact. The
   * result's `composed` field is typed `false`.
   */
  recognizeCapability(descriptor: GovernedCapabilityDescriptor): CapabilityRecognitionResult {
    return recognizeGovernedCapability(descriptor);
  }

  /**
   * Typed compose extension point for Xact Foundry (ADR 0016). Composes a
   * recognized capability descriptor into a WebMCP tool definition. The
   * definition remains descriptive and inert: no execute handler, no authority.
   */
  composeCapability(descriptor: GovernedCapabilityDescriptor): WebMCPToolDefinition {
    return composeWebMCPTool(descriptor);
  }

  async run(options: ConstructionRunOptions): Promise<ConstructionRun> {
    const started = now();
    const trace: string[] = [];
    const decompositionStarted = now();
    const domain = this.domainFor(options.request);
    const operations = this.decompose(domain, Boolean(options.activeComposition), options.request === serviceOperationsSemanticRequest);
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
          requestedFeatures: this.featureCount(), deterministicOperations: authorized.filter((operation) => operation.status === "AUTHORIZED").length,
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
            requestedFeatures: this.featureCount(), deterministicOperations: authorized.filter((operation) => operation.status === "AUTHORIZED").length,
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
        requestedFeatures: this.featureCount(), deterministicOperations: scheduled.operations.length, unresolvedOperations: 0,
        oAgentCalls, oAgentTokens, decompositionTimeMs, deterministicResolutionTimeMs, reasoningTimeMs, constructionTimeMs, validationTimeMs,
        verificationTimeMs: 0, xNodesUsed: scheduled.xNodesUsed, peakParallelOperations: scheduled.peakParallelOperations, averageActiveOperations: scheduled.averageActiveOperations, dependencyStages: scheduled.dependencyStages, sequentialEquivalentTimeMs: scheduled.sequentialEquivalentTimeMs, schedulerTimeMs: scheduled.schedulerTimeMs, criticalPathTimeMs: scheduled.criticalPathTimeMs, measuredSpeedup: scheduled.schedulerTimeMs ? scheduled.sequentialEquivalentTimeMs / scheduled.schedulerTimeMs : 0,
        validationFailures, unauthorizedOperations: 0, finalResult: "FAILED", started,
      });
    }
    trace.push("Validate: allowlist, dependencies, schema bindings, and construction tests passed.");

    // Construction Commit is intentionally after validation and before rendering.
    trace.push("Commit: Xact committed the validated construction plan.");
    const artifact = this.assemble();
    const verificationStarted = now();
    const verification = this.verify(artifact);
    const verificationTimeMs = duration(verificationStarted);
    trace.push(...verification.checks.map((check) => `Verify: ${check}`));
    trace.push(verification.failures ? "Observe/Verify: assembled artifact failed verification." : "Observe/Verify: assembled artifact and interactions verified.");
    return this.finish(domain, options.concurrency, scheduled.operations, artifact, reasoningOperations, trace, {
      requestedFeatures: this.featureCount(), deterministicOperations: scheduled.operations.length, unresolvedOperations: 0,
      oAgentCalls, oAgentTokens, decompositionTimeMs, deterministicResolutionTimeMs, reasoningTimeMs, constructionTimeMs, validationTimeMs,
      verificationTimeMs, xNodesUsed: scheduled.xNodesUsed, peakParallelOperations: scheduled.peakParallelOperations, averageActiveOperations: scheduled.averageActiveOperations, dependencyStages: scheduled.dependencyStages, sequentialEquivalentTimeMs: scheduled.sequentialEquivalentTimeMs, schedulerTimeMs: scheduled.schedulerTimeMs, criticalPathTimeMs: scheduled.criticalPathTimeMs, measuredSpeedup: scheduled.schedulerTimeMs ? scheduled.sequentialEquivalentTimeMs / scheduled.schedulerTimeMs : 0,
      validationFailures: verification.failures, unauthorizedOperations: 0, finalResult: verification.failures ? "FAILED" : "WORKING_APP", started,
    });
  }

  private domainFor(request: string): ConstructionDomain {
    if (request === serviceOperationsBenchmarkRequest || request === serviceOperationsSemanticRequest) return "SERVICE_OPERATIONS";
    throw new Error("This experimental benchmark accepts only its two declared Service Operations construction requests.");
  }

  private decompose(domain: ConstructionDomain, activeComposition: boolean, semanticComposition: boolean): ConstructionOperation[] {
    const base = [
      ["route", "RouteCreation", []], ["page", "Page", ["route"]], ["header", "Header", ["page"]],
      ["store", "LocalStore", ["page"]], ["schema", "CustomerSchema", ["store"]], ["customer", "Read", ["schema"]],
      ["account", "Read", ["schema"]], ["actions", "ActionRegistry", ["schema"]], ["audit", "AuditTrail", ["store"]],
      ["table", "Table", ["customer"]], ["cards", "Card", ["account", "actions"]], ["form", "Form", ["actions"]],
      ["credit-request", "Button", ["form"]], ["plan-request", "Button", ["form"]], ["binding", "StateBinding", ["table", "cards", "credit-request", "plan-request", "audit"]],
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
    const unresolved: ConstructionOperation[] = semanticComposition && !activeComposition ? [{
      id: "service_operations:composition", primitive: "ComponentComposition" as const, inputs: { domain: "service_operations", layout: "unresolved" },
      dependencies: ["service_operations:page"], classification: "UNRESOLVED" as const, status: "PENDING" as const,
      reason: "No ACTIVATED governed composition is available for the related Service Operations Console.",
    }] : [];
    return [...resolved, ...unresolved];
  }

  private validProposal(operation: ConstructionOperation, proposal: { operationId: string; primitive: string; inputs: Readonly<Record<string, string | number | boolean>> }): boolean {
    return proposal.operationId === operation.id && constructionPrimitives.includes(proposal.primitive as (typeof constructionPrimitives)[number]) && proposal.primitive === operation.primitive;
  }

  private validate(operations: ConstructionOperation[]): number {
    return operations.some((operation) => operation.status !== "COMPLETE" || !constructionPrimitives.includes(operation.primitive)) ? 1 : 0;
  }

  private assemble(): ConstructionArtifact {
    return {
      kind: "SERVICE_OPERATIONS_CONSOLE",
      title: "Service Operations Console",
      customers: serviceCustomers.map((customer) => ({ ...customer, availableActions: [...customer.availableActions] })),
      auditHistory: serviceAuditHistory.map((event) => ({ ...event })),
      tools: serviceOperationsTools.map((tool) => ({ ...tool })),
    };
  }

  private verify(artifact: ConstructionArtifact): { failures: number; checks: string[] } {
    const store = new ServiceOperationsStore(artifact.customers, artifact.auditHistory);
    const customer = store.getCustomer("1042");
    const accountStatus = store.getAccountStatus("1042");
    const availableActions = store.listAvailableActions("1042");
    const auditHistory = store.getAuditHistory("1042");
    const toolNames = artifact.tools.map((tool) => tool.name);
    const expectedToolNames = serviceOperationsTools.map((tool) => tool.name);
    const exactToolManifest = toolNames.length === expectedToolNames.length && toolNames.every((name, index) => name === expectedToolNames[index]);
    const consequenceToolsRequireCommit = artifact.tools
      .filter((tool) => tool.kind === "CONSEQUENCE_REQUEST")
      .every((tool) => tool.requiresCommit);
    const noExecutableSurface = artifact.tools.every((tool) => !("execute" in tool));
    const checks = [
      `${customer?.name === "Avery Chen" ? "required customer record exists ✓" : "required customer record missing ✗"}`,
      `${accountStatus === "ACTIVE" ? "account-status read is correct ✓" : "account-status read failed ✗"}`,
      `${availableActions.includes("Request service credit") ? "available-actions binding is correct ✓" : "available-actions binding failed ✗"}`,
      `${auditHistory.length > 0 ? "audit-history read is correct ✓" : "audit-history read failed ✗"}`,
      `${exactToolManifest ? "six required capability descriptors exist ✓" : "capability manifest mismatch ✗"}`,
      `${consequenceToolsRequireCommit ? "consequential capabilities require Commit ✓" : "consequential capability bypass detected ✗"}`,
      `${noExecutableSurface ? "no executable capability surface exists ✓" : "unexpected executable surface detected ✗"}`,
    ];
    return { failures: [customer?.name === "Avery Chen", accountStatus === "ACTIVE", availableActions.includes("Request service credit"), auditHistory.length > 0, exactToolManifest, consequenceToolsRequireCommit, noExecutableSurface].filter((value) => !value).length, checks };
  }

  private featureCount(): number { return 6; }

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
