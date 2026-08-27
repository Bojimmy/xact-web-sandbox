export const constructionPrimitives = [
  "Page", "Header", "Card", "Table", "Button", "Form", "NumberInput", "Badge",
  "ProductSchema", "LocalStore", "List", "Create", "Update", "Aggregate",
  "RouteCreation", "ComponentComposition", "StateBinding", "Validation", "Tests", "Commit", "RenderObserve",
] as const;

export type ConstructionPrimitive = (typeof constructionPrimitives)[number];
export type ConstructionClassification = "RESOLVED" | "UNRESOLVED";
export type ConstructionOperationStatus = "PENDING" | "AUTHORIZED" | "RUNNING" | "COMPLETE" | "BLOCKED";
export type ConstructionDomain = "INVENTORY" | "ORDER";

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

export interface Product {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  reorderPoint: number;
}

export interface InventoryDashboardArtifact {
  kind: "INVENTORY_DASHBOARD";
  title: string;
  products: Product[];
}

export interface OrderDashboardArtifact {
  kind: "ORDER_DASHBOARD";
  title: string;
}

export type ConstructionArtifact = InventoryDashboardArtifact | OrderDashboardArtifact;

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
