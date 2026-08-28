import type { ExecutionResult, ExecutionSubstrate } from "../execution/contracts";
import type { DecisionCandidate, DecisionResult } from "../xact/contracts";
import type { VerificationResult } from "../xact/providers";
import type { TelemetrySample } from "../telemetry/contracts";

export type RuntimePhase =
  | "READY"
  | "RESOLVED"
  | "REENTERED"
  | "AUTHORIZED"
  | "REJECTED"
  | "ESCALATED"
  | "STALE"
  | "EXECUTION_FAILED"
  | "OBSERVATION_FAILED"
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
  currentStateFingerprint: string;
  candidate?: DecisionCandidate<TInputs, TEffect>;
  decision?: DecisionResult<TInputs, TEffect>;
  selectedSubstrate: ExecutionSubstrate | "NONE";
  execution?: ExecutionResult;
  verification?: VerificationResult;
  telemetry: TelemetrySample[];
  trace: RuntimeTraceEvent[];
}
