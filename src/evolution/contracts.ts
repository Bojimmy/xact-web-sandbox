import type { EvidenceRecord } from "../xact/contracts";

export type PromotionState =
  | "OBSERVED"
  | "CANDIDATE"
  | "VALIDATED"
  | "APPROVED"
  | "ACTIVATED";

export interface LearningCandidate {
  id: string;
  label: string;
  state: PromotionState;
  equivalentCaseKey: string;
  resolves: string[];
  evidence: EvidenceRecord;
  validationStatus: "NOT_RUN" | "PASSED";
  approvalStatus: "PENDING" | "APPROVED";
  promotionStatus: "INACTIVE" | "ACTIVATED";
}

export interface EvolutionCoveragePoint {
  label: string;
  deterministicCoveragePercent: number;
  reasoningFrequencyPercent: number;
  cohortSize: number;
}

export interface EvolutionSnapshot {
  kind: "PUBLIC_SAFE_SIMULATION";
  candidate?: LearningCandidate;
  coverage: EvolutionCoveragePoint[];
  beforeTrace: string[];
  afterTrace: string[];
  notice: string;
}

export interface LearningObservation {
  evidenceId: string;
  claim: string;
  beforeTrace: string[];
}

export interface ReferenceEvolutionResults {
  kind: "REFERENCE_RESULTS";
  appliesTo: "REFERENCE_IMPLEMENTATION_NOT_SANDBOX";
  deterministicCoverage: { beforePercent: number; afterPercent: number };
  reasoningFrequency: { beforePercent: number; afterPercent: number };
  promotedPatterns: number;
  exactMatchRouting: { maintained: number; total: number };
  provenance: string;
}
