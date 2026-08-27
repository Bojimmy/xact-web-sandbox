import type { AuthorizedEffect, ExecutionAdapter, ExecutionResult } from "../execution/contracts";
import { SimulatedExecutionAdapter } from "../execution/simulated-adapter";
import {
  commerceScenarioPack,
  type CommerceScenarioInputs,
  type CommerceScenarioState,
  type RefundEffect,
} from "../scenarios/commerce-v1";
import type { DecisionCandidate, EvidenceRecord } from "../xact/contracts";
import type {
  AuthorizationAssessment,
  EvidenceProvider,
  PolicyProvider,
  VerificationProvider,
  VerificationResult,
} from "../xact/providers";
import { SimulationDecisionProvider } from "../xact/simulation-decision-provider";
import type { RuntimeTraceEvent, SimulationSession } from "./contracts";

type CommerceSession = SimulationSession<CommerceScenarioInputs, CommerceScenarioState, RefundEffect>;

class CommerceSimulationPolicyProvider
  implements PolicyProvider<CommerceScenarioInputs, CommerceScenarioState, RefundEffect>
{
  authorize({ candidate, currentState }: { candidate: DecisionCandidate<CommerceScenarioInputs, RefundEffect>; currentState: CommerceScenarioState }): AuthorizationAssessment {
    const inputs = candidate.request.inputs;
    const withinLimit = inputs.refundAmount > 0 && inputs.refundAmount <= inputs.policyLimit;
    const withinBalance = inputs.refundAmount <= currentState.refundableBalance;
    const policyAllowed = withinLimit && withinBalance;
    const capabilityAllowed = inputs.capabilityAvailable;

    const checks: AuthorizationAssessment["checks"] = [
      {
        key: "policy",
        outcome: policyAllowed ? "PASS" : "FAIL",
        detail: policyAllowed
          ? `$${inputs.refundAmount.toFixed(2)} is within the explicit limit and current refundable balance.`
          : `$${inputs.refundAmount.toFixed(2)} violates the explicit limit or current refundable balance.`,
      },
      {
        key: "authority",
        outcome: inputs.authorityState === "ALLOWED" ? "PASS" : inputs.authorityState === "UNKNOWN" ? "HOLD" : "FAIL",
        detail: `Simulated authority registry reports ${inputs.authorityState}.`,
      },
      {
        key: "capability",
        outcome: capabilityAllowed ? "PASS" : "FAIL",
        detail: capabilityAllowed
          ? "refund:create capability is present."
          : "refund:create capability is absent.",
      },
    ];

    if (inputs.authorityState === "UNKNOWN") {
      return { outcome: "UNKNOWN", reason: "Authority state is unknown.", checks };
    }

    if (!policyAllowed || inputs.authorityState === "DENIED" || !capabilityAllowed) {
      return {
        outcome: "DENIED",
        reason: "Final denial under the current request, policy, authority, and capability state.",
        checks,
      };
    }

    return { outcome: "ALLOWED", reason: "Policy, authority, and capability pass.", checks };
  }
}

class CommerceSimulationEvidenceProvider
  implements EvidenceProvider<CommerceScenarioInputs, RefundEffect>
{
  collect(candidate: DecisionCandidate<CommerceScenarioInputs, RefundEffect>): EvidenceRecord[] {
    if (!candidate.resolution.unresolved.some((field) => field.key === "refund-rationale")) {
      return [];
    }

    return [{
      id: `ev-reasoning-r${candidate.reentryCount + 1}`,
      claim: "The ambiguous service-recovery rationale is consistent with the simulated delivery record.",
      source: "Simulation O-Agent",
      kind: "derived",
      provenance: "Public-safe deterministic reasoning fixture",
      resolves: ["refund-rationale"],
    }];
  }
}

