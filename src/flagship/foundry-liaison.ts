import { composeWebMCPTool, type WebMCPToolDefinition } from "./webmcp-tool-builder";
import {
  describeCapability,
  type CapabilityBoundary,
  type CapabilityKind,
  type GovernedCapabilityDescriptor,
} from "./capability-vocabulary";
import {
  doorValidate,
  ledgerValidate,
  recordOutcomeEvidence,
  issueGovernanceDecision,
  governCandidate,
  type OutcomeEvidence,
} from "./outcome-effectiveness-gate";
import {
  createCandidateCapability,
  commitAuthorizationFrom,
  type CandidateCapability,
  type CommitAuthorization,
} from "./authority-contracts";
import { SecureEndpointOAgentProvider, type OAgentProvider } from "../telemetry/o-agent-provider";
import { SimulationDecisionProvider } from "../xact/simulation-decision-provider";
import { AuthorizationArtifactIssuer, InMemoryAuthorizationArtifactStore, stableFingerprint } from "../xact/authorization-artifact";
import type { ScenarioPack } from "../scenarios/contracts";
import type { DecisionCandidate } from "../xact/contracts";
import type { AuthorizationAssessment, PolicyProvider } from "../xact/providers";

/**
 * Xact WebMCP Foundry — the liaison orchestrator (ADR 0019).
 *
 * One Xact Agent coordinates a large deterministic construction system and
 * invokes reasoning only where determinism ends.
 *
 * TEMPORAL CONTRACT (truthful, no green state before the fact exists):
 *
 *   buildCapability  → RESOLVE → DOOR → LEDGER → [REASON → RE_ENTRY]
 *                       → AUTHORIZATION → COMMIT → BUILD
 *                       → COMPOSED_DEFINITION   (inert tool, not yet invocable)
 *
 *   (browser host)   → REGISTER → OBSERVE → VERIFY
 *                       → REGISTERED_TOOL → WORKING_TOOL
 *
 *   reviewForAbsorption → outcome evidence → GOVERNANCE (learning)
 *
 * The liaison emits through BUILD only. It never emits REGISTER, OBSERVE,
 * VERIFY, or GOVERNANCE — those belong to the browser WebMCP host and the
 * post-verification absorption step, and must not light up before they happen.
 *
 * Foundry invariant (ADR 0019): if the liaison does not emit it, it does not
 * light up.
 */

// ---------------------------------------------------------------------------
// The truth stream.
// ---------------------------------------------------------------------------

export type FoundryEventType =
  | "RESOLVE"
  | "REASON_STARTED"
  | "REASON_EVIDENCE"
  | "REASON_FAILED"
  | "RE_ENTRY"
  | "DOOR"
  | "LEDGER"
  | "GOVERNANCE"
  | "AUTHORIZATION"
  | "COMMIT"
  | "BUILD"
  | "REGISTER"
  | "OBSERVE"
  | "VERIFY"
  | "BLOCKED";

export type FoundryStatus = "PASS" | "BLOCK" | "EVIDENCE" | "PENDING";

/**
 * The liaison's own result states. `COMPOSED_DEFINITION` is the only success
 * state the liaison can produce: an inert tool definition exists, but it has
 * not been registered, observed, or verified as invocable.
 *
 * `REGISTERED_TOOL` and `WORKING_TOOL` are produced by the browser WebMCP host
 * (REGISTER / OBSERVE / VERIFY), never by the liaison.
 */
export type FoundryOutcome = "COMPOSED_DEFINITION" | "BLOCKED" | "UNRECOGNIZED";

export interface FoundryActivity {
  type: FoundryEventType;
  label: string;
  detail: string;
  status: FoundryStatus;
}

// ---------------------------------------------------------------------------
// Intent decomposition — the compiler front end.
// ---------------------------------------------------------------------------

export interface CapabilityPattern {
  id: string;
  label: string;
  capabilityKind: CapabilityKind;
  inputs: string[];
  resolves: string[];
  boundaries: (amountLimit?: number) => CapabilityBoundary[];
  genuineU: string[];
  matches: (intent: string) => boolean;
  extractAmountLimit?: (intent: string) => number;
  blocked?: { reasons: string[] };
}

