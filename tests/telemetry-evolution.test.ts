import assert from "node:assert/strict";
import test from "node:test";
import { LearningSimulationProvider } from "../src/evolution/learning-simulation-provider";
import { createCommerceSimulationEngine } from "../src/runtime/commerce-engine";
import type { CommerceScenarioInputs } from "../src/scenarios/commerce-v1";
import { referenceXactBenchmark } from "../src/telemetry/reference-benchmark";
import { PerformanceTelemetryProvider } from "../src/telemetry/performance-telemetry-provider";

test("keeps reference benchmark evidence distinct from live sandbox measurements", async () => {
  const telemetry = new PerformanceTelemetryProvider();
  const checkpoint = telemetry.checkpoint();

  await telemetry.measure("RESOLVE", () => 42);
  const [sample] = telemetry.samplesSince(checkpoint);

  assert.equal(referenceXactBenchmark.kind, "REFERENCE_BENCHMARK");
  assert.equal(referenceXactBenchmark.appliesTo, "REFERENCE_IMPLEMENTATION_NOT_SANDBOX");
  assert.equal(referenceXactBenchmark.iterations, 3_000);
  assert.equal(referenceXactBenchmark.meanDecisionLatencyUs, 9);
  assert.equal(sample?.kind, "LIVE_SANDBOX_MEASUREMENT");
  assert.equal(sample?.stage, "RESOLVE");
  assert.ok((sample?.durationUs ?? -1) >= 0);
});

test("requires every governed lifecycle transition in order", () => {
  const learning = new LearningSimulationProvider<{ caseKey: string }>({
    candidateId: "candidate-demo",
    label: "Public-safe semantic resolution",
    caseKey: (input) => input.caseKey,
    equivalentCaseKey: "case-a",
    resolves: ["semantic-field"],
  });

  learning.observe({
    evidenceId: "evidence-demo",
    claim: "Structured evidence resolved the public demo field.",
    beforeTrace: ["R: deterministic facts", "U: semantic-field", "O-Agent: invoked"],
  });

  assert.equal(learning.snapshot().candidate?.state, "OBSERVED");
  assert.throws(() => learning.transition("APPROVED"), /next governed state/);

  for (const state of ["CANDIDATE", "VALIDATED", "APPROVED", "ACTIVE"] as const) {
    learning.transition(state);
    assert.equal(learning.snapshot().candidate?.state, state);
  }
});

test("does not inject deterministic evidence until governance activates the candidate", async () => {
  const learning = new LearningSimulationProvider<{ caseKey: string }>({
    candidateId: "candidate-demo",
    label: "Public-safe semantic resolution",
    caseKey: (input) => input.caseKey,
    equivalentCaseKey: "case-a",
    resolves: ["semantic-field"],
  });

  learning.observe({
    evidenceId: "evidence-demo",
    claim: "Structured evidence resolved the public demo field.",
    beforeTrace: ["U: semantic-field", "O-Agent: invoked"],
  });

  for (const state of ["OBSERVED", "CANDIDATE", "VALIDATED", "APPROVED"] as const) {
    assert.deepEqual(await learning.collect({ caseKey: "case-a" }), []);
    if (state !== "APPROVED") {
      const next = state === "OBSERVED" ? "CANDIDATE" : state === "CANDIDATE" ? "VALIDATED" : "APPROVED";
      learning.transition(next);
    }
  }

  learning.transition("ACTIVE");
  const evidence = await learning.collect({ caseKey: "case-a" });

  assert.equal(evidence.length, 1);
  assert.deepEqual(evidence[0]?.resolves, ["semantic-field"]);
  assert.match(evidence[0]?.provenance ?? "", /Public-safe governed simulation/);
  assert.deepEqual(await learning.collect({ caseKey: "different-case" }), []);
});

