export type OAgentFinding = "SUPPORTED" | "NOT_SUPPORTED" | "INSUFFICIENT_EVIDENCE";
export type PublicCommitStatus = "AUTHORIZED" | "REJECTED" | "ESCALATED" | "STALE";

export interface PublicOAgentEvidenceInput {
  caseId: string;
  candidateId: string;
  baseStateHash: string;
  unresolvedKey: string;
  finding: OAgentFinding;
  rationale: string;
  evidenceRefs: string[];
}

const REQUIRED_SUPPORT_REFS = [
  "delivery-promise",
  "carrier-delivery",
  "service-recovery-policy",
] as const;

export const PUBLIC_O_AGENT_CASE = {
  caseId: "commerce-refund-ambiguous-v1",
  candidateId: "candidate:commerce-refund-ambiguous-v1:state-v1:r0",
  baseStateHash: "commerce:v1:balance=86.40:refunded=0.00",
  unresolved: {
    key: "refund-rationale",
    reason: "The service-recovery rationale conflicts with the otherwise complete deterministic record.",
    question: "Does the verified two-day delivery delay support the requested service-recovery refund under the supplied policy?",
  },
  evidence: [
    {
      id: "delivery-promise",
      claim: "The verified delivery promise was June 12.",
      source: "Public-safe simulated order record",
      kind: "verified",
    },
    {
      id: "carrier-delivery",
      claim: "The verified carrier delivery timestamp was June 14, two days after the promise.",
      source: "Public-safe simulated carrier record",
      kind: "verified",
    },
    {
      id: "service-recovery-policy",
      claim: "The simulated policy permits a service-recovery refund up to $75 when verified delivery missed its promise.",
      source: "Public-safe Commerce Policy v3.4",
      kind: "verified",
    },
  ],
} as const;

export function buildPublicOAgentBrief() {
  return {
    caseId: PUBLIC_O_AGENT_CASE.caseId,
    candidateId: PUBLIC_O_AGENT_CASE.candidateId,
    baseStateHash: PUBLIC_O_AGENT_CASE.baseStateHash,
    role: {
      chatgpt: "O_AGENT_REASONING" as const,
      authority: "XACT_COMMIT_ONLY" as const,
    },
    request: {
      intent: "Evaluate an ambiguous $42 service-recovery refund request.",
      proposedEffect: { type: "REFUND", amount: 42, rail: "ORIGINAL" },
    },
    resolution: {
      resolved: [
        { key: "refundAmount", value: 42, source: "reported" },
        { key: "policyLimit", value: 75, source: "verified" },
        { key: "refundableBalance", value: 86.4, source: "verified" },
        { key: "authorityState", value: "ALLOWED", source: "verified" },
        { key: "capability", value: "refund:create", source: "verified" },
      ],
      unresolved: [PUBLIC_O_AGENT_CASE.unresolved],
      commitConstraints: [
        { key: "refund-limit", condition: "limit", satisfied: true, description: "$42 must not exceed the $75 policy limit." },
        { key: "refundable-balance", condition: "limit", satisfied: true, description: "$42 must not exceed the current $86.40 refundable balance." },
        { key: "authority", condition: "authority", satisfied: true, description: "Actor authority must be known and allowed at Commit." },
        { key: "capability", condition: "required", satisfied: true, description: "The refund:create capability must be present." },
        { key: "candidate-freshness", condition: "freshness", satisfied: true, description: "Current state must match the Resolve binding." },
      ],
    },
    evidence: PUBLIC_O_AGENT_CASE.evidence,
    reasoningContract: {
      reasonOnlyOver: "U" as const,
      requiredOutput: ["finding", "rationale", "evidenceRefs"],
      allowedFindings: ["SUPPORTED", "NOT_SUPPORTED", "INSUFFICIENT_EVIDENCE"] as const,
      outputIsEvidenceOnly: true as const,
      grantsAuthority: false as const,
      nextTool: "submit_o_agent_evidence" as const,
    },
  };
}

