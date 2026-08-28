import { SimulatedExecutionAdapter } from "../execution/simulated-adapter";
import type { AuthorizedEffect, ExecutionObservation, ExecutionResult } from "../execution/contracts";
import type { ScenarioPack } from "../scenarios/contracts";
import type { SimulationSession } from "../runtime/contracts";
import { AuthorizationArtifactIssuer, InMemoryAuthorizationArtifactStore, stableFingerprint } from "../xact/authorization-artifact";
import type { DecisionCandidate } from "../xact/contracts";
import type { AuthorizationAssessment, PolicyProvider, VerificationProvider } from "../xact/providers";
import { SimulationDecisionProvider } from "../xact/simulation-decision-provider";
import { createCandidateCapability, type CandidateCapability } from "./authority-contracts";
import { doorValidate, ledgerValidate } from "./outcome-effectiveness-gate";

/** The Stage 3 extension vocabulary is intentionally closed and public-safe. */
export const capabilityExtensionAllowlist = new Set(["get_audit_history"]);

export interface CapabilityProposal {
  capability: string;
  label: string;
  resolves: string[];
  request: string;
}

export interface ProposalAnalysis {
  proposal: CapabilityProposal;
  door: ReturnType<typeof doorValidate>;
  ledger: ReturnType<typeof ledgerValidate>;
  candidate?: CandidateCapability;
}

/**
 * A deterministic, deliberately narrow interpreter for the sandbox's single
 * extension. O-Agent output remains separately recorded as evidence; it never
 * chooses the capability identifier or supplies executable behavior.
 */
export function analyzeCapabilityRequest(request: string): ProposalAnalysis {
  const normalized = request.trim().toLowerCase();
  const proposal: CapabilityProposal = /audit|history/.test(normalized) && !/delete|remove|close|terminate/.test(normalized)
    ? { capability: "get_audit_history", label: "Read customer audit history", resolves: ["service-history"], request }
    : { capability: normalized.includes("delete") ? "delete_customer_account" : "unrecognized_capability", label: "Unapproved capability", resolves: ["request semantics"], request };
  const raw = { capability: proposal.capability, resolves: proposal.resolves };
  const door = doorValidate(raw, capabilityExtensionAllowlist);
  const ledger = ledgerValidate(raw);
  const candidate = door.admissible && ledger.valid
    ? createCandidateCapability({ id: `candidate:${proposal.capability}`, label: proposal.label, resolves: proposal.resolves })
    : undefined;
  return { proposal, door, ledger, candidate };
}

export interface CapabilityConstructionState {
  version: number;
  constructedCapabilityIds: readonly string[];
  lastReceipt?: string;
}

interface CapabilityConstructionInputs {
  candidate: CandidateCapability;
  doorPassed: boolean;
  ledgerPassed: boolean;
}

interface CapabilityConstructionEffect {
  type: "CONSTRUCT_RESOLUTION_CAPABILITY";
  candidateId: string;
  target: string;
}

export type CapabilityConstructionSession = SimulationSession<CapabilityConstructionInputs, CapabilityConstructionState, CapabilityConstructionEffect>;

const targetFor = (candidateId: string) => `xact:resolution-capability/${candidateId}`;

