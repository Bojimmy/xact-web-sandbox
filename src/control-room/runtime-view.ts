import type { CommerceSession } from "../runtime/commerce-engine";
import type { CommitCheck, ResolvedFact } from "../xact/contracts";
import type {
  ControlRoomScenario,
  ControlRoomStatus,
  DisplayFact,
  StepState,
} from "./types";

function money(value: number): string {
  return `$${value.toFixed(2)}`;
}

function displayValue(fact: ResolvedFact): string {
  if (typeof fact.value === "number" && ["refundAmount", "policyLimit", "refundableBalance"].includes(fact.key)) {
    return money(fact.value);
  }
  return String(fact.value);
}

function displayLabel(key: string): string {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
}

function displayFact(fact: ResolvedFact): DisplayFact {
  return {
    label: displayLabel(fact.key),
    value: displayValue(fact),
    source: fact.source,
    provenance: fact.provenance ?? "Simulation runtime",
  };
}

function formatCheck(check: CommitCheck | undefined, fallback: string): string {
  return check ? `${check.outcome} · ${check.detail}` : fallback;
}

function titleFor(status: ControlRoomStatus, phase: CommerceSession["phase"]): string {
  if (phase === "EXECUTION_FAILED") return "Authorized candidate did not execute";
  if (status === "AUTHORIZED") return "Current candidate is authorized";
  if (status === "REJECTED") return "Current request is finally denied";
  if (status === "ESCALATED") return "Additional evidence or authority required";
  if (status === "STALE") return "Candidate is stale against current state";
  if (phase === "REENTERED") return "Evidence rebound for a new Commit decision";
  if (phase === "RESOLVED") return "Candidate resolved and bound to state";
  return "Mutable Commerce scenario ready";
}

function decisionCopy(status: ControlRoomStatus, session: CommerceSession) {
  if (status === "AUTHORIZED") {
    if (session.phase === "EXECUTION_FAILED") {
      return {
        finality: "PENDING" as const,
        label: "Execution failed closed",
        nextStep: "No effect was caused. Review the execution error and obtain a fresh Commit decision before retrying.",
      };
    }
    return {
      finality: "PASSED" as const,
      label: session.verification?.verified ? "Effect verified" : "Effect may proceed",
      nextStep: session.verification?.verified
        ? "The simulated effect matches the authorized candidate."
        : "Execute the simulated effect, then verify it independently.",
    };
  }
  if (status === "REJECTED") {
    return {
      finality: "FINAL" as const,
      label: "Final denial",
      nextStep: "Change the request, policy, authority, or state before resolving a new candidate.",
    };
  }
  if (status === "ESCALATED") {
    return {
      finality: "REENTRY_ALLOWED" as const,
      label: "Re-entry available",
      nextStep: session.candidate?.resolution.unresolved.length
        ? "Add structured reasoning evidence, re-enter Xact, then request a new Commit decision."
        : "Supply governed authority evidence, resolve a new candidate, then request a new Commit decision.",
    };
  }
  if (status === "STALE") {
    return {
      finality: "RERESOLUTION_REQUIRED" as const,
      label: "Fresh resolution required",
      nextStep: "Resolve against current state before proposing another candidate.",
    };
  }
  return {
    finality: "PENDING" as const,
    label: session.phase === "REENTERED" ? "New Commit required" : "No Commit decision yet",
    nextStep: session.candidate ? "Evaluate the candidate against current state at Commit." : "Resolve the mutable inputs to create a state-bound candidate.",
  };
}

function traceState(phase: CommerceSession["trace"][number]["phase"], outcome: string): StepState {
  if (["REJECTED", "STALE", "FAILED"].includes(outcome)) return "blocked";
  if (phase === "Commit" && outcome === "ESCALATED") return "active";
  return "complete";
}

