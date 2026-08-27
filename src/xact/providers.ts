import type { ScenarioPack } from "../scenarios/contracts";
import type { ExecutionObservation } from "../execution/contracts";
import type {
  CommitCheck,
  DecisionCandidate,
  DecisionResult,
  EvidenceRecord,
} from "./contracts";

export type ProviderResult<T> = T | Promise<T>;

export interface DecisionProvider<TInputs, TState, TEffect> {
  resolve(
    inputs: TInputs,
    state: TState,
    resolutionEvidence?: EvidenceRecord[],
  ): ProviderResult<DecisionCandidate<TInputs, TEffect>>;
  reenter(
    candidate: DecisionCandidate<TInputs, TEffect>,
    currentState: TState,
    evidence: EvidenceRecord[],
  ): ProviderResult<DecisionCandidate<TInputs, TEffect>>;
  commit(
    candidate: DecisionCandidate<TInputs, TEffect>,
    currentState: TState,
  ): ProviderResult<DecisionResult<TInputs, TEffect>>;
}

export interface AuthorizationAssessment {
  outcome: "ALLOWED" | "DENIED" | "UNKNOWN";
  reason: string;
  checks: CommitCheck[];
}

export interface PolicyProvider<TInputs, TState, TEffect> {
  authorize(input: {
    candidate: DecisionCandidate<TInputs, TEffect>;
    currentState: TState;
  }): ProviderResult<AuthorizationAssessment>;
}

export interface EvidenceProvider<TInputs, TEffect> {
  collect(candidate: DecisionCandidate<TInputs, TEffect>): ProviderResult<EvidenceRecord[]>;
}

export interface ResolutionEvidenceProvider<TInputs> {
  collect(inputs: TInputs): ProviderResult<EvidenceRecord[]>;
}

export interface VerificationResult {
  verified: boolean;
  reason: string;
  checks: string[];
}

export interface VerificationProvider<TInputs, TState, TEffect, TExecutionResult> {
  verify(input: {
    pack: ScenarioPack<TInputs, TState, TEffect>;
    candidate: DecisionCandidate<TInputs, TEffect>;
    before: TState;
    after: TState;
    execution: TExecutionResult;
    /** Independent post-execution observation from the selected substrate. */
    observation: ExecutionObservation;
  }): ProviderResult<VerificationResult>;
}
