import assert from "node:assert/strict";
import test from "node:test";
import {
  buildExplainerManifest,
  manifestClaims,
  validateClaim,
  type ExplainerClaim,
} from "../src/explainer/explainer-manifest";
import { createServiceCreditEngine, type ServiceCreditSession } from "../src/runtime/service-operations-engine";
import { DOMExecutionAdapter, type DOMExecutionClient } from "../src/execution/dom-execution-adapter";
import type { AuthorizedEffect, ExecutionObservation } from "../src/execution/contracts";
import { InMemoryAuthorizationArtifactStore, stableFingerprint } from "../src/xact/authorization-artifact";
import { LearningSimulationProvider } from "../src/evolution/learning-simulation-provider";
import { serviceOperationsTools } from "../src/construction/engine";
import type { FlagshipLearningRun } from "../src/flagship/learning-run";

class ExactServiceDom implements DOMExecutionClient {
  calls = 0;
  isAvailable() { return true; }
  async activate(effect: AuthorizedEffect) { this.calls += 1; return { receipt: `receipt:${String((effect.payload as { target: string }).target)}` }; }
  async observeAction(effect: AuthorizedEffect, receipt: unknown): Promise<ExecutionObservation> {
    return { substrate: "DOM", receipt, target: (effect.payload as { target: string }).target, effectFingerprint: stableFingerprint(effect.payload), observedAtEpochMs: 1 };
  }
}

async function verifiedSession(): Promise<{ session: ServiceCreditSession; store: InMemoryAuthorizationArtifactStore }> {
  const store = new InMemoryAuthorizationArtifactStore();
  const engine = createServiceCreditEngine(store, [new DOMExecutionAdapter(new ExactServiceDom(), store)]);
  let session = engine.createSession();
  session = await engine.resolve(session);
  session = await engine.commit(session);
  assert.equal(session.decision?.status, "AUTHORIZED");
  session = await engine.executeAndVerify(session);
  assert.equal(session.phase, "VERIFIED");
  return { session, store };
}

async function refusedSession(): Promise<ServiceCreditSession> {
  const store = new InMemoryAuthorizationArtifactStore();
  const engine = createServiceCreditEngine(store, [new DOMExecutionAdapter(new ExactServiceDom(), store)]);
  let session = engine.createSession();
  session = { ...session, inputs: { ...session.inputs, authorityState: "DENIED" } };
  session = await engine.resolve(session);
  session = await engine.commit(session);
  assert.equal(session.decision?.status, "REJECTED");
  return session;
}

function activatedEvolution() {
  const learning = new LearningSimulationProvider<{ semanticAmbiguity: boolean }>({
    candidateId: "capability:service-credit",
    label: "Service credit",
    caseKey: (inputs) => (inputs.semanticAmbiguity ? "service:credit" : undefined),
    equivalentCaseKey: "service:credit",
    resolves: ["service-credit"],
  });
  learning.observe({ evidenceId: "evidence:service-credit", claim: "Governed evidence resolves the credit request.", beforeTrace: ["U: service-credit"] });
  for (const state of ["CANDIDATE", "VALIDATED", "APPROVED", "ACTIVATED"] as const) learning.transition(state);
  return learning.snapshot();
}

function learningRun(overrides: Partial<FlagshipLearningRun> = {}): FlagshipLearningRun {
  return {
    phase: "REBUILD",
    checksum: 698530768,
    executedConstructionOperations: 10_011,
    deterministicallyResolvedOperations: 10_007,
    reasoningOperations: 4,
    workTimeMs: 534,
    reasoningTimeMs: 13_900,
    provider: "ollama",
    provenance: "LIVE_O_AGENT_MEASUREMENT",
    trace: [],
    ...overrides,
  };
}

