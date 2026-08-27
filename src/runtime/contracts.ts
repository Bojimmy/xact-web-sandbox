import type { ExecutionResult, ExecutionSubstrate } from "../execution/contracts";
import type { DecisionCandidate, DecisionResult } from "../xact/contracts";
import type { VerificationResult } from "../xact/providers";

export type RuntimePhase =
  | "READY"
  | "RESOLVED"
  | "REENTERED"
  | "AUTHORIZED"
  | "REJECTED"
  | "ESCALATED"
  | "STALE"
  | "VERIFIED"
  | "VERIFICATION_FAILED";

export interface RuntimeTraceEvent {
  phase: "Input" | "Resolve" | "Reason" | "Re-entry" | "State" | "Commit" | "Execute" | "Verify";
  outcome: string;
  detail: string;
  sequence: number;
}

export interface SimulationSession<TInputs, TState, TEffect> {
  phase: RuntimePhase;
  inputs: TInputs;
  currentState: TState;
  currentStateHash: string;
  candidate?: DecisionCandidate<TInputs, TEffect>;
  decision?: DecisionResult<TInputs, TEffect>;
  selectedSubstrate: ExecutionSubstrate | "NONE";
  execution?: ExecutionResult;
  verification?: VerificationResult;
  trace: RuntimeTraceEvent[];
}