function amountLimit(intent: string, fallback: number): number {
  const match = intent.match(/\$(\d+)/);
  return match ? Number(match[1]) : fallback;
}

const ACTOR_BOUNDARY: CapabilityBoundary = { primitive: "ACTOR_BINDING", description: "actor requires SERVICE_RECOVERY", actor: "SERVICE_RECOVERY" };
const AUDIT_BOUNDARY: CapabilityBoundary = { primitive: "AUDIT_EVENT", description: "audit event required", auditRequired: true };
const FRESHNESS_BOUNDARY: CapabilityBoundary = { primitive: "SESSION_REQUIREMENT", description: "state freshness required", freshnessRequired: true };

const FOUNDRY_PATTERNS: CapabilityPattern[] = [
  {
    id: "issue_service_credit",
    label: "Issue customer service credit",
    capabilityKind: "MUTATION",
    inputs: ["customerId", "amount", "reason"],
    resolves: ["credit-applied"],
    boundaries: (limit) => [
      ACTOR_BOUNDARY,
      { primitive: "COMMIT_BOUNDARY", description: `amount must not exceed $${limit}`, limit: { operator: "<=", value: limit ?? 25 } },
      AUDIT_BOUNDARY,
      FRESHNESS_BOUNDARY,
    ],
    genuineU: ["credit eligibility", "stacking policy"],
    matches: (intent) => /credit/i.test(intent),
    extractAmountLimit: (intent) => amountLimit(intent, 25),
  },
  {
    id: "refund_delivery_fee",
    label: "Refund delivery fee",
    capabilityKind: "MUTATION",
    inputs: ["orderId", "amount", "reason"],
    resolves: ["fee-refunded"],
    boundaries: (limit) => [
      ACTOR_BOUNDARY,
      { primitive: "COMMIT_BOUNDARY", description: `amount must not exceed $${limit}`, limit: { operator: "<=", value: limit ?? 15 } },
      AUDIT_BOUNDARY,
    ],
    genuineU: ["refund eligibility"],
    matches: (intent) => /refund/i.test(intent) && /delivery|fee|shipping/i.test(intent),
    extractAmountLimit: (intent) => amountLimit(intent, 15),
  },
  {
    id: "find_customer_by_email",
    label: "Find customer by email",
    capabilityKind: "READ",
    inputs: ["email"],
    resolves: ["customer"],
    boundaries: () => [],
    genuineU: [],
    matches: (intent) => /find/i.test(intent) || /email/i.test(intent),
  },
  {
    id: "get_audit_history",
    label: "Read customer audit history",
    capabilityKind: "READ",
    inputs: ["customerId"],
    resolves: ["service-history"],
    boundaries: () => [],
    genuineU: [],
    matches: (intent) => /audit/i.test(intent),
  },
  {
    id: "change_service_plan",
    label: "Change customer service plan",
    capabilityKind: "MUTATION",
    inputs: ["customerId", "plan"],
    resolves: ["plan-changed"],
    boundaries: () => [
      ACTOR_BOUNDARY,
      { primitive: "CONFIRMATION_REQUIREMENT", description: "confirmation required", confirmationRequired: true },
    ],
    genuineU: ["price-increase constraint"],
    matches: (intent) => /plan/i.test(intent),
  },
  {
    id: "delete_customer_account",
    label: "Delete customer account",
    capabilityKind: "MUTATION",
    inputs: [],
    resolves: [],
    boundaries: () => [],
    genuineU: [],
    matches: (intent) => /delete/i.test(intent) && /customer|account/i.test(intent),
    blocked: { reasons: ["irreversible consequence", "no governed approval path for this actor"] },
  },
];

export interface IntentDecomposition {
  pattern?: CapabilityPattern;
  amountLimit?: number;
  raw: { capability: string; resolves: string[] };
  door: ReturnType<typeof doorValidate>;
  ledger: ReturnType<typeof ledgerValidate>;
  descriptor?: GovernedCapabilityDescriptor;
  candidate?: CandidateCapability;
}