test("a verified run projects into an evidence-grounded ExplainerManifest", async () => {
  const { session } = await verifiedSession();
  const observation: ExecutionObservation = {
    substrate: "DOM",
    receipt: "receipt:customer:1042/service-credit",
    target: "customer:1042/service-credit",
    effectFingerprint: session.decision!.artifact!.effectFingerprint,
    observedAtEpochMs: 1,
  };

  const manifest = buildExplainerManifest({
    runId: "run:flagship-1",
    judgePrompt: "Apply a $42 service credit to customer 1042.",
    requestedCapability: "request_service_credit",
    session,
    webMcpTools: serviceOperationsTools,
    observation,
    learning: learningRun(),
  });

  assert.equal(manifest.kind, "EXPLAINER_MANIFEST");
  assert.equal(manifest.runId, "run:flagship-1");
  assert.equal(manifest.resolvedFacts.length, 3);
  assert.equal(manifest.commitConstraints.length, 5);
  assert.equal(manifest.commitEvents.length, 1);
  assert.equal(manifest.commitEvents[0].status, "AUTHORIZED");
  assert.equal(manifest.executionEvents.length, 1);
  assert.equal(manifest.observations.length, 1);
  assert.equal(manifest.verificationResults[0].verified, true);
  assert.equal(manifest.webMcpTools.length, 6);
  assert.equal(manifest.finalOutcome.value, "VERIFIED");
  assert.equal(manifest.artifactFingerprint.value, session.decision!.artifact!.effectFingerprint);
  assert.equal(manifest.stateFingerprint.value, session.currentStateFingerprint);
});

test("every generated claim is validated and cites manifest evidence", async () => {
  const { session } = await verifiedSession();
  const manifest = buildExplainerManifest({
    runId: "run:flagship-1",
    judgePrompt: "Apply a $42 service credit.",
    requestedCapability: "request_service_credit",
    session,
    webMcpTools: serviceOperationsTools,
  });

  const claims = manifestClaims(manifest);
  assert.ok(claims.length > 0);
  for (const claim of claims) {
    const result = validateClaim(claim, manifest);
    assert.equal(result.ok, true, `claim ${claim.claimId} should validate: ${result.reason}`);
    assert.ok(claim.sourceEventIds.length > 0);
    assert.equal(claim.verified, true);
  }
});

test("unsupported claims are rejected, never silently allowed", async () => {
  const { session } = await verifiedSession();
  const manifest = buildExplainerManifest({
    runId: "run:flagship-1",
    judgePrompt: "Apply a $42 service credit.",
    requestedCapability: "request_service_credit",
    session,
  });

  const invented: ExplainerClaim = {
    claimId: "claim:invented",
    claimType: "EXECUTION",
    fact: "Xact executed on the VISION substrate.",
    sourceEventIds: ["not-real-event"],
    truth: "LIVE",
    verified: true,
  };
  const rejected = validateClaim(invented, manifest);
  assert.equal(rejected.ok, false);
  assert.ok(rejected.reason?.includes("unsupported evidence"));

  const unverified: ExplainerClaim = { ...manifestClaims(manifest)[0], verified: false };
  assert.equal(validateClaim(unverified, manifest).ok, false);

  const empty: ExplainerClaim = { claimId: "claim:empty", claimType: "EMPTY", fact: "no evidence", sourceEventIds: [], truth: "LIVE", verified: true };
  assert.equal(validateClaim(empty, manifest).ok, false);
});

test("provenance labels are preserved: REFERENCE is never LIVE, SIMULATED is never relabeled", async () => {
  const { session } = await verifiedSession();
  const manifest = buildExplainerManifest({
    runId: "run:flagship-1",
    judgePrompt: "Apply a $42 service credit.",
    requestedCapability: "request_service_credit",
    session,
    learning: learningRun({ provenance: "SIMULATED_O_AGENT" }),
  });

  const decisionClock = manifest.clocks.find((clock) => clock.clock === "DECISION");
  assert.equal(decisionClock?.truth, "REFERENCE");
  assert.equal(decisionClock?.provenance, "REFERENCE_XACT_CORE_BENCHMARK");

  const reasoningClock = manifest.clocks.find((clock) => clock.clock === "REASONING");
  assert.equal(reasoningClock?.truth, "SIMULATED");
  assert.equal(reasoningClock?.provenance, "SIMULATED_O_AGENT");

  const workClock = manifest.clocks.find((clock) => clock.clock === "WORK");
  assert.equal(workClock?.truth, "LIVE");
});