const constructionPack: ScenarioPack<CapabilityConstructionInputs, CapabilityConstructionState, CapabilityConstructionEffect> = {
  id: "flagship-capability-extension-v1",
  label: "Flagship bounded capability construction",
  preferredSubstrate: "LOCAL",
  intent: (inputs) => `Construct the governed resolution descriptor for ${inputs.candidate.id}`,
  createInitialInputs: () => { throw new Error("A validated candidate is required to construct a capability."); },
  createInitialState: () => ({ version: 1, constructedCapabilityIds: [] }),
  stateFingerprint: (state) => `capability-construction:v${state.version}:ids=${state.constructedCapabilityIds.join(",")}`,
  stateVersion: (state) => state.version,
  resolve: (inputs, state) => ({
    resolution: {
      resolved: [
        { key: "candidate", value: inputs.candidate.id, source: "verified", provenance: "Door + Ledger validated public-safe candidate" },
        { key: "construction-target", value: targetFor(inputs.candidate.id), source: "derived", provenance: `Fixed local construction target at state v${state.version}` },
      ],
      unresolved: [],
      commitConstraints: [
        { key: "door", description: "Capability must be in the closed Stage 3 ontology.", condition: "required", satisfied: inputs.doorPassed },
        { key: "ledger", description: "Candidate must have no authority or execution surface.", condition: "required", satisfied: inputs.ledgerPassed },
        { key: "freshness", description: "Construction state must remain unchanged after Resolve.", condition: "freshness", satisfied: true },
      ],
    },
    evidence: [{ id: `candidate:${inputs.candidate.id}`, claim: "A bounded capability candidate passed Door and Ledger.", source: "Stage 3 deterministic validation", kind: "verified", provenance: "Public-safe closed ontology" }],
    proposedEffect: { type: "CONSTRUCT_RESOLUTION_CAPABILITY", candidateId: inputs.candidate.id, target: targetFor(inputs.candidate.id) },
  }),
  simulateConcurrentChange: (state) => ({ ...state, version: state.version + 1 }),
  applyEffect: (state, effect, receipt) => ({
    version: state.version + 1,
    constructedCapabilityIds: [...state.constructedCapabilityIds, effect.candidateId],
    lastReceipt: String(receipt),
  }),
};

class CapabilityConstructionPolicy implements PolicyProvider<CapabilityConstructionInputs, CapabilityConstructionState, CapabilityConstructionEffect> {
  authorize({ candidate }: { candidate: DecisionCandidate<CapabilityConstructionInputs, CapabilityConstructionEffect>; currentState: CapabilityConstructionState }): AuthorizationAssessment {
    const { doorPassed, ledgerPassed } = candidate.request.inputs;
    const checks: AuthorizationAssessment["checks"] = [
      { key: "policy", outcome: "PASS", detail: "Public-safe construction policy permits the declared bounded primitive." },
      { key: "authority", outcome: "PASS", detail: "The local construction actor is declared by this sandbox scenario." },
      { key: "capability", outcome: doorPassed && ledgerPassed ? "PASS" : "FAIL", detail: "Door and Ledger must both pass before construction." },
    ];
    return doorPassed && ledgerPassed
      ? { outcome: "ALLOWED", reason: "Candidate is admissible, valid, and eligible for a fresh construction Commit.", checks }
      : { outcome: "DENIED", reason: "Candidate failed Door or Ledger and cannot be constructed.", checks };
  }
}

class CapabilityConstructionVerification implements VerificationProvider<CapabilityConstructionInputs, CapabilityConstructionState, CapabilityConstructionEffect, ExecutionResult> {
  verify({ candidate, before, after, execution, observation }: { candidate: DecisionCandidate<CapabilityConstructionInputs, CapabilityConstructionEffect>; before: CapabilityConstructionState; after: CapabilityConstructionState; execution: ExecutionResult; observation: ExecutionObservation }) {
    const constructed = !before.constructedCapabilityIds.includes(candidate.proposedEffect.candidateId)
      && after.constructedCapabilityIds.includes(candidate.proposedEffect.candidateId);
    const bound = observation.target === candidate.proposedEffect.target
      && observation.effectFingerprint === stableFingerprint(candidate.proposedEffect)
      && observation.receipt === execution.receipt;
    return {
      verified: execution.executed && constructed && bound && after.lastReceipt === String(execution.receipt),
      reason: constructed && bound ? "Observed construction matches the exact authorized resolution descriptor." : "Construction observation does not match the authorized descriptor.",
      checks: [`Descriptor ${constructed ? "constructed" : "not constructed"}`, `Observation ${bound ? "matches" : "does not match"} the bound artifact`],
    };
  }
}

/**
 * A real public-safe consequence flow for creating an inert resolution
 * descriptor: Resolve → Commit → artifact → LOCAL adapter → observe → verify.
 * The descriptor has no execute method and is not a WebMCP tool.
 */