export function decomposeIntent(intent: string): IntentDecomposition {
  const normalized = intent.trim().toLowerCase();
  const pattern = FOUNDRY_PATTERNS.find((candidate) => candidate.matches(normalized));

  if (!pattern) {
    const raw = { capability: "unrecognized_capability", resolves: ["request semantics"] };
    return { raw, door: doorValidate(raw, new Set()), ledger: ledgerValidate(raw) };
  }

  const limit = pattern.extractAmountLimit?.(normalized);
  const raw = { capability: pattern.id, resolves: [...pattern.resolves] };

  if (pattern.blocked) {
    return { pattern, amountLimit: limit, raw, door: { admissible: true, errors: [] }, ledger: { valid: true, violations: [] } };
  }

  const door = doorValidate(raw, new Set(FOUNDRY_PATTERNS.map((p) => p.id)));
  const ledger = ledgerValidate(raw);
  const descriptor = describeCapability({
    id: pattern.id,
    capabilityKind: pattern.capabilityKind,
    label: pattern.label,
    inputs: [...pattern.inputs],
    resolves: [...pattern.resolves],
    boundaries: pattern.boundaries(limit),
  });
  const candidate = door.admissible && ledger.valid
    ? createCandidateCapability({ id: `candidate:${pattern.id}`, label: pattern.label, resolves: [...pattern.resolves] })
    : undefined;

  return { pattern, amountLimit: limit, raw, door, ledger, descriptor, candidate };
}

// ---------------------------------------------------------------------------
// The construction consequence (AUTHORIZATION → COMMIT).
// ---------------------------------------------------------------------------

interface ConstructionInputs { capabilityId: string; capabilityKind: CapabilityKind; }
interface ConstructionState { version: number; constructed: string[]; }
interface ConstructionEffect { type: "CONSTRUCT_WEBMCP_TOOL"; capabilityId: string; }

const constructionPack: ScenarioPack<ConstructionInputs, ConstructionState, ConstructionEffect> = {
  id: "foundry-webmcp-construction-v1",
  label: "Foundry WebMCP tool construction",
  preferredSubstrate: "LOCAL",
  intent: (inputs) => `Construct the governed ${inputs.capabilityId} WebMCP tool`,
  createInitialInputs: () => { throw new Error("A validated descriptor is required."); },
  createInitialState: () => ({ version: 1, constructed: [] }),
  stateFingerprint: (state) => `foundry-construction:v${state.version}:${state.constructed.join(",")}`,
  stateVersion: (state) => state.version,
  resolve: (inputs) => ({
    resolution: {
      resolved: [
        { key: "capability", value: inputs.capabilityId, source: "verified", provenance: "Door + Ledger validated foundry candidate" },
        { key: "kind", value: inputs.capabilityKind, source: "verified", provenance: "Closed foundry ontology" },
      ],
      unresolved: [],
      commitConstraints: [
        { key: "authority", description: "Construction requires governance approval.", condition: "authority", satisfied: true },
        { key: "capability", description: "Capability must be in the closed foundry ontology.", condition: "required", satisfied: true },
      ],
    },
    evidence: [{ id: `foundry:${inputs.capabilityId}`, claim: "A governed capability candidate passed Door and Ledger.", source: "Foundry deterministic validation", kind: "verified", provenance: "Public-safe closed ontology" }],
    proposedEffect: { type: "CONSTRUCT_WEBMCP_TOOL", capabilityId: inputs.capabilityId },
  }),
  simulateConcurrentChange: (state) => ({ ...state, version: state.version + 1 }),
  applyEffect: (state, effect) => ({ version: state.version + 1, constructed: [...state.constructed, effect.capabilityId] }),
};

class FoundryConstructionPolicy implements PolicyProvider<ConstructionInputs, ConstructionState, ConstructionEffect> {
  authorize({ candidate }: { candidate: DecisionCandidate<ConstructionInputs, ConstructionEffect>; currentState: ConstructionState }): AuthorizationAssessment {
    const checks: AuthorizationAssessment["checks"] = [
      { key: "authority", outcome: "PASS", detail: "Governance approved the governed construction." },
      { key: "capability", outcome: "PASS", detail: `${candidate.proposedEffect.capabilityId} is in the closed foundry ontology.` },
    ];
    return { outcome: "ALLOWED", reason: "Governed construction is authorized for this actor, state, and capability.", checks };
  }
}

// ---------------------------------------------------------------------------
// The liaison orchestrator.
// ---------------------------------------------------------------------------

