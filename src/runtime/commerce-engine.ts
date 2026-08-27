import type { AuthorizedEffect, ExecutionAdapter, ExecutionResult } from "../execution/contracts";
import { SimulatedExecutionAdapter } from "../execution/simulated-adapter";
import { DeterministicExecutionRouter, type ExecutionRouter } from "../execution/execution-router";
import { AuthorizationArtifactIssuer, InMemoryAuthorizationArtifactStore, stableFingerprint } from "../xact/authorization-artifact";
import {
  commerceScenarioPack,
  type CommerceScenarioInputs,
  type CommerceScenarioState,
  type RefundEffect,
} from "../scenarios/commerce-v1";
import type { AuthorizationArtifact, DecisionCandidate, EvidenceRecord } from "../xact/contracts";
import type {
  AuthorizationAssessment,
  EvidenceProvider,
  PolicyProvider,
  VerificationProvider,
  VerificationResult,
  ResolutionEvidenceProvider,
} from "../xact/providers";
import { SimulationDecisionProvider } from "../xact/simulation-decision-provider";
import type { RuntimeTraceEvent, SimulationSession } from "./contracts";
import type { TelemetryProvider } from "../telemetry/contracts";
import { PerformanceTelemetryProvider } from "../telemetry/performance-telemetry-provider";

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
  verify({ candidate, before, after, execution, observation }: {
    pack: typeof commerceScenarioPack;
    candidate: DecisionCandidate<CommerceScenarioInputs, RefundEffect>;
    before: CommerceScenarioState;
    after: CommerceScenarioState;
    execution: ExecutionResult;
    observation: import("../execution/contracts").ExecutionObservation;
  }): VerificationResult {
    const expectedAmount = candidate.proposedEffect.amount;
    const stateDelta = Number((after.refundedAmount - before.refundedAmount).toFixed(2));
    const receiptBound = Boolean(execution.receipt && after.lastReceipt === String(execution.receipt));
    const observationBound = observation.receipt === execution.receipt
      && observation.effectFingerprint === stableFingerprint(candidate.proposedEffect)
      && observation.target === candidate.proposedEffect.target;
    const exactAmount = stateDelta === expectedAmount;
    const forcedMismatch = !candidate.request.inputs.verificationShouldPass;
    const verified = execution.executed && receiptBound && observationBound && exactAmount && !forcedMismatch;

    return {
      verified,
      reason: verified
        ? "Observed simulated effect matches the authorized candidate exactly."
        : "Execution occurred, but exact post-effect verification did not pass.",
      checks: [
        `Execution receipt ${receiptBound ? "bound" : "missing"}`,
        `Observed receipt ${observationBound ? "matches" : "does not match"} execution record`,
        `Refund delta ${exactAmount ? "matches" : "does not match"} $${expectedAmount.toFixed(2)}`,
        forcedMismatch ? "Forced mismatch fixture is active" : "No forced mismatch",
      ],
    };
  }
}

export class CommerceSimulationEngine {
  private readonly provider: SimulationDecisionProvider<CommerceScenarioInputs, CommerceScenarioState, RefundEffect>;
  private readonly evidenceProvider = new CommerceSimulationEvidenceProvider();
  private readonly verificationProvider = new CommerceSimulationVerificationProvider();
  private readonly executionAdapters: ExecutionAdapter[];
  private readonly router: ExecutionRouter;
  private readonly store: InMemoryAuthorizationArtifactStore;
  private readonly issuer: AuthorizationArtifactIssuer;
  private readonly telemetryProvider: TelemetryProvider;
  private readonly resolutionEvidenceProvider?: ResolutionEvidenceProvider<CommerceScenarioInputs>;

  constructor(options: CommerceEngineOptions = {}) {
    this.store = options.store ?? new InMemoryAuthorizationArtifactStore();
    this.issuer = new AuthorizationArtifactIssuer(this.store);
    const defaultAdapter = options.executionAdapter
      ?? new SimulatedExecutionAdapter(commerceScenarioPack.preferredSubstrate, this.store);
    this.executionAdapters = [defaultAdapter, ...(options.additionalAdapters ?? [])];
    this.router = options.router ?? new DeterministicExecutionRouter();
    this.telemetryProvider = options.telemetryProvider ?? new PerformanceTelemetryProvider();
    this.resolutionEvidenceProvider = options.resolutionEvidenceProvider;
    this.provider = new SimulationDecisionProvider(
      commerceScenarioPack,
      new CommerceSimulationPolicyProvider(),
      this.telemetryProvider,
    );
  }

  createSession(overrides: Partial<CommerceScenarioInputs> = {}): CommerceSession {
    const currentState = commerceScenarioPack.createInitialState();
    return {
      phase: "READY",
      inputs: { ...commerceScenarioPack.createInitialInputs(), ...overrides },
      currentState,
      currentStateFingerprint: commerceScenarioPack.stateFingerprint(currentState),
      selectedSubstrate: "NONE",
      telemetry: [],
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
      telemetry: [],
      trace: this.append(session.trace, "Input", "Changed", "Inputs changed; prior candidate and decision invalidated."),
    };
  }

