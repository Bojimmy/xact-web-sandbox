import assert from "node:assert/strict";
import test from "node:test";
import {
  buildExplainerManifest,
  evidenceIndex,
  type ExplainerManifest,
} from "../src/explainer/explainer-manifest";
import { generateScript } from "../src/explainer/narration-script";
import { buildStoryboard, type Storyboard } from "../src/explainer/storyboard";
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
  session = await engine.executeAndVerify(session);
  assert.equal(session.phase, "VERIFIED");
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

async function buildHappyStoryboard() {
  const session = await verifiedWebMcpSession();
  const manifest = buildExplainerManifest({
    runId: "run:flagship-1",
    judgePrompt: "Add a WebMCP tool that applies a service credit but never without Commit.",
    requestedCapability: "request_service_credit",
    session,
    webMcpTools: undefined,
    observation: { substrate: "WEBMCP", receipt: "webmcp:receipt:customer:1042/service-credit", target: "customer:1042/service-credit", effectFingerprint: session.decision!.artifact!.effectFingerprint, observedAtEpochMs: 1 },
    evolution: activatedEvolution(),
    learning: learningRun(),
    learningBaseline: learningRun({ phase: "COLD", reasoningOperations: 30, deterministicallyResolvedOperations: 9_981 }),
  });
  return { manifest, storyboard: buildStoryboard(generateScript(manifest), manifest) };
}

test("a verified run produces a timed, grounded storyboard", async () => {
  const { manifest, storyboard } = await buildHappyStoryboard();
  const index = evidenceIndex(manifest);

  assert.equal(storyboard.kind, "EXPLAINER_STORYBOARD");
  assert.ok(storyboard.cards.length > 0);
  assert.ok(storyboard.totalDurationMs > 0);

  let expectedStart = 0;
  for (const card of storyboard.cards) {
    assert.equal(card.startMs, expectedStart);
    assert.ok(card.durationMs > 0);
    expectedStart += card.durationMs;

    assert.ok(["LIVE", "REFERENCE", "SIMULATED"].includes(card.provenanceBadge));
    for (const fact of card.facts) {
      assert.ok(fact.sourceEventIds.length > 0, `fact must carry evidence: "${fact.text}"`);
      for (const id of fact.sourceEventIds) {
        assert.ok(index.has(id), `fact evidence ${id} missing from manifest`);
      }
    }
  }
  assert.equal(expectedStart, storyboard.totalDurationMs);
});

test("the flagship sequence appears in order", async () => {
  const { storyboard } = await buildHappyStoryboard();
  const titles = storyboard.cards.map((card) => card.title);
  const expected = [
    "WHAT YOU ASKED",
    "WHAT XACT RESOLVED",
    "WHAT REQUIRED REASONING",
    "WHAT GOVERNANCE ALLOWED",
    "WHAT BECAME ACTIVATED",
    "WHAT COMMIT AUTHORIZED",
    "HOW IT EXECUTED",
    "WHAT XACT OBSERVED",
    "WHAT XACT VERIFIED",
    "WHAT XACT LEARNED",
  ];
  let cursor = 0;
  for (const title of titles) {
    if (cursor < expected.length && title === expected[cursor]) cursor += 1;
  }
  assert.equal(cursor, expected.length, `expected flagship sequence not found in order; got: ${titles.join(" | ")}`);
});

test("the three clocks are separate cards with correct badges, never blended", async () => {
  const { storyboard } = await buildHappyStoryboard();
  const clockCards = storyboard.cards.filter((card) => card.visualType === "CLOCK");
  assert.equal(clockCards.length, 3);

  const decision = clockCards.find((card) => card.clock === "DECISION");
  const work = clockCards.find((card) => card.clock === "WORK");
  const reasoning = clockCards.find((card) => card.clock === "REASONING");

  assert.ok(decision && decision.provenanceBadge === "REFERENCE");
  assert.ok(work && work.provenanceBadge === "LIVE");
  assert.ok(reasoning && reasoning.provenanceBadge === "LIVE");

  // Each clock card carries exactly one clock; the reference benchmark is isolated.
  for (const card of clockCards) {
    assert.equal(card.facts.filter((fact) => fact.clock !== undefined).length, 1);
  }
  assert.ok(decision!.facts[0].text.includes("reference"));
});

test("the learning result shows the exact measured delta, not a rounded −87", async () => {
  const { storyboard } = await buildHappyStoryboard();
  const learning = storyboard.cards.find((card) => card.visualType === "LEARNING");
  assert.ok(learning);
  const primary = learning.facts.find((fact) => fact.role === "PRIMARY");
  assert.equal(primary?.text, "30 → 4 O-Agent calls");

  const texts = learning.facts.map((fact) => fact.text);
  assert.ok(texts.some((text) => text.includes("-86.7%")));
  assert.ok(!texts.some((text) => text.includes("-87%") && !text.includes("-86.7%")));
  assert.ok(texts.some((text) => text.includes("698530768 → 698530768")));
});

test("missing observation evidence omits the observation card", async () => {
  const session = await verifiedWebMcpSession();
  const manifest = buildExplainerManifest({
    runId: "run:flagship-1",
    judgePrompt: "Apply a $42 service credit.",
    requestedCapability: "request_service_credit",
    session,
    // no observation
  });
  const storyboard = buildStoryboard(generateScript(manifest), manifest);
  assert.ok(!storyboard.cards.some((card) => card.visualType === "OBSERVATION"));
  assert.ok(!storyboard.cards.some((card) => card.title.includes("OBSERVED")));
});

test("the refusal path renders the refusal cards with the exact phrase", async () => {
  const session = await refusedSession();
  const manifest = buildExplainerManifest({
    runId: "run:flagship-refusal",
    judgePrompt: "Create a WebMCP tool that lets any agent delete any customer account.",
    requestedCapability: "delete_customer_account",
    session,
  });
  const storyboard = buildStoryboard(generateScript(manifest), manifest);
  const titles = storyboard.cards.map((card) => card.title);
  assert.ok(titles.includes("REQUEST UNDERSTOOD"));
  assert.ok(titles.includes("CAPABILITY POSSIBLE"));
  assert.ok(titles.includes("AUTHORITY NOT ESTABLISHED"));
  assert.ok(titles.includes("CAPABILITY NOT ACTIVATED"));

  const notActivated = storyboard.cards.find((card) => card.title === "CAPABILITY NOT ACTIVATED");
  assert.ok(notActivated);
  assert.ok(notActivated.facts.some((fact) => fact.text.includes("knowing how is not authority to act")));
  assert.ok(!storyboard.cards.some((card) => card.visualType === "ACTIVATION"));
});

test("simulated reasoning clock remains visibly simulated in the storyboard", async () => {
  const session = await verifiedWebMcpSession();
  const manifest = buildExplainerManifest({
    runId: "run:flagship-1",
    judgePrompt: "Apply a $42 service credit.",
    requestedCapability: "request_service_credit",
    session,
    learning: learningRun({ provenance: "SIMULATED_O_AGENT" }),
  });
  const storyboard = buildStoryboard(generateScript(manifest), manifest);
  const reasoning = storyboard.cards.find((card) => card.visualType === "CLOCK" && card.clock === "REASONING");
  assert.ok(reasoning);
  assert.equal(reasoning.provenanceBadge, "SIMULATED");
  assert.ok(reasoning.facts[0].text.includes("simulated"));
});
