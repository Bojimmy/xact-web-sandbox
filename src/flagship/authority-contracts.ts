import type { LearningCandidate } from "../evolution/contracts";
import type { AuthorizationArtifact, DecisionResult, EvidenceRecord } from "../xact/contracts";

const candidateCapabilityBrand: unique symbol = Symbol("candidate-capability");
const activatedResolutionAuthorityBrand: unique symbol = Symbol("activated-resolution-authority");
const commitAuthorizationBrand: unique symbol = Symbol("commit-authorization");

/** Evidence-derived candidate. Deliberately has no execution surface. */
export interface CandidateCapability {
  readonly kind: "CANDIDATE_CAPABILITY";
  readonly id: string;
  readonly label: string;
  readonly resolves: readonly string[];
  readonly [candidateCapabilityBrand]: true;
}

/** Authority to contribute deterministic Resolution evidence, and nothing else. */
export interface ActivatedResolutionAuthority {
  readonly kind: "ACTIVATED_RESOLUTION_AUTHORITY";
  readonly candidateId: string;
  readonly [activatedResolutionAuthorityBrand]: true;
  resolve(): EvidenceRecord;
}

/** Authority to present the one consequence artifact emitted by Commit. */
export interface CommitAuthorization {
  readonly kind: "COMMIT_AUTHORIZATION";
  readonly artifact: AuthorizationArtifact;
  readonly [commitAuthorizationBrand]: true;
}

export function createCandidateCapability(input: {
  id: string;
  label: string;
  resolves: readonly string[];
}): CandidateCapability {
  return Object.freeze({
    kind: "CANDIDATE_CAPABILITY" as const,
    id: input.id,
    label: input.label,
    resolves: Object.freeze([...input.resolves]),
    [candidateCapabilityBrand]: true as const,
  });
}

/**
 * Governance may activate a candidate for resolution only after its lifecycle
 * reaches ACTIVATED. No Commit artifact is accepted or returned here.
 */
export function activateResolutionAuthority(
  candidate: CandidateCapability,
  governed: LearningCandidate,
): ActivatedResolutionAuthority {
  if (governed.id !== candidate.id || governed.state !== "ACTIVATED") {
    throw new Error("Resolution authority requires the matching governed candidate in ACTIVATED state.");
  }

  return Object.freeze({
    kind: "ACTIVATED_RESOLUTION_AUTHORITY" as const,
    candidateId: candidate.id,
    [activatedResolutionAuthorityBrand]: true as const,
    resolve: () => ({
      ...governed.evidence,
      id: `${governed.evidence.id}:activated`,
      source: "Activated Governed Resolution Capability",
      provenance: "ACTIVATED permits deterministic resolution only; Commit remains required for every consequence.",
      resolves: [...governed.resolves],
    }),
  });
}

/**
 * Commit is the only constructor for a consequence authorization. Activation
 * cannot be supplied here because it grants a different, non-assignable type.
 */
export function commitAuthorizationFrom<TInputs, TEffect>(decision: DecisionResult<TInputs, TEffect>): CommitAuthorization {
  if (decision.status !== "AUTHORIZED" || !decision.artifact) {
    throw new Error("Only an AUTHORIZED Commit decision with an artifact grants consequence authorization.");
  }
  return Object.freeze({
    kind: "COMMIT_AUTHORIZATION" as const,
    artifact: decision.artifact,
    [commitAuthorizationBrand]: true as const,
  });
}