export class CapabilityConstructionEngine {
  private readonly store = new InMemoryAuthorizationArtifactStore();
  private readonly issuer = new AuthorizationArtifactIssuer(this.store);
  private readonly provider = new SimulationDecisionProvider(constructionPack, new CapabilityConstructionPolicy());
  private readonly adapter = new SimulatedExecutionAdapter("LOCAL", this.store);
  private readonly verifier = new CapabilityConstructionVerification();

  createSession(candidate: CandidateCapability): CapabilityConstructionSession {
    const currentState = constructionPack.createInitialState();
    return {
      phase: "READY",
      inputs: { candidate, doorPassed: true, ledgerPassed: true },
      currentState,
      currentStateFingerprint: constructionPack.stateFingerprint(currentState),
      selectedSubstrate: "NONE",
      telemetry: [],
      trace: [{ phase: "Input", outcome: "Candidate ready", detail: "Candidate is descriptive only; construction still requires Commit.", sequence: 1 }],
    };
  }

  async resolve(session: CapabilityConstructionSession): Promise<CapabilityConstructionSession> {
    const candidate = await this.provider.resolve(session.inputs, session.currentState);
    return { ...session, phase: "RESOLVED", candidate, trace: this.trace(session, "Resolve", "R2 · U0 · C3", "Candidate bound to current construction state.") };
  }

  async commit(session: CapabilityConstructionSession): Promise<CapabilityConstructionSession> {
    if (!session.candidate) throw new Error("Resolve must run before Commit.");
    const decision = await this.provider.commit(session.candidate, session.currentState);
    const issued = decision.status === "AUTHORIZED"
      ? { ...decision, artifact: this.issuer.issue({ commitId: decision.candidate.candidateId, effectFingerprint: stableFingerprint(decision.candidate.proposedEffect), baseStateFingerprint: decision.candidate.baseStateFingerprint, actor: "xact.construction", capability: "resolution_capability:construct" }) }
      : decision;
    return { ...session, phase: issued.status, decision: issued, currentStateFingerprint: constructionPack.stateFingerprint(session.currentState), selectedSubstrate: "NONE", trace: this.trace(session, "Commit", issued.status, `${issued.reason} Only AUTHORIZED carries a construction artifact.`) };
  }

  async executeAndVerify(session: CapabilityConstructionSession): Promise<CapabilityConstructionSession> {
    if (session.decision?.status !== "AUTHORIZED" || !session.decision.artifact) throw new Error("Construction is blocked until Commit returns AUTHORIZED with an artifact.");
    if (constructionPack.stateFingerprint(session.currentState) !== session.decision.currentStateFingerprint) throw new Error("Construction state changed after Commit; fresh resolution is required.");
    const effect: AuthorizedEffect = { artifact: session.decision.artifact, substrate: "LOCAL", payload: session.decision.candidate.proposedEffect };
    const validation = await this.adapter.validate(effect.artifact, effect.payload, session.currentStateFingerprint);
    if (!validation.valid) throw new Error(`Construction artifact validation failed: ${validation.reason ?? "unknown guard failure"}`);
    const execution = await this.adapter.execute(effect);
    if (!execution.executed) return { ...session, phase: "EXECUTION_FAILED", execution, selectedSubstrate: "LOCAL", trace: this.trace(session, "Execute", "FAILED", execution.error ?? "No construction occurred.") };
    const observation = await this.adapter.observe(effect, execution);
    const after = constructionPack.applyEffect(session.currentState, session.decision.candidate.proposedEffect, execution.receipt);
    const verification = this.verifier.verify({ candidate: session.decision.candidate, before: session.currentState, after, execution, observation });
    return { ...session, phase: verification.verified ? "VERIFIED" : "VERIFICATION_FAILED", currentState: after, currentStateFingerprint: constructionPack.stateFingerprint(after), selectedSubstrate: "LOCAL", execution, verification, trace: this.trace(session, "Verify", verification.verified ? "VERIFIED" : "FAILED", verification.reason) };
  }

  private trace(session: CapabilityConstructionSession, phase: CapabilityConstructionSession["trace"][number]["phase"], outcome: string, detail: string) {
    return [...session.trace, { phase, outcome, detail, sequence: session.trace.length + 1 }];
  }
}
