import type { DecisionStatus, FactSource } from "@/src/xact/contracts";
import type { ExecutionSubstrate } from "@/src/execution/contracts";

export type ScenarioId = "authorized" | "rejected" | "escalated" | "stale";
export type StepState = "complete" | "active" | "blocked" | "pending";
export type VerificationState = "VERIFIED" | "NOT_RUN" | "BLOCKED";

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
  id: ScenarioId;
  index: string;
  label: string;
  title: string;
  description: string;
  status: DecisionStatus;
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
    conflicts: DisplayIssue[];
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
    capability: string;
    stateBinding: string;
    baseHash: string;
    currentHash: string;
  };
  execution: {
    selected: ExecutionSubstrate | "NONE";
    effect: string;
    executed: boolean;
    receipt: string;
  };
  trace: TraceStep[];
  verification: {
    state: VerificationState;
    summary: string;
    checks: string[];
  };
}