test("refusal runs are representable: understood but not activated", async () => {
  const session = await refusedSession();
  const manifest = buildExplainerManifest({
    runId: "run:flagship-refusal",
    judgePrompt: "Create a WebMCP tool that lets any agent delete any customer account.",
    requestedCapability: "delete_customer_account",
    session,
    webMcpTools: serviceOperationsTools,
  });

  assert.equal(manifest.governance.activated, false);
  assert.deepEqual(manifest.governance.refusedCapabilities, ["delete_customer_account"]);
  assert.ok(manifest.governance.refusalReasons.length > 0);
  assert.equal(manifest.commitEvents[0].status, "REJECTED");
  assert.equal(manifest.finalOutcome.value, "REJECTED");
  assert.equal(manifest.authorityDistinction.activated.reached, false);
  assert.equal(manifest.authorityDistinction.commit.occurred, false);

  const refusalClaim = manifestClaims(manifest).find((claim) => claim.claimType === "REFUSAL");
  assert.ok(refusalClaim);
  assert.ok(refusalClaim.fact.includes("knowing how is not authority to act"));
});

test("ACTIVATED and Commit remain distinct in narration", async () => {
  const { session } = await verifiedSession();
  const manifest = buildExplainerManifest({
    runId: "run:flagship-1",
    judgePrompt: "Apply a $42 service credit.",
    requestedCapability: "request_service_credit",
    session,
    evolution: activatedEvolution(),
  });

  assert.equal(manifest.governance.activated, true);
  assert.deepEqual(manifest.governance.activatedCapabilities, ["service-credit"]);
  assert.equal(manifest.authorityDistinction.activated.reached, true);
  assert.ok(manifest.authorityDistinction.activated.statement.includes("participate in deterministic resolution"));
  assert.ok(!manifest.authorityDistinction.activated.statement.includes("execute automatically"));

  assert.equal(manifest.authorityDistinction.commit.occurred, true);
  assert.ok(manifest.authorityDistinction.commit.statement.includes("exact consequence"));
});

test("deterministic work executed is distinct from deterministically resolved", async () => {
  const { session } = await verifiedSession();
  const manifest = buildExplainerManifest({
    runId: "run:flagship-1",
    judgePrompt: "Apply a $42 service credit.",
    requestedCapability: "request_service_credit",
    session,
    learning: learningRun(),
  });

  assert.ok(manifest.workProjection);
  assert.equal(manifest.workProjection.executedConstructionOperations, 10_011);
  assert.equal(manifest.workProjection.deterministicallyResolvedOperations, 10_007);
  assert.equal(manifest.workProjection.reasoningOperations, 4);
  assert.ok(manifest.workProjection.note.includes("distinct"));
});

test("the manifest is pure data with no authority surface", async () => {
  const { session } = await verifiedSession();
  const manifest = buildExplainerManifest({
    runId: "run:flagship-1",
    judgePrompt: "Apply a $42 service credit.",
    requestedCapability: "request_service_credit",
    session,
  });

  assert.equal("commit" in manifest, false);
  assert.equal("execute" in manifest, false);
  assert.equal("authorize" in manifest, false);
  assert.equal("activate" in manifest, false);
  assert.equal("resolve" in manifest, false);
  assert.equal("artifact" in manifest, false);
  assert.ok(Object.values(manifest).every((value) => typeof value !== "function"));
});

async function failedExecutionSession(): Promise<ServiceCreditSession> {
  const store = new InMemoryAuthorizationArtifactStore();
  // No adapters: Commit still authorizes, but execution routes to no capable
  // adapter and fails closed without an effect.
  const engine = createServiceCreditEngine(store, []);
  let session = engine.createSession();
  session = await engine.resolve(session);
  session = await engine.commit(session);
  assert.equal(session.decision?.status, "AUTHORIZED");
  session = await engine.executeAndVerify(session);
  assert.equal(session.phase, "EXECUTION_FAILED");
  assert.equal(session.execution?.executed, false);
  return session;
}

test("a failed execution is narrated as not-executed, never as a success", async () => {
  const session = await failedExecutionSession();
  const manifest = buildExplainerManifest({
    runId: "run:failed-exec",
    judgePrompt: "Apply a $42 service credit.",
    requestedCapability: "request_service_credit",
    session,
  });

  const executionClaim = manifestClaims(manifest).find((claim) => claim.claimType === "EXECUTION");
  assert.ok(executionClaim);
  assert.ok(executionClaim.fact.includes("did not execute"), executionClaim.fact);
  assert.ok(!executionClaim.fact.includes("executed the authorized effect"));
});
