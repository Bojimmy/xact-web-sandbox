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

export type ConstraintCondition =
  | "required"
  | "limit"
  | "conflict"
  | "authority"
  | "freshness";

export interface CommitConstraint {
  key: string;
  description: string;
  condition: ConstraintCondition;
  values?: unknown[];
  provenance?: string[];
}

export interface ResolutionState {
  resolved: ResolvedFact[];
  unresolved: UnresolvedField[];
  commitConstraints: CommitConstraint[];
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
