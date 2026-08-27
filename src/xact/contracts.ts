export type DecisionStatus =
  | "AUTHORIZED"
  | "REJECTED"
  | "ESCALATED"
  | "STALE";

export type FactSource = "reported" | "verified" | "derived";

export interface ResolvedFact {
  key: string;
  value: unknown;
  source: FactSource;
  provenance?: string;
}

export interface UnresolvedField {
  key: string;
  reason: string;
}

export interface Conflict {
  key: string;
  values: unknown[];
  provenance?: string[];
}

export interface ResolutionState {
  resolved: ResolvedFact[];
  unresolved: UnresolvedField[];
  conflicts: Conflict[];
}

export interface DecisionRequest {
  scenarioId: string;
  intent: string;
  proposedEffect?: unknown;
}

export interface DecisionResult {
  status: DecisionStatus;
  resolution: ResolutionState;
  evidence: unknown[];
  reason?: string;
}
