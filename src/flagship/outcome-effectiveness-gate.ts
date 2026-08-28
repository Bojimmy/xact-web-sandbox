import type { PromotionState } from "../evolution/contracts";
import type { CandidateCapability } from "./authority-contracts";

/**
 * Outcome Effectiveness Evidence Gate — V2.0 of the Agent Arena Door/Ledger
 * learning boundary, reconciled with Xact.
 *
 * Four separate questions:
 *   1. DOOR          — admissibility (can Xact represent this capability?).
 *   2. LEDGER        — validity (does it obey deterministic invariants?).
 *   3. EFFECTIVENESS — did the resolution actually work? (evidence only).
 *   4. GOVERNANCE    — should this approve/activate? (the only promotion cause).
 *
 * Load-bearing invariant: effectiveness is EVIDENCE ONLY. It informs promotion;
 * it can never cause it. No metric, score, or threshold may directly produce
 * APPROVED / ACTIVATED / AUTHORIZATION / COMMIT / execution authority.
 */

const outcomeEvidenceBrand: unique symbol = Symbol("outcome-evidence");
const governanceDecisionBrand: unique symbol = Symbol("governance-decision");
const promotionDecisionBrand: unique symbol = Symbol("promotion-decision");

// ---- Question 1: DOOR (admissibility) --------------------------------

export interface DoorResult {
  admissible: boolean;
  errors: string[];
}

/**
 * Door: the proposed capability must be a member of a closed capability
 * ontology and carry a representable shape. Anything unknown is inadmissible.
 */
export function doorValidate(
  raw: unknown,
  allowlistedCapabilities: ReadonlySet<string>,
): DoorResult {
  if (!raw || typeof raw !== "object") {
    return { admissible: false, errors: ["Proposal must be a structured object."] };
  }
  const candidate = raw as { capability?: unknown; resolves?: unknown };
  const errors: string[] = [];
  const capability = typeof candidate.capability === "string" ? candidate.capability : undefined;
  if (!capability) {
    errors.push("Missing capability name.");
  } else if (!allowlistedCapabilities.has(capability)) {
    errors.push(`Capability '${capability}' is not in the closed capability ontology.`);
  }
  if (!Array.isArray(candidate.resolves) || candidate.resolves.some((field) => typeof field !== "string")) {
    errors.push("Proposal must declare a string[] resolves surface.");
  }
  return { admissible: errors.length === 0, errors };
}

// ---- Question 2: LEDGER (validity) -----------------------------------

export interface LedgerResult {
  valid: boolean;
  violations: string[];
}

const FORBIDDEN_AUTHORITY_SURFACES = [
  "execute",
  "artifact",
  "authorize",
  "commit",
  "activate",
] as const;

/**
 * Ledger: deterministic authority invariants. A proposal may describe a
 * capability; it may never carry an execution or authority surface. The
 * O-Agent proposes; it does not execute, authorize, or teach the layer.
 */
export function ledgerValidate(raw: unknown): LedgerResult {
  if (!raw || typeof raw !== "object") {
    return { valid: false, violations: ["Proposal must be a structured object."] };
  }
  const candidate = raw as Record<string, unknown>;
  const violations: string[] = [];
  for (const surface of FORBIDDEN_AUTHORITY_SURFACES) {
    if (surface in candidate) {
      violations.push(`Proposal carries a forbidden authority surface: '${surface}'.`);
    }
  }
  return { valid: violations.length === 0, violations };
}

// ---- Question 3: EFFECTIVENESS (evidence only) ------------------------

export type EffectivenessVerdict = "EFFECTIVE" | "INEFFECTIVE" | "INDETERMINATE";
export type GovernanceApproval = "APPROVED" | "REJECTED" | "DEFERRED";

export interface VerifiedConsequence {
  effectFingerprint: string;
  verifiedAtEpochMs: number;
  verificationSource: string;
}

export interface EffectivenessMeasurement {
  verdict: EffectivenessVerdict;
  objective: string;
  observedMetric?: { key: string; value: number; unit: string };
  threshold?: { operator: ">=" | ">" | "==" | "<=" | "<"; target: number };
  measuredAtEpochMs: number;
  notes?: string;
}