class CommerceSimulationVerificationProvider
  implements VerificationProvider<CommerceScenarioInputs, CommerceScenarioState, RefundEffect, ExecutionResult>
{
  verify({ candidate, before, after, execution }: {
    pack: typeof commerceScenarioPack;
    candidate: DecisionCandidate<CommerceScenarioInputs, RefundEffect>;
    before: CommerceScenarioState;
    after: CommerceScenarioState;
    execution: ExecutionResult;
  }): VerificationResult {
    const expectedAmount = candidate.proposedEffect.amount;
    const stateDelta = Number((after.refundedAmount - before.refundedAmount).toFixed(2));
    const receiptBound = Boolean(execution.receipt && after.lastReceipt === String(execution.receipt));
    const exactAmount = stateDelta === expectedAmount;
    const forcedMismatch = !candidate.request.inputs.verificationShouldPass;
    const verified = execution.executed && receiptBound && exactAmount && !forcedMismatch;

    return {
      verified,
      reason: verified
        ? "Observed simulated effect matches the authorized candidate exactly."
        : "Execution occurred, but exact post-effect verification did not pass.",
      checks: [
        `Execution receipt ${receiptBound ? "bound" : "missing"}`,
        `Refund delta ${exactAmount ? "matches" : "does not match"} $${expectedAmount.toFixed(2)}`,
        forcedMismatch ? "Forced mismatch fixture is active" : "No forced mismatch",
      ],
    };
  }
}

export class CommerceSimulationEngine {
  private readonly provider = new SimulationDecisionProvider(
    commerceScenarioPack,
    new CommerceSimulationPolicyProvider(),
  );
  private readonly evidenceProvider = new CommerceSimulationEvidenceProvider();
  private readonly verificationProvider = new CommerceSimulationVerificationProvider();

  constructor(
    private readonly executionAdapter: ExecutionAdapter = new SimulatedExecutionAdapter(
      commerceScenarioPack.preferredSubstrate,
    ),
  ) {}

  createSession(overrides: Partial<CommerceScenarioInputs> = {}): CommerceSession {
    const currentState = commerceScenarioPack.createInitialState();
    return {
      phase: "READY",
      inputs: { ...commerceScenarioPack.createInitialInputs(), ...overrides },
      currentState,
      currentStateHash: commerceScenarioPack.stateHash(currentState),
      selectedSubstrate: "NONE",
      trace: [{ phase: "Input", outcome: "Ready", detail: "Mutable Commerce V1 inputs initialized.", sequence: 1 }],
    };
  }

  updateInputs(session: CommerceSession, patch: Partial<CommerceScenarioInputs>): CommerceSession {
    return {
      ...session,
      phase: "READY",
      inputs: { ...session.inputs, ...patch },
      candidate: undefined,
      decision: undefined,
      selectedSubstrate: "NONE",
      execution: undefined,
      verification: undefined,
      trace: this.append(session.trace, "Input", "Changed", "Inputs changed; prior candidate and decision invalidated."),
    };
  }

  async resolve(session: CommerceSession): Promise<CommerceSession> {
    const candidate = await this.provider.resolve(session.inputs, session.currentState);
    const counts = candidate.resolution;
    return {
      ...session,
      phase: "RESOLVED",
      candidate,
      decision: undefined,
      selectedSubstrate: "NONE",
      execution: undefined,
      verification: undefined,
      trace: this.append(
        session.trace,
        "Resolve",
        `R${counts.resolved.length} · U${counts.unresolved.length} · C${counts.commitConstraints.length}`,
        "SimulationDecisionProvider produced a candidate bound to current state.",
      ),
    };
  }

  async commit(session: CommerceSession): Promise<CommerceSession> {
    if (!session.candidate) {
      throw new Error("Resolve must produce a candidate before Commit.");
    }

    const decision = await this.provider.commit(session.candidate, session.currentState);
    const selectedSubstrate = decision.status === "AUTHORIZED"
      ? commerceScenarioPack.preferredSubstrate
      : "NONE";

    return {
      ...session,
      phase: decision.status,
      decision,
      selectedSubstrate,
      execution: undefined,
      verification: undefined,
      currentStateHash: commerceScenarioPack.stateHash(session.currentState),
      trace: this.append(
        session.trace,
        "Commit",
        decision.status,
        `${decision.reason} Execution substrate: ${selectedSubstrate}.`,
      ),
    };
  }