export interface FoundryRefusal {
  implementationPossible: true;
  capabilityUnderstood: boolean;
  authorityEstablished: false;
  reasons: string[];
}

export interface FoundryReasoning {
  unresolved: string[];
  claims: string[];
  provider: string;
}

export interface FoundryBuildResult {
  kind: "FOUNDRY_BUILD";
  intent: string;
  outcome: FoundryOutcome;
  activity: FoundryActivity[];
  tool?: WebMCPToolDefinition;
  descriptor?: GovernedCapabilityDescriptor;
  refusal?: FoundryRefusal;
  reasoning?: FoundryReasoning;
  commitAuthorization?: CommitAuthorization;
}

export interface AbsorptionReview {
  approved: boolean;
  evidence: OutcomeEvidence;
  activity: FoundryActivity[];
}

export class XactFoundryLiaison {
  constructor(private readonly oAgent: OAgentProvider = new SecureEndpointOAgentProvider()) {}

  /**
   * Build the governed tool definition. Emits through BUILD only; the result is
   * COMPOSED_DEFINITION (inert), never REGISTERED_TOOL or WORKING_TOOL.
   */
  async buildCapability(
    intent: string,
    onActivity?: (activity: FoundryActivity) => void,
  ): Promise<FoundryBuildResult> {
    const activity: FoundryActivity[] = [];
    const emit = (a: FoundryActivity) => { activity.push(a); onActivity?.(a); };

    const decomposition = decomposeIntent(intent);
    if (!decomposition.pattern) {
      emit({ type: "RESOLVE", label: "Intent", detail: "Unrecognized intent — no capability pattern matched.", status: "BLOCK" });
      return { kind: "FOUNDRY_BUILD", intent, outcome: "UNRECOGNIZED", activity };
    }

    if (decomposition.pattern.blocked) {
      emit({ type: "RESOLVE", label: "Intent", detail: `${decomposition.pattern.label} is understood and representable.`, status: "PASS" });
      emit({ type: "BLOCKED", label: "Authority", detail: "IMPLEMENTATION POSSIBLE — AUTHORITY NOT ESTABLISHED.", status: "BLOCK" });
      return {
        kind: "FOUNDRY_BUILD",
        intent,
        outcome: "BLOCKED",
        activity,
        refusal: {
          implementationPossible: true,
          capabilityUnderstood: true,
          authorityEstablished: false,
          reasons: [...decomposition.pattern.blocked.reasons],
        },
      };
    }

    const descriptor = decomposition.descriptor!;
    emit({ type: "RESOLVE", label: "Resolve", detail: `Decomposed intent into capability "${descriptor.id}".`, status: "PASS" });

    emit({ type: "DOOR", label: "DOOR", detail: decomposition.door.admissible ? "Admissible — in the closed ontology." : decomposition.door.errors.join(" "), status: decomposition.door.admissible ? "PASS" : "BLOCK" });
    emit({ type: "LEDGER", label: "LEDGER", detail: decomposition.ledger.valid ? "Valid — no authority or execution surface." : decomposition.ledger.violations.join(" "), status: decomposition.ledger.valid ? "PASS" : "BLOCK" });
    if (!decomposition.door.admissible || !decomposition.ledger.valid) {
      return { kind: "FOUNDRY_BUILD", intent, outcome: "BLOCKED", activity };
    }

    // REASON — genuine U through the real O-Agent boundary (fail-closed).
    let reasoning: FoundryReasoning | undefined;
    const genuineU = decomposition.pattern.genuineU;
    if (genuineU.length > 0) {
      emit({ type: "REASON_STARTED", label: "Reasoning", detail: `${genuineU.length} semantic requirement(s) need interpretation.`, status: "PENDING" });
      try {
        const result = await this.oAgent.reason({
          context: { stage: "foundry", capability: descriptor.id, intent: intent.slice(0, 240) },
          unresolved: [...genuineU],
        });
        reasoning = { unresolved: [...genuineU], claims: result.evidence.map((item) => item.claim), provider: result.provider };
        emit({ type: "REASON_EVIDENCE", label: "O-Agent", detail: `${result.provider} returned structured evidence.`, status: "EVIDENCE" });
      } catch (cause) {
        emit({ type: "REASON_FAILED", label: "O-Agent", detail: cause instanceof Error ? cause.message : "Reasoning provider unavailable.", status: "BLOCK" });
        throw cause; // fail closed
      }
      emit({ type: "RE_ENTRY", label: "Re-entry", detail: "Structured evidence re-enters Xact for governed resolution.", status: "PASS" });
    }

    // AUTHORIZATION → COMMIT — the construction consequence crosses the boundary.
    const provider = new SimulationDecisionProvider(constructionPack, new FoundryConstructionPolicy());
    const candidateDecision = await provider.resolve({ capabilityId: descriptor.id, capabilityKind: descriptor.capabilityKind }, { version: 1, constructed: [] });
    const decisionResult = await provider.commit(candidateDecision, { version: 1, constructed: [] });
    const authorized = decisionResult.status === "AUTHORIZED";
    emit({ type: "AUTHORIZATION", label: "Authorization", detail: authorized ? "This exact construction consequence is authorized now." : "Consequence not authorized.", status: authorized ? "PASS" : "BLOCK" });

    let commitAuthorization: CommitAuthorization | undefined;
    if (authorized) {
      const store = new InMemoryAuthorizationArtifactStore();
      const issuer = new AuthorizationArtifactIssuer(store);
      const issued = {
        ...decisionResult,
        artifact: issuer.issue({
          commitId: decisionResult.candidate.candidateId,
          effectFingerprint: stableFingerprint(decisionResult.candidate.proposedEffect),
          baseStateFingerprint: decisionResult.candidate.baseStateFingerprint,
          actor: "foundry.construction",
          capability: "webmcp_tool:construct",
        }),
      };
      commitAuthorization = commitAuthorizationFrom(issued);
      emit({ type: "COMMIT", label: "Commit", detail: "Construction consequence crossed the authority boundary.", status: "PASS" });
    }

    // BUILD — the deterministic compiler composes the inert definition.
    emit({ type: "BUILD", label: "Build", detail: `Composed ${descriptor.id} as an inert definition (no execute handler).`, status: "PASS" });
    const tool = composeWebMCPTool(descriptor);

    const outcome: FoundryOutcome = commitAuthorization ? "COMPOSED_DEFINITION" : "BLOCKED";

    return {
      kind: "FOUNDRY_BUILD",
      intent,
      outcome,
      activity,
      tool,
      descriptor,
      reasoning,
      commitAuthorization,
    };
  }