export interface OutcomeEvidence {
  readonly kind: "OUTCOME_EVIDENCE";
  readonly id: string;
  readonly capabilityId: string;
  readonly resolves: readonly string[];
  readonly verifiedConsequence: VerifiedConsequence;
  readonly measurement: EffectivenessMeasurement;
  readonly [outcomeEvidenceBrand]: true;
}

/**
 * Record measured outcome as EVIDENCE. Requires a verified consequence: an
 * exact authorized effect was observed, not merely claimed. The returned
 * value has no resolve/execute/artifact/authorize surface and is not
 * assignable to any authority type.
 */
export function recordOutcomeEvidence(input: {
  id: string;
  capabilityId: string;
  resolves: readonly string[];
  verifiedConsequence: VerifiedConsequence;
  measurement: EffectivenessMeasurement;
}): OutcomeEvidence {
  if (!input.verifiedConsequence.effectFingerprint) {
    throw new Error("Outcome evidence requires a verified consequence fingerprint.");
  }
  return Object.freeze({
    kind: "OUTCOME_EVIDENCE" as const,
    id: input.id,
    capabilityId: input.capabilityId,
    resolves: Object.freeze([...input.resolves]),
    verifiedConsequence: { ...input.verifiedConsequence },
    measurement: { ...input.measurement },
    [outcomeEvidenceBrand]: true as const,
  });
}

// ---- Question 4: GOVERNANCE (the only promotion cause) ----------------

export interface GovernanceDecision {
  readonly kind: "GOVERNANCE_DECISION";
  readonly id: string;
  readonly evidenceId: string;
  readonly approval: GovernanceApproval;
  readonly decidedBy: string;
  readonly rationale: string;
  readonly decidedAtEpochMs: number;
  readonly [governanceDecisionBrand]: true;
}

export function issueGovernanceDecision(input: {
  id: string;
  evidenceId: string;
  approval: GovernanceApproval;
  decidedBy: string;
  rationale: string;
  decidedAtEpochMs: number;
}): GovernanceDecision {
  if (!input.decidedBy.trim()) {
    throw new Error("A governance decision requires a named decider.");
  }
  return Object.freeze({
    kind: "GOVERNANCE_DECISION" as const,
    id: input.id,
    evidenceId: input.evidenceId,
    approval: input.approval,
    decidedBy: input.decidedBy,
    rationale: input.rationale,
    decidedAtEpochMs: input.decidedAtEpochMs,
    [governanceDecisionBrand]: true as const,
  });
}

// ---- Promotion gate ---------------------------------------------------

export interface PromotionDecision {
  readonly kind: "PROMOTION_DECISION";
  readonly candidateId: string;
  readonly targetState: PromotionState;
  readonly evidenceId: string;
  readonly governanceId: string;
  readonly [promotionDecisionBrand]: true;
}

/**
 * The ONLY promotion path. Governance is the cause; effectiveness evidence is
 * a required input that informs it. Neither alone suffices:
 *   - EFFECTIVE evidence without APPROVED governance → no promotion.
 *   - APPROVED governance without EFFECTIVE evidence → no promotion.
 *
 * The returned PromotionDecision records that promotion is justified. It is
 * still not authority, and never a CommitAuthorization: ACTIVATED resolution
 * authority requires the separate activateResolutionAuthority path, and any
 * consequence still requires a fresh AUTHORIZED Commit.
 */
export function governCandidate(
  candidate: CandidateCapability,
  evidence: OutcomeEvidence,
  decision: GovernanceDecision,
): PromotionDecision {
  if (evidence.capabilityId !== candidate.id) {
    throw new Error("Effectiveness evidence must describe this candidate.");
  }
  if (decision.evidenceId !== evidence.id) {
    throw new Error("Governance decision must reference this evidence.");
  }
  if (evidence.measurement.verdict !== "EFFECTIVE") {
    throw new Error("Ineffective or indeterminate resolutions are not promotable.");
  }
  if (decision.approval !== "APPROVED") {
    throw new Error("Only an APPROVED governance decision may promote.");
  }
  return Object.freeze({
    kind: "PROMOTION_DECISION" as const,
    candidateId: candidate.id,
    targetState: "APPROVED" as const,
    evidenceId: evidence.id,
    governanceId: decision.id,
    [promotionDecisionBrand]: true as const,
  });
}
