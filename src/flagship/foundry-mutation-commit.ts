import type { WebMCPToolDefinition } from "./webmcp-tool-builder";
import type { FreshCommitResult } from "./foundry-runtime";
import { SimulationDecisionProvider } from "../xact/simulation-decision-provider";
import { AuthorizationArtifactIssuer, InMemoryAuthorizationArtifactStore, stableFingerprint } from "../xact/authorization-artifact";
import type { ScenarioPack } from "../scenarios/contracts";
import type { DecisionCandidate } from "../xact/contracts";
import type { AuthorizationAssessment, PolicyProvider } from "../xact/providers";
import type { AuthorizedEffect } from "../execution/contracts";

/**
 * The real "fresh Resolve → Commit → exact dispatch" engine behind a MUTATION
 * invocation on the Foundry shelf.
 *
 * Every invocation of a MUTATION tool builds a fresh decision candidate for the
 * exact consequence, runs it through the SimulationDecisionProvider Commit
 * boundary, and — only when AUTHORIZED — issues a fresh AuthorizationArtifact
 * for that exact effect. There is no cached authorization: each call re-commits.
 *
 * The policy enforces the tool's own governed boundaries from ADR 0016:
 *   ACTOR_BINDING            → the invoking actor must be the bound actor.
 *   COMMIT_BOUNDARY          → the amount must not exceed the ceiling.
 *   CONFIRMATION_REQUIREMENT → explicit confirmation must be present.
 */

export interface MutationInvocationContext {
  actor: string;
  confirmation: boolean;
  [key: string]: unknown;
}

interface MutationState {
  version: number;
  applied: string[];
}

function mutationPack(tool: WebMCPToolDefinition): ScenarioPack<MutationInvocationContext, MutationState, MutationInvocationContext> {
  const isTrue = (value: unknown) => value === true || value === "true";
  return {
    id: `foundry-mutation:${tool.name}`,
    label: `Mutation consequence: ${tool.name}`,
    preferredSubstrate: "WEBMCP",
    intent: (inputs) => `Apply the exact ${tool.name} consequence for actor ${inputs.actor}.`,
    createInitialInputs: () => { throw new Error("A mutation input is required."); },
    createInitialState: () => ({ version: 1, applied: [] }),
    stateFingerprint: (state) => `foundry-mutation:${tool.name}:v${state.version}:${state.applied.join(",")}`,
    stateVersion: (state) => state.version,
    resolve: (inputs) => ({
      resolution: {
        resolved: [
          { key: "effect", value: inputs, source: "verified", provenance: "Exact mutation consequence resolved from the invocation." },
        ],
        unresolved: [],
        commitConstraints: [
          { key: "confirmation", description: "Explicit confirmation is required for this consequence.", condition: "required", satisfied: inputs.confirmation === true },
          ...(tool.name === "reassign_support_ticket" ? [{ key: "reassignment_policy", description: "Current owner unavailable OR required skill mismatch is required.", condition: "required" as const, satisfied: isTrue(inputs.ownerUnavailable) || isTrue(inputs.requiredSkillMismatch) }] : []),
        ],
      },
      evidence: [
        { id: `foundry-mutation:${tool.name}`, claim: "The exact mutation consequence was resolved before Commit.", source: "Foundry runtime", kind: "verified", provenance: "Invocation → Resolve" },
      ],
      proposedEffect: inputs,
    }),
    simulateConcurrentChange: (state) => ({ ...state, version: state.version + 1 }),
    applyEffect: (state, effect) => ({ version: state.version + 1, applied: [...state.applied, stableFingerprint(effect)] }),
  };
}

class MutationPolicy implements PolicyProvider<MutationInvocationContext, MutationState, MutationInvocationContext> {
  constructor(private readonly tool: WebMCPToolDefinition) {}

