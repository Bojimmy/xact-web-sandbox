import type { AuthorizedEffect, ExecutionAdapter, ExecutionObservation, ExecutionResult } from "../execution/contracts";
import { DeterministicExecutionRouter } from "../execution/execution-router";
import type { VisionTargetDescriptor } from "../execution/targeted-payload";
import type { ScenarioPack } from "../scenarios/contracts";
import { AuthorizationArtifactIssuer, InMemoryAuthorizationArtifactStore, stableFingerprint } from "../xact/authorization-artifact";
import type { DecisionCandidate } from "../xact/contracts";
import type { AuthorizationAssessment, PolicyProvider, VerificationProvider } from "../xact/providers";
import { SimulationDecisionProvider } from "../xact/simulation-decision-provider";
import type { SimulationSession } from "./contracts";

export interface ServiceCreditInputs { authorityState: "ALLOWED" | "DENIED" | "UNKNOWN"; capabilityAvailable: boolean; }
export interface ServiceCreditState { version: number; customerId: "1042"; creditEligible: number; appliedCredit: number; lastReceipt?: string; }
export interface ServiceCreditEffect { type: "APPLY_SERVICE_CREDIT"; customerId: "1042"; amount: number; target: "customer:1042/service-credit"; visionTarget: VisionTargetDescriptor; }
export type ServiceCreditSession = SimulationSession<ServiceCreditInputs, ServiceCreditState, ServiceCreditEffect>;

const effect: ServiceCreditEffect = {
  type: "APPLY_SERVICE_CREDIT", customerId: "1042", amount: 42, target: "customer:1042/service-credit",
  visionTarget: { targetId: "customer:1042/service-credit", role: "button", name: "Apply service credit", origin: "http://localhost", frameId: "main", pageRevision: "service-operations-console-v1" },
};

const serviceCreditPack: ScenarioPack<ServiceCreditInputs, ServiceCreditState, ServiceCreditEffect> = {
  id: "service-operations-v1-service-credit", label: "Service Operations / service credit", preferredSubstrate: "WEBMCP",
  intent: () => "Apply the verified service credit to customer 1042",
  createInitialInputs: () => ({ authorityState: "ALLOWED", capabilityAvailable: true }),
  createInitialState: () => ({ version: 1, customerId: "1042", creditEligible: 42, appliedCredit: 0 }),
  stateFingerprint: (state) => `service-operations:v${state.version}:customer=${state.customerId}:eligible=${state.creditEligible.toFixed(2)}:applied=${state.appliedCredit.toFixed(2)}`,
  stateVersion: (state) => state.version,
  resolve: (inputs, state) => ({
    resolution: {
      resolved: [
        { key: "customer", value: state.customerId, source: "verified", provenance: "Constructed Service Operations Console" },
        { key: "creditEligible", value: state.creditEligible, source: "verified", provenance: `Service account state v${state.version}` },
        { key: "authority", value: inputs.authorityState, source: "verified", provenance: "Public-safe authority fixture" },
      ],
      unresolved: [],
      commitConstraints: [
        { key: "exact-customer", description: "Effect must remain bound to customer 1042.", condition: "required", satisfied: true },
        { key: "credit-eligibility", description: "Requested $42.00 must match current eligible credit.", condition: "limit", satisfied: state.creditEligible >= effect.amount },
        { key: "authority", description: "Authority must be known and allowed at Commit.", condition: "authority", satisfied: inputs.authorityState === "UNKNOWN" ? "unknown" : inputs.authorityState === "ALLOWED" },
        { key: "capability", description: "request_service_credit must be present as capability.", condition: "required", satisfied: inputs.capabilityAvailable },
        { key: "freshness", description: "Current customer state must match Resolve binding.", condition: "freshness", satisfied: true },
      ],
    },
    evidence: [{ id: "service-credit:1042", claim: "Customer 1042 has $42.00 verified service-credit eligibility.", source: "Constructed Service Operations Console", kind: "verified", provenance: `state v${state.version}` }],
    proposedEffect: effect,
  }),
  simulateConcurrentChange: (state) => ({ ...state, version: state.version + 1, creditEligible: 0 }),
  applyEffect: (state, applied, receipt) => ({ ...state, version: state.version + 1, creditEligible: state.creditEligible - applied.amount, appliedCredit: state.appliedCredit + applied.amount, lastReceipt: String(receipt) }),
};