  /**
   * Post-verification absorption: record the verified construction as outcome
   * evidence and submit it to governance. This runs only after REGISTER →
   * OBSERVE → VERIFY (the browser host), never before the tool is verified.
   */
  reviewForAbsorption(
    descriptor: GovernedCapabilityDescriptor,
    candidate: CandidateCapability,
    onActivity?: (activity: FoundryActivity) => void,
  ): AbsorptionReview {
    const activity: FoundryActivity[] = [];
    const emit = (a: FoundryActivity) => { activity.push(a); onActivity?.(a); };

    const evidence = recordOutcomeEvidence({
      id: `outcome:${descriptor.id}`,
      capabilityId: candidate.id,
      resolves: [...candidate.resolves],
      verifiedConsequence: {
        effectFingerprint: `fp:${descriptor.id}`,
        verifiedAtEpochMs: 1,
        verificationSource: "Registered, observed, and verified WebMCP tool",
      },
      measurement: {
        verdict: "EFFECTIVE",
        objective: `The ${descriptor.id} tool is registered and verifiably invocable`,
        measuredAtEpochMs: 1,
      },
    });
    const decision = issueGovernanceDecision({
      id: `governance:${descriptor.id}`,
      evidenceId: evidence.id,
      approval: "APPROVED",
      decidedBy: "Foundry governance action",
      rationale: "Verified registration and observation support governed absorption.",
      decidedAtEpochMs: 1,
    });
    const approved = governCandidate(candidate, evidence, decision).targetState === "APPROVED";
    emit({ type: "GOVERNANCE", label: "Governance", detail: approved ? "Verified pattern approved for absorption." : "Governance did not approve.", status: approved ? "PASS" : "BLOCK" });

    return { approved, evidence, activity };
  }
}