export function toControlRoomScenario(session: CommerceSession): ControlRoomScenario {
  const candidate = session.candidate;
  const decision = session.decision;
  const status: ControlRoomStatus = decision?.status ?? "PENDING";
  const resolution = candidate?.resolution ?? {
    resolved: [],
    unresolved: [],
    commitConstraints: [],
  };
  const policyCheck = decision?.checks.find((check) => check.key === "policy");
  const authorityCheck = decision?.checks.find((check) => check.key === "authority");
  const capabilityCheck = decision?.checks.find((check) => check.key === "capability");
  const freshnessCheck = decision?.checks.find((check) => check.key === "freshness");
  const decisionSemantics = decisionCopy(status, session);
  const proposedEffect = candidate?.proposedEffect;

  return {
    id: "runtime",
    index: "R2",
    label: "Mutable runtime",
    title: titleFor(status, session.phase),
    description: decision?.reason ?? "Change inputs, Resolve a candidate, then Commit against current state.",
    status,
    request: {
      id: candidate?.candidateId ?? "runtime_unresolved",
      intent: candidate?.request.intent ?? "Simulated Commerce V1 request",
      actor: "support.agent / mutable",
      target: "order #XC-MUTABLE",
      proposedEffect: `Issue ${money(session.inputs.refundAmount)} to original payment method`,
    },
    resolution: {
      resolved: resolution.resolved.map(displayFact),
      unresolved: resolution.unresolved.map((field) => ({ label: displayLabel(field.key), detail: field.reason })),
      commitConstraints: resolution.commitConstraints.map((constraint) => ({
        label: displayLabel(constraint.key),
        detail: constraint.description,
        condition: constraint.condition,
        satisfied: constraint.key === "candidate-freshness" && candidate
          ? candidate.baseStateFingerprint === session.currentStateFingerprint
          : constraint.satisfied,
      })),
    },
    evidence: (candidate?.evidence ?? []).map((item, index) => ({
      id: item.id,
      claim: item.claim,
      source: `${item.source} / ${item.provenance}`,
      kind: item.kind,
      boundAt: `#${String(index + 1).padStart(2, "0")}`,
    })),
    reasoning: {
      involved: Boolean(candidate?.reasoningEvidence.length),
      summary: candidate?.reasoningEvidence.length ? `Re-entry ${candidate.reentryCount}` : "Not invoked",
      output: candidate?.reasoningEvidence.length
        ? "Structured evidence resolved U and returned to Xact; it did not grant authority."
        : resolution.unresolved.length
          ? "U is isolated. Reasoning evidence may be collected only before governed re-entry."
          : "U = 0. No semantic interpretation required.",
    },
    commit: {
      summary: decision?.reason ?? "Commit has not evaluated this candidate.",
      policy: formatCheck(policyCheck, "PENDING · not evaluated"),
      authority: formatCheck(authorityCheck, "PENDING · not evaluated"),
      capability: formatCheck(capabilityCheck, "PENDING · not evaluated"),
      stateBinding: formatCheck(freshnessCheck, candidate ? "PENDING · compare at Commit" : "PENDING · resolve first"),
      baseFingerprint: candidate?.baseStateFingerprint ?? "—",
      currentFingerprint: session.currentStateFingerprint,
    },
    decision: decisionSemantics,
    execution: {
      selected: session.selectedSubstrate,
      effect: proposedEffect ? `${proposedEffect.type.toLowerCase()} ${money(proposedEffect.amount)}` : "No candidate effect",
      executed: Boolean(session.execution?.executed),
      receipt: session.execution?.receipt ? String(session.execution.receipt) : "—",
      authorization: decision?.artifact && proposedEffect
        ? {
            commitId: decision.artifact.commitId,
            effectFingerprint: decision.artifact.effectFingerprint,
            target: proposedEffect.target,
          }
        : undefined,
    },
    trace: session.trace.map((event) => ({
      phase: event.phase,
      outcome: event.outcome,
      detail: event.detail,
      at: `#${String(event.sequence).padStart(2, "0")}`,
      state: traceState(event.phase, event.outcome),
    })),
    verification: session.verification
      ? {
          state: session.verification.verified ? "VERIFIED" : "FAILED",
          summary: session.verification.reason,
          checks: session.verification.checks,
        }
      : session.phase === "EXECUTION_FAILED"
        ? {
            state: "FAILED",
            summary: session.execution?.error ?? "Execution failed before an effect could be observed.",
            checks: ["No execution receipt", "No simulated effect applied", "Verification success withheld"],
          }
        : {
          state: status === "REJECTED" || status === "STALE" ? "BLOCKED" : "NOT_RUN",
          summary: status === "AUTHORIZED"
            ? "Authorized effect has not executed yet."
            : "Verification requires a simulated effect released by an Authorized Commit.",
          checks: ["No verified effect yet"],
        },
  };
}