  async resolve(session: CommerceSession): Promise<CommerceSession> {
    const checkpoint = this.telemetryProvider.checkpoint();
    const resolutionEvidence = await this.resolutionEvidenceProvider?.collect(session.inputs) ?? [];
    const candidate = await this.provider.resolve(
      session.inputs,
      session.currentState,
      resolutionEvidence,
    );
    const counts = candidate.resolution;
    return {
      ...session,
      phase: "RESOLVED",
      candidate,
      decision: undefined,
      selectedSubstrate: "NONE",
      execution: undefined,
      verification: undefined,
      telemetry: this.captureTelemetry(session, checkpoint),
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

    const checkpoint = this.telemetryProvider.checkpoint();
    const baseDecision = await this.provider.commit(session.candidate, session.currentState);
    const decision = baseDecision.status === "AUTHORIZED"
      ? { ...baseDecision, artifact: this.issueArtifact(baseDecision.candidate) }
      : baseDecision;
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
      telemetry: this.captureTelemetry(session, checkpoint),
      currentStateFingerprint: commerceScenarioPack.stateFingerprint(session.currentState),
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

    const checkpoint = this.telemetryProvider.checkpoint();
    const evidence = await this.telemetryProvider.measure(
      "REASONING",
      () => this.evidenceProvider.collect(session.candidate as DecisionCandidate<CommerceScenarioInputs, RefundEffect>),
    );
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
      telemetry: this.captureTelemetry(session, checkpoint),
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
      currentStateFingerprint: commerceScenarioPack.stateFingerprint(currentState),
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
    if (session.execution) {
      throw new Error("This AUTHORIZED decision has already been presented to execution; a fresh Commit decision is required.");
    }

    if (
      session.currentStateFingerprint !== session.decision.currentStateFingerprint
      || commerceScenarioPack.stateFingerprint(session.currentState) !== session.decision.currentStateFingerprint
    ) {
      throw new Error("Current state changed after Commit; a fresh Commit decision is required.");
    }

    const authorizedCandidate = session.decision.candidate;
    const artifact = session.decision.artifact;
    if (!artifact) {
      throw new Error("An AUTHORIZED decision must carry an AuthorizationArtifact before execution.");
    }

    const effect: AuthorizedEffect = {
      artifact,
      substrate: session.selectedSubstrate,
      payload: authorizedCandidate.proposedEffect,
    };

    const selection = await this.router.select(effect, this.executionAdapters);
    if (!selection.adapter || !selection.effect) {
      return this.executionFailed(
        session,
        { executed: false, substrate: session.selectedSubstrate, error: selection.reason },
        `Execution routing failed closed: ${selection.reason}`,
      );
    }

    const validation = await selection.adapter.validate(
      artifact,
      selection.effect.payload,
      session.currentStateFingerprint,
    );
    if (!validation.valid) {
      // A guard rejection is not an adapter runtime failure. It is a hard
      // consequence-boundary block, so callers cannot mistake it for an
      // attempted execution with an ambiguous outcome.
      throw new Error(`Execution validation failed: ${validation.reason ?? "unknown guard failure"}`);
    }

    const execution = await selection.adapter.execute(selection.effect);
    if (!execution.executed) {
      return this.executionFailed(
        session,
        execution,
        `Execution adapter caused no effect: ${execution.error ?? "unknown adapter failure"}`,
      );
    }

    const before = session.currentState;
    const after = commerceScenarioPack.applyEffect(
      before,
      authorizedCandidate.proposedEffect,
      execution.receipt,
    );
    const observation = await selection.adapter.observe(selection.effect, execution);
    const checkpoint = this.telemetryProvider.checkpoint();
    const verification = await this.telemetryProvider.measure(
      "VERIFICATION",
      () => this.verificationProvider.verify({
        pack: commerceScenarioPack,
        candidate: authorizedCandidate,
        before,
        after,
        execution,
        observation,
      }),
    );
    const executedTrace = this.append(
      session.trace,
      "Execute",
      execution.substrate,
      "Simulated adapter applied the already-authorized effect.",
    );

    return {
      ...session,
      phase: verification.verified ? "VERIFIED" : "VERIFICATION_FAILED",
      selectedSubstrate: execution.substrate,
      currentState: after,
      currentStateFingerprint: commerceScenarioPack.stateFingerprint(after),
      execution,
      verification,
      telemetry: this.captureTelemetry(session, checkpoint),
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

  /**
   * An execution failure is deliberately not a new Commit decision. The prior
   * AUTHORIZED decision remains inspectable, while the runtime records that no
   * effect was caused and no verification success may be claimed.
   */
  private executionFailed(
    session: CommerceSession,
    execution: ExecutionResult,
    detail: string,
  ): CommerceSession {
    return {
      ...session,
      phase: "EXECUTION_FAILED",
      execution,
      verification: undefined,
      trace: this.append(session.trace, "Execute", "FAILED", detail),
    };
  }

  private captureTelemetry(session: CommerceSession, checkpoint: number) {
    return [...session.telemetry, ...this.telemetryProvider.samplesSince(checkpoint)];
  }

  private issueArtifact(candidate: DecisionCandidate<CommerceScenarioInputs, RefundEffect>): AuthorizationArtifact {
    return this.issuer.issue({
      commitId: candidate.candidateId,
      effectFingerprint: stableFingerprint(candidate.proposedEffect),
      baseStateFingerprint: candidate.baseStateFingerprint,
      actor: "support.agent",
      capability: "refund:create",
    });
  }
}

export interface CommerceEngineOptions {
  executionAdapter?: ExecutionAdapter;
  additionalAdapters?: ExecutionAdapter[];
  router?: ExecutionRouter;
  store?: InMemoryAuthorizationArtifactStore;
  telemetryProvider?: TelemetryProvider;
  resolutionEvidenceProvider?: ResolutionEvidenceProvider<CommerceScenarioInputs>;
}

export function createCommerceSimulationEngine(options?: CommerceEngineOptions): CommerceSimulationEngine {
  return new CommerceSimulationEngine(options);
}

export type { CommerceSession };
