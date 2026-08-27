import type { ScenarioPack } from "../scenarios/contracts";
import type {
  CommitCheck,
  DecisionCandidate,
  DecisionResult,
  EvidenceRecord,
} from "./contracts";
import type { DecisionProvider, PolicyProvider } from "./providers";
import type { TelemetryProvider, TelemetryStage } from "../telemetry/contracts";

export class SimulationDecisionProvider<TInputs, TState, TEffect>
  implements DecisionProvider<TInputs, TState, TEffect>
{
  constructor(
    private readonly pack: ScenarioPack<TInputs, TState, TEffect>,
    private readonly policyProvider: PolicyProvider<TInputs, TState, TEffect>,
    private readonly telemetry?: TelemetryProvider,
  ) {}

  resolve(
    inputs: TInputs,
    state: TState,
    resolutionEvidence: EvidenceRecord[] = [],
  ): Promise<DecisionCandidate<TInputs, TEffect>> {
    return this.measure(
      "RESOLVE",
      () => this.buildCandidate(inputs, state, resolutionEvidence, [], 0),
    );
  }

  reenter(
    candidate: DecisionCandidate<TInputs, TEffect>,
    currentState: TState,
    evidence: EvidenceRecord[],
  ): Promise<DecisionCandidate<TInputs, TEffect>> {
    return this.measure(
      "REENTRY",
      () => this.buildCandidate(
        candidate.request.inputs,
        currentState,
        candidate.resolutionEvidence,
        [...candidate.reasoningEvidence, ...evidence],
        candidate.reentryCount + 1,
      ),
    );
  }

  async commit(
    candidate: DecisionCandidate<TInputs, TEffect>,
    currentState: TState,
  ): Promise<DecisionResult<TInputs, TEffect>> {
    return this.measure("COMMIT", () => this.evaluateCommit(candidate, currentState));
  }

  private async evaluateCommit(
    candidate: DecisionCandidate<TInputs, TEffect>,
    currentState: TState,
  ): Promise<DecisionResult<TInputs, TEffect>> {
    const currentStateHash = this.pack.stateHash(currentState);
    const freshnessCheck: CommitCheck = currentStateHash === candidate.baseStateHash
      ? { key: "freshness", outcome: "PASS", detail: "Current state matches the candidate binding." }
      : { key: "freshness", outcome: "FAIL", detail: "Current state no longer matches the state used at Resolve." };
    const resolutionCheck: CommitCheck = candidate.resolution.unresolved.length
      ? { key: "resolution", outcome: "HOLD", detail: `${candidate.resolution.unresolved.length} unresolved semantic field(s) require governed evidence.` }
      : { key: "resolution", outcome: "PASS", detail: "No unresolved semantics remain." };

    if (freshnessCheck.outcome === "FAIL") {
      return this.result(
        "STALE",
        candidate,
        currentStateHash,
        "Candidate state is stale. Fresh resolution is required before another Commit decision.",
        [freshnessCheck, resolutionCheck],
        true,
      );
    }

    if (candidate.resolution.unresolved.length > 0) {
      return this.result(
        "ESCALATED",
        candidate,
        currentStateHash,
        "Additional resolution is required. Structured evidence may re-enter Xact for a new Commit decision.",
        [freshnessCheck, resolutionCheck],
        true,
      );
    }

    const assessment = await this.measure(
      "POLICY",
      () => this.policyProvider.authorize({ candidate, currentState }),
    );
    const checks = [resolutionCheck, freshnessCheck, ...assessment.checks];

    if (assessment.outcome === "UNKNOWN") {
      return this.result(
        "ESCALATED",
        candidate,
        currentStateHash,
        "Authority is unknown and fails closed. Additional authority evidence may re-enter Xact.",
        checks,
        true,
      );
    }

    if (assessment.outcome === "DENIED") {
      return this.result(
        "REJECTED",
        candidate,
        currentStateHash,
        assessment.reason,
        checks,
        false,
      );
    }

    return this.result(
      "AUTHORIZED",
      candidate,
      currentStateHash,
      "All Commit checks pass against current state.",
      checks,
      false,
    );
  }

  private buildCandidate(
    inputs: TInputs,
    state: TState,
    resolutionEvidence: EvidenceRecord[],
    reasoningEvidence: EvidenceRecord[],
    reentryCount: number,
  ): DecisionCandidate<TInputs, TEffect> {
    const output = this.pack.resolve(
      inputs,
      state,
      [...resolutionEvidence, ...reasoningEvidence],
    );
    const stateHash = this.pack.stateHash(state);

    return {
      candidateId: `candidate:${this.pack.id}:v${this.pack.stateVersion(state)}:r${reentryCount}`,
      request: {
        scenarioId: this.pack.id,
        intent: "Issue a refund under simulated Commerce V1 policy",
        inputs,
        proposedEffect: output.proposedEffect,
      },
      baseStateHash: stateHash,
      baseStateVersion: this.pack.stateVersion(state),
      resolution: output.resolution,
      evidence: output.evidence,
      resolutionEvidence,
      reasoningEvidence,
      proposedEffect: output.proposedEffect,
      reentryCount,
    };
  }

  private async measure<T>(stage: TelemetryStage, operation: () => T | Promise<T>): Promise<T> {
    return this.telemetry
      ? this.telemetry.measure(stage, operation)
      : operation();
  }

  private result(
    status: DecisionResult<TInputs, TEffect>["status"],
    candidate: DecisionCandidate<TInputs, TEffect>,
    currentStateHash: string,
    reason: string,
    checks: CommitCheck[],
    reentryAllowed: boolean,
  ): DecisionResult<TInputs, TEffect> {
    return {
      status,
      candidate,
      resolution: candidate.resolution,
      evidence: candidate.evidence,
      reason,
      checks,
      currentStateHash,
      reentryAllowed,
    };
  }
}