function check(key: "resolution" | "policy" | "authority" | "capability" | "freshness", outcome: "PASS" | "FAIL" | "HOLD", detail: string) {
  return { key, outcome, detail } as const;
}

export function evaluatePublicOAgentEvidence(input: PublicOAgentEvidenceInput) {
  const bindingMatches = input.caseId === PUBLIC_O_AGENT_CASE.caseId
    && input.candidateId === PUBLIC_O_AGENT_CASE.candidateId
    && input.baseStateHash === PUBLIC_O_AGENT_CASE.baseStateHash
    && input.unresolvedKey === PUBLIC_O_AGENT_CASE.unresolved.key;
  const submittedRefs = new Set(input.evidenceRefs);
  const hasRequiredSupport = REQUIRED_SUPPORT_REFS.every((ref) => submittedRefs.has(ref));

  let status: PublicCommitStatus;
  let reason: string;
  let reentryAllowed: boolean;
  let checks;

  if (!bindingMatches) {
    status = "STALE";
    reason = "The submitted evidence does not match the state-bound candidate. Fresh resolution is required.";
    reentryAllowed = true;
    checks = [
      check("freshness", "FAIL", "Candidate or state binding does not match the current public-safe case."),
      check("resolution", "HOLD", "Semantic evidence was not considered after the stale guard failed."),
    ];
  } else if (input.finding === "INSUFFICIENT_EVIDENCE" || !hasRequiredSupport) {
    status = "ESCALATED";
    reason = "The unresolved semantic field remains open because the structured evidence is insufficient.";
    reentryAllowed = true;
    checks = [
      check("freshness", "PASS", "Current state matches the candidate binding."),
      check("resolution", "HOLD", "The refund rationale remains unresolved."),
      check("authority", "PASS", "Simulated authority registry reports ALLOWED."),
      check("capability", "PASS", "refund:create capability is present."),
    ];
  } else if (input.finding === "NOT_SUPPORTED") {
    status = "REJECTED";
    reason = "Xact Commit rejected the current request because the structured finding does not support the service-recovery rationale.";
    reentryAllowed = false;
    checks = [
      check("freshness", "PASS", "Current state matches the candidate binding."),
      check("resolution", "PASS", "The semantic question was resolved by structured evidence."),
      check("policy", "FAIL", "The resolved rationale does not satisfy the simulated service-recovery policy."),
      check("authority", "PASS", "Simulated authority registry reports ALLOWED."),
      check("capability", "PASS", "refund:create capability is present."),
    ];
  } else {
    status = "AUTHORIZED";
    reason = "Xact Commit passed all public-safe checks against current state. This bridge did not execute the effect.";
    reentryAllowed = false;
    checks = [
      check("freshness", "PASS", "Current state matches the candidate binding."),
      check("resolution", "PASS", "The semantic question was resolved by structured evidence."),
      check("policy", "PASS", "The $42 refund is within policy and the verified rationale is supported."),
      check("authority", "PASS", "Simulated authority registry reports ALLOWED."),
      check("capability", "PASS", "refund:create capability is present."),
    ];
  }

  return {
    caseId: PUBLIC_O_AGENT_CASE.caseId,
    candidateId: PUBLIC_O_AGENT_CASE.candidateId,
    reentryCount: bindingMatches ? 1 : 0,
    reasoningEvidence: {
      source: "ChatGPT O-Agent" as const,
      finding: input.finding,
      rationale: input.rationale,
      evidenceRefs: input.evidenceRefs,
      resolves: input.unresolvedKey,
      evidenceOnly: true as const,
      grantsAuthority: false as const,
    },
    commit: {
      status,
      reason,
      checks,
      currentStateHash: PUBLIC_O_AGENT_CASE.baseStateHash,
      reentryAllowed,
      authoritySource: "XACT_COMMIT" as const,
    },
    execution: {
      status: "NOT_EXECUTED" as const,
      effectReleased: false as const,
      detail: status === "AUTHORIZED"
        ? "An authorized effect may proceed only through a separate execution router; this public bridge did not execute it."
        : "No effect may proceed without an AUTHORIZED Xact Commit decision.",
    },
  };
}