class ServiceCreditPolicy implements PolicyProvider<ServiceCreditInputs, ServiceCreditState, ServiceCreditEffect> {
  authorize({ candidate, currentState }: { candidate: DecisionCandidate<ServiceCreditInputs, ServiceCreditEffect>; currentState: ServiceCreditState }): AuthorizationAssessment {
    const inputs = candidate.request.inputs;
    const eligible = currentState.creditEligible >= candidate.proposedEffect.amount;
    const capability = inputs.capabilityAvailable;
    const checks: AuthorizationAssessment["checks"] = [
      { key: "policy", outcome: eligible ? "PASS" : "FAIL", detail: eligible ? "Current credit eligibility covers the exact requested amount." : "Current credit eligibility no longer covers the requested amount." },
      { key: "authority", outcome: inputs.authorityState === "ALLOWED" ? "PASS" : inputs.authorityState === "UNKNOWN" ? "HOLD" : "FAIL", detail: `Authority fixture is ${inputs.authorityState}.` },
      { key: "capability", outcome: capability ? "PASS" : "FAIL", detail: capability ? "request_service_credit capability is present." : "request_service_credit capability is absent." },
    ];
    if (inputs.authorityState === "UNKNOWN") return { outcome: "UNKNOWN", reason: "Authority state is unknown and fails closed.", checks };
    if (!eligible || !capability || inputs.authorityState === "DENIED") return { outcome: "DENIED", reason: "Current policy, authority, or capability denies this service credit.", checks };
    return { outcome: "ALLOWED", reason: "Current policy, authority, and capability pass.", checks };
  }
}

class ServiceCreditVerification implements VerificationProvider<ServiceCreditInputs, ServiceCreditState, ServiceCreditEffect, ExecutionResult> {
  verify({ candidate, before, after, execution, observation }: { candidate: DecisionCandidate<ServiceCreditInputs, ServiceCreditEffect>; before: ServiceCreditState; after: ServiceCreditState; execution: ExecutionResult; observation: ExecutionObservation }) {
    const exact = after.appliedCredit - before.appliedCredit === candidate.proposedEffect.amount;
    const bound = execution.receipt === observation.receipt && observation.target === candidate.proposedEffect.target && observation.effectFingerprint === stableFingerprint(candidate.proposedEffect);
    return { verified: execution.executed && exact && bound && after.lastReceipt === String(execution.receipt), reason: exact && bound ? "Observed service credit matches the authorized effect exactly." : "Observed service credit does not match the authorized effect.", checks: [`Credit delta ${exact ? "matches" : "does not match"} $${candidate.proposedEffect.amount.toFixed(2)}`, `Observation ${bound ? "matches" : "does not match"} the bound target and effect`] };
  }
}