  async addReasoningEvidenceAndReenter(session: CommerceSession): Promise<CommerceSession> {
    if (!session.candidate || session.decision?.status !== "ESCALATED") {
      throw new Error("An Escalated candidate is required before reasoning evidence may re-enter.");
    }

    const evidence = await this.evidenceProvider.collect(session.candidate);
    if (evidence.length === 0) {
      throw new Error("This escalation requires authority evidence, not semantic reasoning evidence.");
    }

    const withReasoning = this.append(
      session.trace,
      "Reason",
      "Structured evidence",
      "Simulation O-Agent proposed evidence; it did not authorize an effect.",
    );
    const candidate = await this.provider.reenter(
      session.candidate,
      session.currentState,
      evidence,
    );

    return {
      ...session,
      phase: "REENTERED",
      candidate,
      decision: undefined,
      selectedSubstrate: "NONE",
      execution: undefined,
      verification: undefined,
      trace: this.append(
        withReasoning,
        "Re-entry",
        `R${candidate.resolution.resolved.length} · U${candidate.resolution.unresolved.length} · C${candidate.resolution.commitConstraints.length}`,
        "Evidence was rebound and a new candidate was created for a new Commit decision.",
      ),
    };
  }

  simulateConcurrentChange(session: CommerceSession): CommerceSession {
    if (!session.candidate) {
      throw new Error("Resolve must bind a candidate before current state can change for the stale demonstration.");
    }

    const currentState = commerceScenarioPack.simulateConcurrentChange(session.currentState);
    return {
      ...session,
      currentState,
      currentStateHash: commerceScenarioPack.stateHash(currentState),
      decision: undefined,
      selectedSubstrate: "NONE",
      execution: undefined,
      verification: undefined,
      trace: this.append(
        session.trace,
        "State",
        `Changed to v${currentState.version}`,
        "A concurrent refund changed relevant state after Resolve and before Commit.",
      ),
    };
  }

  async executeAndVerify(session: CommerceSession): Promise<CommerceSession> {
    if (session.decision?.status !== "AUTHORIZED" || session.selectedSubstrate === "NONE") {
      throw new Error("Execution is blocked until Commit returns AUTHORIZED.");
    }

    if (
      session.currentStateHash !== session.decision.currentStateHash
      || commerceScenarioPack.stateHash(session.currentState) !== session.decision.currentStateHash
    ) {
      throw new Error("Current state changed after Commit; a fresh Commit decision is required.");
    }

    const authorizedCandidate = session.decision.candidate;

    const effect: AuthorizedEffect = {
      commitId: authorizedCandidate.candidateId,
      substrate: session.selectedSubstrate,
      payload: authorizedCandidate.proposedEffect,
    };
    const execution = await this.executionAdapter.execute(effect);
    if (!execution.executed) {
      throw new Error(execution.error ?? "Simulated execution failed.");
    }

    const before = session.currentState;
    const after = commerceScenarioPack.applyEffect(
      before,
      authorizedCandidate.proposedEffect,
      execution.receipt,
    );
    const verification = await this.verificationProvider.verify({
      pack: commerceScenarioPack,
      candidate: authorizedCandidate,
      before,
      after,
      execution,
    });
    const executedTrace = this.append(
      session.trace,
      "Execute",
      execution.substrate,
      "Simulated adapter applied the already-authorized effect.",
    );

    return {
      ...session,
      phase: verification.verified ? "VERIFIED" : "VERIFICATION_FAILED",
      currentState: after,
      currentStateHash: commerceScenarioPack.stateHash(after),
      execution,
      verification,
      trace: this.append(
        executedTrace,
        "Verify",
        verification.verified ? "VERIFIED" : "FAILED",
        verification.reason,
      ),
    };
  }

  private append(
    trace: RuntimeTraceEvent[],
    phase: RuntimeTraceEvent["phase"],
    outcome: string,
    detail: string,
  ): RuntimeTraceEvent[] {
    return [...trace, { phase, outcome, detail, sequence: trace.length + 1 }];
  }
}

export function createCommerceSimulationEngine(): CommerceSimulationEngine {
  return new CommerceSimulationEngine();
}

export type { CommerceSession };