test("reports simulated coverage improvement without presenting it as reference evidence", () => {
  const learning = new LearningSimulationProvider<{ caseKey: string }>({
    candidateId: "candidate-demo",
    label: "Public-safe semantic resolution",
    caseKey: (input) => input.caseKey,
    equivalentCaseKey: "case-a",
    resolves: ["semantic-field"],
  });

  learning.observe({ evidenceId: "evidence-demo", claim: "Resolved.", beforeTrace: [] });
  for (const state of ["CANDIDATE", "VALIDATED", "APPROVED", "ACTIVE"] as const) {
    learning.transition(state);
  }
  learning.recordReplay(["R: semantic-field", "U: none", "O-Agent: not invoked", "Commit: still required"]);

  const snapshot = learning.snapshot();
  assert.equal(snapshot.kind, "PUBLIC_SAFE_SIMULATION");
  assert.deepEqual(snapshot.coverage.map((point) => point.deterministicCoveragePercent), [80, 100]);
  assert.deepEqual(snapshot.coverage.map((point) => point.reasoningFrequencyPercent), [20, 0]);
  assert.match(snapshot.afterTrace.join(" "), /Commit: still required/);
});

test("captures measured deterministic and reasoning stages from the live runtime", async () => {
  const engine = createCommerceSimulationEngine();
  let session = engine.updateInputs(engine.createSession(), { semanticAmbiguity: true });

  session = await engine.resolve(session);
  session = await engine.commit(session);
  session = await engine.addReasoningEvidenceAndReenter(session);
  session = await engine.commit(session);
  session = await engine.executeAndVerify(session);

  const stages = session.telemetry.map((sample) => sample.stage);
  for (const stage of ["RESOLVE", "COMMIT", "REASONING", "REENTRY", "POLICY", "VERIFICATION"] as const) {
    assert.ok(stages.includes(stage), `${stage} should be measured`);
  }
  assert.ok(session.telemetry.every((sample) => sample.durationUs >= 0));
});

test("active learning resolves an equivalent case but does not bypass Commit", async () => {
  const learning = new LearningSimulationProvider<CommerceScenarioInputs>({
    candidateId: "commerce-rationale-v1",
    label: "Delivery-consistent service recovery",
    caseKey: (inputs) => inputs.semanticAmbiguity ? "commerce:delivery-consistent" : undefined,
    equivalentCaseKey: "commerce:delivery-consistent",
    resolves: ["refund-rationale"],
  });
  learning.observe({
    evidenceId: "evidence-demo",
    claim: "The public demo rationale is consistent with the simulated delivery record.",
    beforeTrace: ["U: refund-rationale", "O-Agent: invoked"],
  });
  for (const state of ["CANDIDATE", "VALIDATED", "APPROVED", "ACTIVE"] as const) {
    learning.transition(state);
  }

  const engine = createCommerceSimulationEngine({ resolutionEvidenceProvider: learning });
  let session = engine.updateInputs(engine.createSession(), { semanticAmbiguity: true });
  session = await engine.resolve(session);

  assert.equal(session.candidate?.resolution.unresolved.length, 0);
  assert.equal(session.candidate?.reasoningEvidence.length, 0);
  assert.equal(session.decision, undefined);
  assert.equal(session.selectedSubstrate, "NONE");
  await assert.rejects(() => engine.executeAndVerify(session), /AUTHORIZED/);

  session = await engine.commit(session);
  assert.equal(session.decision?.status, "AUTHORIZED");
});

test("active learning cannot convert unknown authority into authorization", async () => {
  const learning = new LearningSimulationProvider<CommerceScenarioInputs>({
    candidateId: "commerce-rationale-v1",
    label: "Delivery-consistent service recovery",
    caseKey: (inputs) => inputs.semanticAmbiguity ? "commerce:delivery-consistent" : undefined,
    equivalentCaseKey: "commerce:delivery-consistent",
    resolves: ["refund-rationale"],
  });
  learning.observe({ evidenceId: "evidence-demo", claim: "Resolved.", beforeTrace: [] });
  for (const state of ["CANDIDATE", "VALIDATED", "APPROVED", "ACTIVE"] as const) {
    learning.transition(state);
  }

  const engine = createCommerceSimulationEngine({ resolutionEvidenceProvider: learning });
  let session = engine.createSession({ semanticAmbiguity: true, authorityState: "UNKNOWN" });
  session = await engine.resolve(session);
  session = await engine.commit(session);

  assert.equal(session.candidate?.resolution.unresolved.length, 0);
  assert.equal(session.decision?.status, "ESCALATED");
  assert.equal(session.selectedSubstrate, "NONE");
});