  authorize({ candidate }: { candidate: DecisionCandidate<MutationInvocationContext, MutationInvocationContext>; currentState: MutationState }): AuthorizationAssessment {
    const inputs = candidate.request.inputs;
    const checks: AuthorizationAssessment["checks"] = [];

    const actorBoundary = this.tool.boundaries.find((b) => b.primitive === "ACTOR_BINDING");
    const boundActor = actorBoundary?.actor ?? "support.agent";
    const actorOk = inputs.actor === boundActor;
    checks.push({
      key: "authority",
      outcome: actorOk ? "PASS" : "FAIL",
      detail: actorOk ? `Actor bound to ${boundActor}.` : `Actor ${inputs.actor} is not the bound actor ${boundActor}.`,
    });

    const commitBoundary = this.tool.boundaries.find((b) => b.primitive === "COMMIT_BOUNDARY");
    const ceiling = commitBoundary?.limit?.value;
    const amount = typeof inputs.amount === "number" ? inputs.amount : undefined;
    const amountOk = ceiling === undefined || amount === undefined || amount <= ceiling;
    checks.push({
      key: "capability",
      outcome: amountOk ? "PASS" : "FAIL",
      detail: amountOk
        ? `Amount within ceiling ${ceiling ?? "unbounded"}.`
        : `Amount ${amount} exceeds ceiling ${ceiling}.`,
    });

    const confirmationRequired = this.tool.boundaries.some((b) => b.primitive === "CONFIRMATION_REQUIREMENT");
    const confirmationOk = !confirmationRequired || inputs.confirmation === true;
    checks.push({
      key: "policy",
      outcome: confirmationOk ? "PASS" : "FAIL",
      detail: confirmationOk ? "Explicit confirmation present." : "Explicit confirmation required.",
    });

    const reassignmentPolicyOk = this.tool.name !== "reassign_support_ticket"
      || inputs.ownerUnavailable === true || inputs.ownerUnavailable === "true"
      || inputs.requiredSkillMismatch === true || inputs.requiredSkillMismatch === "true";
    checks.push({
      key: "policy",
      outcome: reassignmentPolicyOk ? "PASS" : "FAIL",
      detail: reassignmentPolicyOk ? "Owner availability or required-skill mismatch evidence present." : "Reassignment requires current owner unavailable or required skill mismatch.",
    });

    const denied = !actorOk || !amountOk || !confirmationOk || !reassignmentPolicyOk;
    return {
      outcome: denied ? "DENIED" : "ALLOWED",
      reason: denied
        ? "The mutation consequence failed one or more Commit boundaries."
        : "The exact mutation consequence is authorized.",
      checks,
    };
  }
}

export interface MutationCommitEngineOptions {
  store?: InMemoryAuthorizationArtifactStore;
}

/**
 * Build a Commit engine for MUTATION tools. Each call performs a fresh
 * Resolve → Commit → artifact issue for the exact consequence. Returns
 * `{ authorized: false }` with a reason when any boundary fails or the Commit
 * decision is not AUTHORIZED.
 */
export function createMutationCommitEngine(options: MutationCommitEngineOptions = {}): (tool: WebMCPToolDefinition, input: unknown) => Promise<FreshCommitResult> {
  return async (tool, input) => {
    const context = input as MutationInvocationContext;
    const provider = new SimulationDecisionProvider(mutationPack(tool), new MutationPolicy(tool));
    const state: MutationState = { version: 1, applied: [] };

    const candidate = await provider.resolve(context, state);
    const decision = await provider.commit(candidate, state);

    if (decision.status !== "AUTHORIZED") {
      const failed = decision.checks.filter((c) => c.outcome === "FAIL").map((c) => c.detail);
      const reason = failed.length > 0 ? failed.join(" ") : decision.reason;
      return { authorized: false, reason };
    }

    const store = options.store ?? new InMemoryAuthorizationArtifactStore();
    const issuer = new AuthorizationArtifactIssuer(store);
    const artifact = issuer.issue({
      commitId: decision.candidate.candidateId,
      effectFingerprint: stableFingerprint(decision.candidate.proposedEffect),
      baseStateFingerprint: decision.candidate.baseStateFingerprint,
      actor: context.actor,
      capability: tool.name,
    });

    const effect: AuthorizedEffect = { artifact, substrate: "WEBMCP", payload: context };
    return { authorized: true, effect };
  };
}
