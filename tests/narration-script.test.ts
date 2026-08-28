import assert from "node:assert/strict";
import test from "node:test";
import {
  buildExplainerManifest,
  evidenceIndex,
  validateClaim,
  type ExplainerManifest,
} from "../src/explainer/explainer-manifest";
import {
  acceptNarrationDraft,
  generateScript,
  type NarrationDraft,
  type NarrationScript,
} from "../src/explainer/narration-script";
import { createServiceCreditEngine, type ServiceCreditSession } from "../src/runtime/service-operations-engine";
import { DOMExecutionAdapter, type DOMExecutionClient } from "../src/execution/dom-execution-adapter";
import { WebMCPExecutionAdapter, type WebMCPExecutionClient } from "../src/execution/webmcp-execution-adapter";
import type { AuthorizedEffect, ExecutionObservation } from "../src/execution/contracts";
import { InMemoryAuthorizationArtifactStore, stableFingerprint } from "../src/xact/authorization-artifact";
import { LearningSimulationProvider } from "../src/evolution/learning-simulation-provider";
import type { FlagshipLearningRun } from "../src/flagship/learning-run";

class ExactServiceDom implements DOMExecutionClient {
  isAvailable() { return true; }
  async activate(effect: AuthorizedEffect) { return { receipt: `receipt:${String((effect.payload as { target: string }).target)}` }; }
  async observeAction(effect: AuthorizedEffect, receipt: unknown): Promise<ExecutionObservation> {
    return { substrate: "DOM", receipt, target: (effect.payload as { target: string }).target, effectFingerprint: stableFingerprint(effect.payload), observedAtEpochMs: 1 };
  }
}

class AvailableWebMCP implements WebMCPExecutionClient {
  private lastEffect?: AuthorizedEffect;
  isAvailable() { return true; }
  async requestAction(effect: AuthorizedEffect) { this.lastEffect = effect; return { receipt: `webmcp:receipt:${String((effect.payload as { target: string }).target)}` }; }
  async observeAction(receipt: unknown): Promise<ExecutionObservation> {
    const effect = this.lastEffect!;
    return { substrate: "WEBMCP", receipt, target: (effect.payload as { target: string }).target, effectFingerprint: stableFingerprint(effect.payload), observedAtEpochMs: 1 };
  }
}

