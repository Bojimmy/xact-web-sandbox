import type { ExecutionSubstrate } from "../execution/contracts";
import type { EvidenceRecord, ResolutionState } from "../xact/contracts";

export interface ScenarioResolution<TEffect> {
  resolution: ResolutionState;
  evidence: EvidenceRecord[];
  proposedEffect: TEffect;
}

export interface ScenarioPack<TInputs, TState, TEffect> {
  readonly id: string;
  readonly label: string;
  readonly preferredSubstrate: ExecutionSubstrate;
  createInitialInputs(): TInputs;
  createInitialState(): TState;
  stateHash(state: TState): string;
  stateVersion(state: TState): number;
  resolve(
    inputs: TInputs,
    state: TState,
    reasoningEvidence: EvidenceRecord[],
  ): ScenarioResolution<TEffect>;
  simulateConcurrentChange(state: TState): TState;
  applyEffect(state: TState, effect: TEffect, receipt: unknown): TState;
}
