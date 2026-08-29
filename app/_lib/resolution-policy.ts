import type { CommitOutcome } from "./run";

export interface ResolutionConstraint {
  label: string;
  condition: string;
  satisfied: boolean;
}

export interface ResolutionAssessment {
  amount: number;
  orderId?: string;
  ambiguous: boolean;
  socialOverride: boolean;
  facts: string[];
  unresolved: string[];
  constraints: ResolutionConstraint[];
  commitOutcome: CommitOutcome;
  commitReason: string;
}

/** Only a genuine unresolved meaning is eligible for the O-Agent path. */
export function nextResolutionLevel(assessment: ResolutionAssessment): 2 | 3 {
  return assessment.commitOutcome === "REJECTED_CONSTRAINT" ? 2 : 3;
}

/**
 * O-Agent evidence may resolve only the genuine semantic U. It cannot cure an
 * over-limit amount or a missing order binding, and it never authorizes an
 * effect by itself.
 */
export function applyReasoningEvidence(
  assessment: ResolutionAssessment,
  reasoningCompleted: boolean,
): ResolutionAssessment {
  if (!reasoningCompleted || !assessment.ambiguous || !assessment.orderId || assessment.amount <= 0 || assessment.amount > 100) {
    return assessment;
  }
  return {
    ...assessment,
    facts: [...assessment.facts, "O-Agent evidence: customer intent bound for Commit"],
    unresolved: ["Resolved by O-Agent evidence; re-entered deterministic Commit checks"],
    constraints: assessment.constraints.map((constraint) => constraint.condition === "unambiguous"
      ? { ...constraint, label: "Customer intent resolved by O-Agent evidence", satisfied: true }
      : constraint),
    commitOutcome: "AUTHORIZED",
    commitReason: "O-Agent evidence resolved the genuine U. Policy, capability, order binding, and state checks now pass; Commit may issue consequence authority.",
  };
}

/**
 * Public-safe Resolve → Commit handoff. The same assessment powers the
 * visible decomposition and the later Commit decision; a failed constraint
 * cannot be dropped between levels.
 */
export function assessResolutionRequest(request: string): ResolutionAssessment {
  const amountMatch = request.match(/\$?(\d+(?:[,.]\d+)?)/);
  const amount = amountMatch ? Number(amountMatch[1].replace(",", "")) : 0;
  const orderMatch = request.match(/order\s*#?(\d+)/i);
  const orderId = orderMatch?.[1];
  const ambiguous = /make it right|fair|whatever you think|as you see fit/i.test(request);
  const socialOverride = /i'?m the ceo|ceo override|because i say so/i.test(request);
  const withinPolicy = amount > 0 && amount <= 100;

  const facts = [
    amountMatch ? `Refund amount: $${amount.toFixed(2)}` : "Refund amount: NOT BOUND",
    orderId ? `Order id: ${orderId}` : "Order id: NOT BOUND",
    "Capability: refund:create PRESENT",
    "Consequence authority: PENDING COMMIT",
  ];
  if (amount > 100) facts.push(`Note: $${amount.toFixed(2)} exceeds the $100 policy ceiling`);

  const unresolved = ambiguous
    ? ['"make it right" — exact amount unspecified by the customer']
    : ["None — every required field is bound"];
  const constraints = [
    { label: withinPolicy ? "Refund within $100 policy ceiling" : "Refund NOT within $100 policy ceiling", condition: `$${amount.toFixed(2)} ≤ $100`, satisfied: withinPolicy },
    { label: "Capability refund:create is PRESENT", condition: "PRESENT", satisfied: true },
    { label: "Consequence authority is PENDING COMMIT", condition: "PENDING", satisfied: true },
    { label: orderId ? "Order id is bound" : "Order id is NOT bound", condition: "bound", satisfied: Boolean(orderId) },
    { label: ambiguous ? "Customer intent is AMBIGUOUS" : "Customer intent is unambiguous", condition: "unambiguous", satisfied: !ambiguous },
  ];

  if (socialOverride) {
    return { amount, orderId, ambiguous, socialOverride, facts, unresolved, constraints, commitOutcome: "REJECTED_SOCIAL", commitReason: "Authority is not asserted by social proof. Title and persuasion do not change a Commit decision." };
  }
  if (!withinPolicy) {
    return { amount, orderId, ambiguous, socialOverride, facts, unresolved, constraints, commitOutcome: "REJECTED_EXCESS", commitReason: `Refund $${amount.toFixed(2)} does not satisfy the $100 policy ceiling. No consequence authority was issued.` };
  }
  if (!orderId || ambiguous) {
    return { amount, orderId, ambiguous, socialOverride, facts, unresolved, constraints, commitOutcome: "REJECTED_CONSTRAINT", commitReason: "Commit requires every constraint to be bound. Resolve the missing order binding or customer intent first." };
  }
  return { amount, orderId, ambiguous, socialOverride, facts, unresolved, constraints, commitOutcome: "AUTHORIZED", commitReason: "Policy, capability, order binding, and unambiguous customer intent all pass. Commit may issue consequence authority." };
}
