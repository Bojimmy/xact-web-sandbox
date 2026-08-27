import type { ExecutionSubstrate } from "../execution/contracts";
import type { ScenarioPack } from "./contracts";
import type { CommitConstraint, EvidenceRecord, ResolvedFact } from "../xact/contracts";

export type AuthorityState = "ALLOWED" | "DENIED" | "UNKNOWN";

export interface CommerceScenarioInputs {
  refundAmount: number;
  policyLimit: number;
  semanticAmbiguity: boolean;
  authorityState: AuthorityState;
  capabilityAvailable: boolean;
  verificationShouldPass: boolean;
}

export interface CommerceScenarioState {
  version: number;
  refundableBalance: number;
  refundedAmount: number;
  lastReceipt?: string;
}

export interface RefundEffect {
  type: "REFUND";
  amount: number;
  rail: "ORIGINAL";
}

const preferredSubstrate: ExecutionSubstrate = "WEBMCP";

function money(value: number): string {
  return `$${value.toFixed(2)}`;
}

export const commerceScenarioPack: ScenarioPack<
  CommerceScenarioInputs,
  CommerceScenarioState,
  RefundEffect
> = {
  id: "commerce-v1-mutable-refund",
  label: "Commerce V1 / Mutable refund",
  preferredSubstrate,

  intent: () => "Issue a refund under simulated Commerce V1 policy",

  createInitialInputs: () => ({
    refundAmount: 42,
    policyLimit: 75,
    semanticAmbiguity: false,
    authorityState: "ALLOWED",
    capabilityAvailable: true,
    verificationShouldPass: true,
  }),

  createInitialState: () => ({
    version: 1,
    refundableBalance: 86.4,
    refundedAmount: 0,
  }),

  stateFingerprint: (state) =>
    `commerce:v${state.version}:balance=${state.refundableBalance.toFixed(2)}:refunded=${state.refundedAmount.toFixed(2)}`,

  stateVersion: (state) => state.version,

  resolve: (inputs, state, resolutionEvidence) => {
    const semanticEvidence = resolutionEvidence.find((item) =>
      item.resolves?.includes("refund-rationale"),
    );
    const semanticResolved = Boolean(semanticEvidence);

    const resolved: ResolvedFact[] = [
      { key: "refundAmount", value: inputs.refundAmount, source: "reported", provenance: "Mutable request input" },
      { key: "policyLimit", value: inputs.policyLimit, source: "verified", provenance: "Simulated Commerce Policy v3.4" },
      { key: "refundableBalance", value: state.refundableBalance, source: "verified", provenance: `Simulated order state v${state.version}` },
      { key: "authorityState", value: inputs.authorityState, source: "verified", provenance: "Simulated authority registry" },
      ...(semanticEvidence
        ? [{
            key: "refundRationale",
            value: "Delivery-consistent service recovery",
            source: semanticEvidence.kind,
            provenance: `${semanticEvidence.source} / ${semanticEvidence.provenance}`,
          }]
        : []),
    ];

    const unresolved = inputs.semanticAmbiguity && !semanticResolved
      ? [{ key: "refund-rationale", reason: "The request contains an ambiguous service-recovery rationale." }]
      : [];

    const commitConstraints: CommitConstraint[] = [
      {
        key: "original-payment-rail",
        description: "Refund must return to the original payment rail.",
        condition: "required",
        satisfied: true,
        provenance: ["Simulated payment record"],
      },
      {
        key: "refund-limit",
        description: `${money(inputs.refundAmount)} must not exceed ${money(inputs.policyLimit)}.`,
        condition: "limit",
        satisfied: inputs.refundAmount <= inputs.policyLimit,
        values: [inputs.refundAmount, inputs.policyLimit],
        provenance: ["Mutable request input", "Simulated Commerce Policy v3.4"],
      },
      {
        key: "refundable-balance",
        description: `${money(inputs.refundAmount)} must not exceed the current ${money(state.refundableBalance)} refundable balance.`,
        condition: "limit",
        satisfied: inputs.refundAmount <= state.refundableBalance,
        values: [inputs.refundAmount, state.refundableBalance],
        provenance: ["Mutable request input", `Simulated order state v${state.version}`],
      },
      {
        key: "authority",
        description: "Actor authority must be known and allowed at Commit.",
        condition: "authority",
        satisfied: inputs.authorityState === "UNKNOWN" ? "unknown" : inputs.authorityState === "ALLOWED",
        provenance: ["Simulated authority registry"],
      },
      {
        key: "capability",
        description: "The actor must hold refund:create capability.",
        condition: "required",
        satisfied: inputs.capabilityAvailable,
        provenance: ["Simulated capability registry"],
      },
      {
        key: "candidate-freshness",
        description: "Current order state must match the state bound at Resolve.",
        condition: "freshness",
        satisfied: true,
        provenance: [`Simulated order state v${state.version}`],
      },
      ...(inputs.semanticAmbiguity
        ? [{
            key: "semantic-conflict",
            description: semanticResolved
              ? "Structured reasoning evidence resolves the conflicting rationale for re-entry."
              : "The request rationale conflicts with the deterministic service record.",
            condition: "conflict" as const,
            satisfied: semanticResolved,
            provenance: ["Mutable request input", "Simulated service record"],
          }]
        : []),
    ];

    const baseEvidence: EvidenceRecord[] = [
      {
        id: "ev-request-amount",
        claim: `Requested refund is ${money(inputs.refundAmount)}.`,
        source: "Mutable request",
        kind: "reported",
        provenance: "Control Room input",
      },
      {
        id: "ev-policy-limit",
        claim: `Verified simulation limit is ${money(inputs.policyLimit)}.`,
        source: "Simulation PolicyProvider",
        kind: "verified",
        provenance: "Public-safe explicit threshold",
      },
      {
        id: "ev-current-state",
        claim: `Refundable balance is ${money(state.refundableBalance)} at state v${state.version}.`,
        source: "Mutable scenario state",
        kind: "verified",
        provenance: commerceScenarioPack.stateFingerprint(state),
      },
    ];

    return {
      resolution: { resolved, unresolved, commitConstraints },
      evidence: [...baseEvidence, ...resolutionEvidence],
      proposedEffect: { type: "REFUND", amount: inputs.refundAmount, rail: "ORIGINAL" },
    };
  },

  simulateConcurrentChange: (state) => ({
    ...state,
    version: state.version + 1,
    refundedAmount: state.refundedAmount + state.refundableBalance,
    refundableBalance: 0,
    lastReceipt: "external_concurrent_refund",
  }),

  applyEffect: (state, effect, receipt) => ({
    ...state,
    version: state.version + 1,
    refundableBalance: Number(Math.max(0, state.refundableBalance - effect.amount).toFixed(2)),
    refundedAmount: Number((state.refundedAmount + effect.amount).toFixed(2)),
    lastReceipt: String(receipt),
  }),
};
