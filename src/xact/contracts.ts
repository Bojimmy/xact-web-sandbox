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
  satisfied: boolean | "unknown";
  values?: unknown[];
  provenance?: string[];
}

export interface ResolutionState {
  resolved: ResolvedFact[];
  unresolved: UnresolvedField[];
  commitConstraints: CommitConstraint[];
}

export interface EvidenceRecord {
  id: string;
  claim: string;
  source: string;
  kind: FactSource;
  provenance: string;
  resolves?: string[];
}

export interface DecisionRequest<TInputs = unknown> {
  scenarioId: string;
  intent: string;
  inputs: TInputs;
  proposedEffect?: unknown;
}

export interface DecisionCandidate<TInputs = unknown, TEffect = unknown> {
  candidateId: string;
  request: DecisionRequest<TInputs>;
  baseStateHash: string;
  baseStateVersion: number;
  resolution: ResolutionState;
  evidence: EvidenceRecord[];
  resolutionEvidence: EvidenceRecord[];
  reasoningEvidence: EvidenceRecord[];
  proposedEffect: TEffect;
  reentryCount: number;
}

export interface CommitCheck {
  key: "resolution" | "policy" | "authority" | "capability" | "freshness";
  outcome: "PASS" | "FAIL" | "HOLD";
  detail: string;
}

export interface DecisionResult<TInputs = unknown, TEffect = unknown> {
  status: DecisionStatus;
  candidate: DecisionCandidate<TInputs, TEffect>;
  resolution: ResolutionState;
  evidence: EvidenceRecord[];
  reason: string;
  checks: CommitCheck[];
  currentStateHash: string;
  reentryAllowed: boolean;
}