/** Public-safe service runtime: all consequential paths retain the existing Commit → artifact → adapter → observe → verify sequence. */
export class ServiceCreditEngine {
  private readonly provider = new SimulationDecisionProvider(serviceCreditPack, new ServiceCreditPolicy());
  private readonly issuer: AuthorizationArtifactIssuer;
  private readonly router = new DeterministicExecutionRouter();
  private readonly verifier = new ServiceCreditVerification();
  constructor(private readonly store: InMemoryAuthorizationArtifactStore, private readonly adapters: ExecutionAdapter[]) { this.issuer = new AuthorizationArtifactIssuer(store); }
  createSession(): ServiceCreditSession { const currentState = serviceCreditPack.createInitialState(); return { phase: "READY", inputs: serviceCreditPack.createInitialInputs(), currentState, currentStateFingerprint: serviceCreditPack.stateFingerprint(currentState), selectedSubstrate: "NONE", telemetry: [], trace: [{ phase: "Input", outcome: "Ready", detail: "Service credit request is available for Resolve.", sequence: 1 }] }; }
  async resolve(session: ServiceCreditSession): Promise<ServiceCreditSession> { const candidate = await this.provider.resolve(session.inputs, session.currentState); return { ...session, phase: "RESOLVED", candidate, trace: this.trace(session, "Resolve", "R3 · U0 · C5", "Candidate bound to current Service Operations state.") }; }
  async commit(session: ServiceCreditSession): Promise<ServiceCreditSession> { if (!session.candidate) throw new Error("Resolve must run before Commit."); const decision = await this.provider.commit(session.candidate, session.currentState); const issued = decision.status === "AUTHORIZED" ? { ...decision, artifact: this.issuer.issue({ commitId: decision.candidate.candidateId, effectFingerprint: stableFingerprint(decision.candidate.proposedEffect), baseStateFingerprint: decision.candidate.baseStateFingerprint, actor: "support.agent", capability: "service_credit:apply" }) } : decision; return { ...session, phase: issued.status, decision: issued, selectedSubstrate: issued.status === "AUTHORIZED" ? "WEBMCP" : "NONE", currentStateFingerprint: serviceCreditPack.stateFingerprint(session.currentState), trace: this.trace(session, "Commit", issued.status, `${issued.reason} Only AUTHORIZED carries an artifact.`) }; }
  async executeAndVerify(session: ServiceCreditSession): Promise<ServiceCreditSession> {
    if (session.decision?.status !== "AUTHORIZED" || !session.decision.artifact) throw new Error("Execution is blocked until Commit returns AUTHORIZED with an artifact.");
    if (serviceCreditPack.stateFingerprint(session.currentState) !== session.decision.currentStateFingerprint) throw new Error("Current state changed after Commit; fresh resolution is required.");
    const effectToRoute: AuthorizedEffect = { artifact: session.decision.artifact, substrate: "WEBMCP", payload: session.decision.candidate.proposedEffect };
    const selection = await this.router.select(effectToRoute, this.adapters);
    if (!selection.adapter || !selection.effect) return { ...session, phase: "EXECUTION_FAILED", execution: { executed: false, substrate: "WEBMCP", error: selection.reason }, trace: this.trace(session, "Execute", "FAILED", selection.reason) };
    const validation = await selection.adapter.validate(effectToRoute.artifact, selection.effect.payload, session.currentStateFingerprint);
    if (!validation.valid) throw new Error(`Execution validation failed: ${validation.reason ?? "unknown guard failure"}`);
    const routed = { ...session, trace: this.trace(session, "Execute", "ROUTED", selection.reason) };
    const execution = await selection.adapter.execute(selection.effect);
    if (!execution.executed) return { ...routed, phase: "EXECUTION_FAILED", execution, selectedSubstrate: selection.effect.substrate, trace: this.trace(routed, "Execute", "FAILED", execution.error ?? "No effect caused.") };
    let observation: ExecutionObservation;
    try { observation = await selection.adapter.observe(selection.effect, execution); } catch (cause) { return { ...routed, phase: "OBSERVATION_FAILED", execution, selectedSubstrate: selection.effect.substrate, trace: this.trace(routed, "Verify", "OBSERVATION_FAILED", cause instanceof Error ? cause.message : "Post-effect observation failed.") }; }
    const after = serviceCreditPack.applyEffect(session.currentState, session.decision.candidate.proposedEffect, execution.receipt);
    const verification = this.verifier.verify({ candidate: session.decision.candidate, before: session.currentState, after, execution, observation });
    return { ...routed, phase: verification.verified ? "VERIFIED" : "VERIFICATION_FAILED", currentState: after, currentStateFingerprint: serviceCreditPack.stateFingerprint(after), selectedSubstrate: selection.effect.substrate, execution, verification, trace: this.trace(routed, "Verify", verification.verified ? "VERIFIED" : "FAILED", verification.reason) };
  }
  private trace(session: ServiceCreditSession, phase: ServiceCreditSession["trace"][number]["phase"], outcome: string, detail: string) { return [...session.trace, { phase, outcome, detail, sequence: session.trace.length + 1 }]; }
}

export function createServiceCreditEngine(store: InMemoryAuthorizationArtifactStore, adapters: ExecutionAdapter[]) { return new ServiceCreditEngine(store, adapters); }