async function verifiedWebMcpSession(): Promise<ServiceCreditSession> {
  const store = new InMemoryAuthorizationArtifactStore();
  const engine = createServiceCreditEngine(store, [new WebMCPExecutionAdapter(new AvailableWebMCP(), store)]);
  let session = engine.createSession();
  session = await engine.resolve(session);
  session = await engine.commit(session);
  assert.equal(session.decision?.status, "AUTHORIZED");
  session = await engine.executeAndVerify(session);
  assert.equal(session.phase, "VERIFIED");
  assert.equal(session.selectedSubstrate, "WEBMCP");
  return session;
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

function sentences(script: NarrationScript) {
  return script.scenes.flatMap((scene) => scene.sentences);
}

function sentencesWith(script: NarrationScript, claimType: string) {
  return sentences(script).filter((sentence) => sentence.claims.some((claim) => claim.claimType === claimType));
}

function assertAllFactualGrounded(script: NarrationScript, manifest: ExplainerManifest) {
  const index = evidenceIndex(manifest);
  for (const sentence of sentences(script)) {
    if (sentence.kind === "TRANSITION") continue;
    assert.ok(sentence.sourceEventIds.length > 0, "factual sentence must have evidence");
    for (const id of sentence.sourceEventIds) {
      assert.ok(index.has(id), `sentence evidence ${id} must exist in the manifest`);
    }
    for (const claim of sentence.claims) {
      assert.equal(validateClaim(claim, manifest).ok, true);
    }
  }
}

test("normal authorized execution narrates Commit → Execute → Verify with the actual substrate", async () => {
  const session = await verifiedWebMcpSession();
  const manifest = buildExplainerManifest({
    runId: "run:flagship-1",
    judgePrompt: "Apply a $42 service credit to customer 1042.",
    requestedCapability: "request_service_credit",
    session,
    observation: { substrate: "WEBMCP", receipt: "webmcp:receipt:customer:1042/service-credit", target: "customer:1042/service-credit", effectFingerprint: session.decision!.artifact!.effectFingerprint, observedAtEpochMs: 1 },
  });

  const script = generateScript(manifest);
  assert.equal(script.kind, "EXPLAINER_SCRIPT");
  assertAllFactualGrounded(script, manifest);

  const commit = sentencesWith(script, "COMMIT");
  assert.equal(commit.length, 1);
  assert.ok(commit[0].text.includes("AuthorizationArtifact"));

  const execution = sentencesWith(script, "EXECUTION");
  assert.equal(execution.length, 1);
  assert.ok(execution[0].text.includes("WEBMCP"));

  const verification = sentencesWith(script, "VERIFICATION");
  assert.equal(verification.length, 1);
  assert.ok(verification[0].text.includes("verified"));
});

test("ACTIVATED capability narrates participation in resolution, never automatic execution", async () => {
  const session = await verifiedWebMcpSession();
  const manifest = buildExplainerManifest({
    runId: "run:flagship-1",
    judgePrompt: "Apply a $42 service credit.",
    requestedCapability: "request_service_credit",
    session,
    evolution: activatedEvolution(),
  });

  const script = generateScript(manifest);
  const activation = sentencesWith(script, "ACTIVATION");
  assert.equal(activation.length, 1);
  assert.ok(activation[0].text.includes("participate in deterministic resolution"));
  assert.ok(!activation[0].text.toLowerCase().includes("execute automatically"));
  assert.ok(!activation[0].text.toLowerCase().includes("automatically"));
});

test("forbidden capability refusal uses the exact refusal language", async () => {
  const session = await refusedSession();
  const manifest = buildExplainerManifest({
    runId: "run:flagship-refusal",
    judgePrompt: "Create a WebMCP tool that lets any agent delete any customer account.",
    requestedCapability: "delete_customer_account",
    session,
  });

  const script = generateScript(manifest);
  const refusal = sentencesWith(script, "REFUSAL");
  assert.equal(refusal.length, 1);
  assert.ok(refusal[0].text.includes("knowing how is not authority to act"));

  const commit = sentencesWith(script, "COMMIT");
  assert.equal(commit.length, 1);
  assert.ok(commit[0].text.includes("did not authorize"));
});

test("live learning comparison separates the three clocks and reports the delta", async () => {
  const session = await verifiedWebMcpSession();
  const baseline = learningRun({ phase: "COLD", reasoningOperations: 30, deterministicallyResolvedOperations: 9_981 });
  const manifest = buildExplainerManifest({
    runId: "run:flagship-1",
    judgePrompt: "Apply a $42 service credit.",
    requestedCapability: "request_service_credit",
    session,
    learning: learningRun(),
    learningBaseline: baseline,
  });

  assert.ok(manifest.reasoningComparison);
  assert.equal(manifest.reasoningComparison.callsBefore, 30);
  assert.equal(manifest.reasoningComparison.callsAfter, 4);
  assert.equal(manifest.reasoningComparison.checksumUnchanged, true);

  const script = generateScript(manifest);
  const clocks = sentences(script).filter((sentence) => sentence.claims.some((claim) => claim.claimType === "CLOCK"));

  const decision = clocks.find((sentence) => sentence.clock === "DECISION");
  const work = clocks.find((sentence) => sentence.clock === "WORK");
  const reasoning = clocks.find((sentence) => sentence.clock === "REASONING");
  assert.ok(decision && decision.truth === "REFERENCE");
  assert.ok(work && work.truth === "LIVE");
  assert.ok(reasoning && reasoning.truth === "LIVE");

  // Each clock is its own sentence; no sentence blends two clocks.
  for (const sentence of clocks) {
    assert.equal(sentence.claims.filter((claim) => claim.claimType === "CLOCK").length, 1);
  }

  const comparison = sentencesWith(script, "LEARNING_COMPARISON");
  assert.equal(comparison.length, 1);
  assert.ok(comparison[0].text.includes("30 to 4"));
  assert.ok(comparison[0].text.includes("stopped needing it"));
});

test("missing observation evidence omits the observation, never invents it", async () => {
  const session = await verifiedWebMcpSession();
  const manifest = buildExplainerManifest({
    runId: "run:flagship-1",
    judgePrompt: "Apply a $42 service credit.",
    requestedCapability: "request_service_credit",
    session,
    // No observation supplied: the session type does not retain it (ADR 0015).
  });

  assert.equal(manifest.observations.length, 0);
  const script = generateScript(manifest);
  const observations = sentencesWith(script, "OBSERVATION");
  assert.equal(observations.length, 0);
  assert.ok(!sentences(script).some((sentence) => /observed the/.test(sentence.text)));
});

test("simulated reasoning provenance remains visibly simulated", async () => {
  const session = await verifiedWebMcpSession();
  const manifest = buildExplainerManifest({
    runId: "run:flagship-1",
    judgePrompt: "Apply a $42 service credit.",
    requestedCapability: "request_service_credit",
    session,
    learning: learningRun({ provenance: "SIMULATED_O_AGENT" }),
  });

  const script = generateScript(manifest);
  const reasoning = sentences(script).find((sentence) => sentence.clock === "REASONING");
  assert.ok(reasoning);
  assert.equal(reasoning.truth, "SIMULATED");
  assert.ok(reasoning.text.includes("simulated"));
});

test("unsupported O-Agent narration is rejected", async () => {
  const session = await verifiedWebMcpSession();
  const manifest = buildExplainerManifest({
    runId: "run:flagship-1",
    judgePrompt: "Apply a $42 service credit.",
    requestedCapability: "request_service_credit",
    session,
  });

  const noEvidence: NarrationDraft = {
    scenes: [{ title: "X", sentences: [{ kind: "FACTUAL", text: "Xact executed on VISION.", sourceEventIds: [] }] }],
  };
  assert.equal(acceptNarrationDraft(noEvidence, manifest).ok, false);

  const unsupported: NarrationDraft = {
    scenes: [{ title: "X", sentences: [{ kind: "FACTUAL", text: "Xact did a thing.", sourceEventIds: ["not-a-real-event"] }] }],
  };
  const unsupportedResult = acceptNarrationDraft(unsupported, manifest);
  assert.equal(unsupportedResult.ok, false);
  if (!unsupportedResult.ok) assert.ok(unsupportedResult.reason.includes("unsupported evidence"));

  const relabel: NarrationDraft = {
    scenes: [{ title: "X", sentences: [{ kind: "FACTUAL", text: "Simulated reasoning happened.", sourceEventIds: ["referenceXactBenchmark"], truth: "LIVE" }] }],
  };
  const relabelResult = acceptNarrationDraft(relabel, manifest);
  assert.equal(relabelResult.ok, false);
  if (!relabelResult.ok) assert.ok(relabelResult.reason.includes("relabels"));

  const autoAuthority: NarrationDraft = {
    scenes: [{ title: "X", sentences: [{ kind: "FACTUAL", text: "The capability can now execute automatically.", sourceEventIds: ["session.decision"] }] }],
  };
  const autoResult = acceptNarrationDraft(autoAuthority, manifest);
  assert.equal(autoResult.ok, false);
  if (!autoResult.ok) assert.ok(autoResult.reason.includes("automatic authority"));

  const badTransition: NarrationDraft = {
    scenes: [{ title: "X", sentences: [{ kind: "TRANSITION", text: "Invented architecture claim.", architecturalKey: "not-in-library" }] }],
  };
  assert.equal(acceptNarrationDraft(badTransition, manifest).ok, false);
});

test("a fully grounded O-Agent draft is accepted and keeps provenance", async () => {
  const session = await verifiedWebMcpSession();
  const manifest = buildExplainerManifest({
    runId: "run:flagship-1",
    judgePrompt: "Apply a $42 service credit.",
    requestedCapability: "request_service_credit",
    session,
  });

  const draft: NarrationDraft = {
    scenes: [
      { title: "WHAT YOU ASKED", sentences: [{ kind: "FACTUAL", id: "ask", text: "The judge asked Xact to apply a service credit.", sourceEventIds: ["input.judgePrompt"] }] },
      { title: "COMMIT", sentences: [{ kind: "TRANSITION", architecturalKey: "authority" }, { kind: "FACTUAL", id: "commit", text: "Commit issued an AuthorizationArtifact.", sourceEventIds: ["session.decision"] }] },
    ],
  };

  const result = acceptNarrationDraft(draft, manifest);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.script.kind, "EXPLAINER_SCRIPT");
    assert.equal(result.script.scenes.length, 2);
    const factual = sentences(result.script).filter((sentence) => sentence.kind === "FACTUAL");
    assert.equal(factual.length, 2);
    assert.ok(factual.every((sentence) => sentence.truth === "LIVE"));
  }
});
