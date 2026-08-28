import type { EvolutionSnapshot, LearningCandidate, LearningObservation, PromotionState } from "./contracts";
import type { EvidenceRecord } from "../xact/contracts";
import type { ResolutionEvidenceProvider } from "../xact/providers";

interface LearningSimulationDefinition<TInputs> {
  candidateId: string;
  label: string;
  caseKey: (inputs: TInputs) => string | undefined;
  equivalentCaseKey: string;
  resolves: string[];
}

const nextState: Record<PromotionState, PromotionState | undefined> = {
  OBSERVED: "CANDIDATE",
  CANDIDATE: "VALIDATED",
  VALIDATED: "APPROVED",
  APPROVED: "ACTIVATED",
  ACTIVATED: undefined,
};

export class LearningSimulationProvider<TInputs> implements ResolutionEvidenceProvider<TInputs> {
  private candidate?: LearningCandidate;
  private beforeTrace: string[] = [];
  private afterTrace: string[] = [];

  constructor(private readonly definition: LearningSimulationDefinition<TInputs>) {}

  observe(observation: LearningObservation): EvolutionSnapshot {
    if (this.candidate?.state === "ACTIVATED") {
      throw new Error("An activated simulated pattern must be reset before observing a new candidate.");
    }

    this.beforeTrace = [...observation.beforeTrace];
    this.afterTrace = [];
    this.candidate = {
      id: this.definition.candidateId,
      label: this.definition.label,
      state: "OBSERVED",
      equivalentCaseKey: this.definition.equivalentCaseKey,
      resolves: [...this.definition.resolves],
      evidence: {
        id: observation.evidenceId,
        claim: observation.claim,
        source: "Governed Learning Simulation",
        kind: "verified",
        provenance: "Public-safe governed simulation; production extraction and promotion logic encapsulated.",
        resolves: [...this.definition.resolves],
      },
      validationStatus: "NOT_RUN",
      approvalStatus: "PENDING",
      promotionStatus: "INACTIVE",
    };
    return this.snapshot();
  }

  transition(target: PromotionState): EvolutionSnapshot {
    if (!this.candidate) {
      throw new Error("A resolved observation is required before governance can begin.");
    }

    const expected = nextState[this.candidate.state];
    if (target !== expected) {
      throw new Error(`The next governed state after ${this.candidate.state} is ${expected ?? "none"}.`);
    }

    this.candidate = {
      ...this.candidate,
      state: target,
      validationStatus: target === "VALIDATED" || target === "APPROVED" || target === "ACTIVATED"
        ? "PASSED"
        : this.candidate.validationStatus,
      approvalStatus: target === "APPROVED" || target === "ACTIVATED"
        ? "APPROVED"
        : this.candidate.approvalStatus,
      promotionStatus: target === "ACTIVATED" ? "ACTIVATED" : "INACTIVE",
    };
    return this.snapshot();
  }

  collect(inputs: TInputs): EvidenceRecord[] {
    if (
      this.candidate?.state !== "ACTIVATED"
      || this.definition.caseKey(inputs) !== this.candidate.equivalentCaseKey
    ) {
      return [];
    }

    return [{
      ...this.candidate.evidence,
      id: `${this.candidate.evidence.id}:activated`,
      source: "Activated Governed Simulation Pattern",
      provenance: "Public-safe governed simulation; explicitly approved and promoted to ACTIVATED.",
      resolves: [...this.candidate.resolves],
    }];
  }

  recordReplay(afterTrace: string[]): EvolutionSnapshot {
    if (this.candidate?.state !== "ACTIVATED") {
      throw new Error("Replay evidence may be recorded only after promotion is ACTIVATED.");
    }
    this.afterTrace = [...afterTrace];
    return this.snapshot();
  }

  reset(): EvolutionSnapshot {
    this.candidate = undefined;
    this.beforeTrace = [];
    this.afterTrace = [];
    return this.snapshot();
  }

  snapshot(): EvolutionSnapshot {
    const activated = this.candidate?.state === "ACTIVATED";
    return {
      kind: "PUBLIC_SAFE_SIMULATION",
      candidate: this.candidate
        ? {
            ...this.candidate,
            resolves: [...this.candidate.resolves],
            evidence: { ...this.candidate.evidence, resolves: [...(this.candidate.evidence.resolves ?? [])] },
          }
        : undefined,
      coverage: [
        { label: "First encounter", deterministicCoveragePercent: 80, reasoningFrequencyPercent: 20, cohortSize: 5 },
        ...(activated
          ? [{ label: "After governed activation", deterministicCoveragePercent: 100, reasoningFrequencyPercent: 0, cohortSize: 5 }]
          : []),
      ],
      beforeTrace: [...this.beforeTrace],
      afterTrace: [...this.afterTrace],
      notice: "Public-safe simulation — production extraction and promotion logic encapsulated.",
    };
  }
}
