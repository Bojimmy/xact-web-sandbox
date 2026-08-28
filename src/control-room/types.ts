import type { ConstraintCondition, DecisionStatus, FactSource } from "@/src/xact/contracts";
import type { ExecutionSubstrate } from "@/src/execution/contracts";

export type ScenarioId = "authorized" | "rejected" | "escalated" | "stale";
export type StepState = "complete" | "active" | "blocked" | "pending";
export type VerificationState = "VERIFIED" | "FAILED" | "NOT_RUN" | "BLOCKED";
export type ControlRoomStatus = DecisionStatus | "PENDING";

export interface DisplayFact {
  label: string;
  value: string;
  source: FactSource;
  provenance: string;
}

export interface DisplayIssue {
  label: string;
  detail: string;
}

export interface DisplayConstraint extends DisplayIssue {
  condition: ConstraintCondition;
  satisfied?: boolean | "unknown";
}

export interface EvidenceItem {
  id: string;
  claim: string;
  source: string;
  kind: FactSource;
  boundAt: string;
}

export interface TraceStep {
  phase: string;
  outcome: string;
  detail: string;
  at: string;
  state: StepState;
}

export interface ControlRoomScenario {
  id: ScenarioId | "runtime";
  index: string;
  label: string;
  title: string;
  description: string;
  status: ControlRoomStatus;
  request: {
    id: string;
    intent: string;
    actor: string;
    target: string;
    proposedEffect: string;
  };
  resolution: {
    resolved: DisplayFact[];
    unresolved: DisplayIssue[];
    commitConstraints: DisplayConstraint[];
  };
  evidence: EvidenceItem[];
  reasoning: {
    involved: boolean;
    summary: string;
    output: string;
  };
  commit: {
    summary: string;
    policy: string;
    authority: string;
    capability: string;
    stateBinding: string;
    baseFingerprint: string;
    currentFingerprint: string;
  };
  decision: {
    finality: "PENDING" | "PASSED" | "FINAL" | "REENTRY_ALLOWED" | "RERESOLUTION_REQUIRED";
    label: string;
    nextStep: string;
  };
  execution: {
    selected: ExecutionSubstrate | "NONE";
    effect: string;
    executed: boolean;
    receipt: string;
    /** Present only after Commit issues a bounded AuthorizationArtifact. */
    authorization?: {
      commitId: string;
      effectFingerprint: string;
      target: string;
    };
  };
  trace: TraceStep[];
  verification: {
    state: VerificationState;
    summary: string;
    checks: string[];
  };
}
