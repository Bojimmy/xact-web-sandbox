export const constructionPrimitives = [
  "Page", "Header", "Card", "Table", "Button", "Form", "NumberInput", "Badge",
  "CustomerSchema", "LocalStore", "List", "Read", "ActionRegistry", "AuditTrail",
  "RouteCreation", "ComponentComposition", "StateBinding", "Validation", "Tests", "Commit", "RenderObserve",
] as const;

export type ConstructionPrimitive = (typeof constructionPrimitives)[number];
export type ConstructionClassification = "RESOLVED" | "UNRESOLVED";
export type ConstructionOperationStatus = "PENDING" | "AUTHORIZED" | "RUNNING" | "COMPLETE" | "BLOCKED";
export type ConstructionDomain = "SERVICE_OPERATIONS";

export interface ConstructionOperation {
  id: string;
  primitive: ConstructionPrimitive;
  inputs: Readonly<Record<string, string | number | boolean>>;
  dependencies: readonly string[];
  classification: ConstructionClassification;
  status: ConstructionOperationStatus;
  reason?: string;
}

export interface ConstructionProposal {
  operationId: string;
  primitive: ConstructionPrimitive;
  inputs: Readonly<Record<string, string | number | boolean>>;
  rationale: string;
}

/** Bounded evidence-only provider: no files, shell, or arbitrary code authority. */
export interface ConstructionProposalProvider {
  propose(operation: ConstructionOperation): Promise<{ proposal: ConstructionProposal; tokensUsed: number }>;
}

export interface ServiceCustomer {
  id: string;
  name: string;
  accountStatus: "ACTIVE" | "PAST_DUE" | "SUSPENDED";
  servicePlan: string;
  availableServiceCredit: number;
  availableActions: readonly string[];
}

export type ServiceOperationsToolName =
  | "get_customer"
  | "get_account_status"
  | "list_available_actions"
  | "request_service_credit"
  | "change_service_plan"
  | "get_audit_history";

/**
 * A constructed capability manifest is descriptive only. It has no callable
 * execution surface: a later WebMCP host may expose these capabilities, but
 * consequential requests remain artifact- and Commit-gated.
 */
export interface ServiceOperationsToolDescriptor {
  name: ServiceOperationsToolName;
  description: string;
  kind: "READ" | "CONSEQUENCE_REQUEST";
  requiresCommit: boolean;
}

export interface ServiceAuditEvent {
  id: string;
  detail: string;
  recordedAt: string;
}

export interface ServiceOperationsConsoleArtifact {
  kind: "SERVICE_OPERATIONS_CONSOLE";
  title: string;
  customers: ServiceCustomer[];
  auditHistory: ServiceAuditEvent[];
  tools: readonly ServiceOperationsToolDescriptor[];
}

export type ConstructionArtifact = ServiceOperationsConsoleArtifact;

export interface ConstructionRunMetrics {
  kind: "LIVE_CONSTRUCTION_BENCHMARK";
  requestedFeatures: number;
  totalOperations: number;
  deterministicOperations: number;
  unresolvedOperations: number;
  oAgentCalls: number;
  oAgentTokens: number;
  xNodesUsed: number;
  peakParallelOperations: number;
  averageActiveOperations: number;
  dependencyStages: number;
  sequentialEquivalentTimeMs: number;
  schedulerTimeMs: number;
  criticalPathTimeMs: number;
  measuredSpeedup: number;
  decompositionTimeMs: number;
  deterministicResolutionTimeMs: number;
  reasoningTimeMs: number;
  constructionTimeMs: number;
  validationTimeMs: number;
  verificationTimeMs: number;
  totalTimeToWorkingAppMs: number;
  validationFailures: number;
  unauthorizedOperations: number;
  finalResult: "WORKING_APP" | "ESCALATED" | "REJECTED" | "FAILED";
}

export interface ConstructionRun {
  domain: ConstructionDomain;
  concurrency: number;
  operations: ConstructionOperation[];
  artifact?: ConstructionArtifact;
  metrics: ConstructionRunMetrics;
  reasoningOperations: ConstructionOperation[];
  trace: string[];
}

export interface DeterministicScaleRun {
  kind: "LIVE_CONSTRUCTION_SCALE_WORKLOAD";
  totalOperations: number;
  dependencyStages: number;
  configuredWorkers: number;
  peakActiveWorkers: number;
  averageActiveWorkers: number;
  schedulerTimeMs: number;
  workerComputeTimeMs: number;
  throughputOperationsPerSecond: number;
  checksum: number;
  environment: {
    runtime: "BROWSER_WEB_WORKERS";
    hardwareConcurrency?: number;
    userAgent?: string;
  };
}
