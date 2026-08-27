import assert from "node:assert/strict";
import test from "node:test";
import { createCommerceSimulationEngine } from "../src/runtime/commerce-engine";
import { commerceScenarioPack } from "../src/scenarios/commerce-v1";

test("preserves the authorized path through simulated execution and verification", async () => {
  const engine = createCommerceSimulationEngine();
  let session = engine.createSession();

  session = await engine.resolve(session);
  session = await engine.commit(session);

  assert.equal(session.decision?.status, "AUTHORIZED");
  assert.equal(session.selectedSubstrate, "WEBMCP");
  assert.equal(session.execution, undefined);

  session = await engine.executeAndVerify(session);

  assert.equal(session.execution?.executed, true);
  assert.equal(session.verification?.verified, true);
  assert.equal(session.phase, "VERIFIED");
});

test("changes an allowed refund into a final over-limit rejection", async () => {
  const engine = createCommerceSimulationEngine();
  let session = engine.createSession();

  session = engine.updateInputs(session, { refundAmount: 60 });
  session = await engine.resolve(session);
  session = await engine.commit(session);
  assert.equal(session.decision?.status, "AUTHORIZED");

  session = engine.updateInputs(session, { refundAmount: 120 });
  session = await engine.resolve(session);
  session = await engine.commit(session);

  assert.equal(session.decision?.status, "REJECTED");
  assert.equal(session.decision?.reentryAllowed, false);
  assert.equal(session.selectedSubstrate, "NONE");
  assert.equal(session.execution, undefined);
});

test("rejects a candidate as stale when current state changes after Resolve", async () => {
  const engine = createCommerceSimulationEngine();
  let session = engine.createSession();

  session = await engine.resolve(session);
  const baseFingerprint = session.candidate?.baseStateFingerprint;
  session = engine.simulateConcurrentChange(session);
  assert.notEqual(session.currentStateFingerprint, baseFingerprint);

  session = await engine.commit(session);

  assert.equal(session.decision?.status, "STALE");
  assert.equal(session.selectedSubstrate, "NONE");
  assert.equal(session.execution, undefined);
  await assert.rejects(() => engine.executeAndVerify(session), /AUTHORIZED/);
});

test("freshness fails before unresolved semantics when both conditions are present", async () => {
  const engine = createCommerceSimulationEngine();
  let session = engine.updateInputs(engine.createSession(), { semanticAmbiguity: true });

  session = await engine.resolve(session);
  session = engine.simulateConcurrentChange(session);
  session = await engine.commit(session);

  assert.equal(session.decision?.status, "STALE");
  assert.equal(session.decision?.checks[0]?.key, "freshness");
  assert.equal(session.selectedSubstrate, "NONE");
});

test("escalates ambiguity, adds reasoning evidence, re-enters, and reaches a new Commit decision", async () => {
  const engine = createCommerceSimulationEngine();
  let session = engine.createSession();

  session = engine.updateInputs(session, { semanticAmbiguity: true });
  session = await engine.resolve(session);
  assert.equal(session.candidate?.resolution.unresolved.length, 1);

  session = await engine.commit(session);
  assert.equal(session.decision?.status, "ESCALATED");
  assert.equal(session.decision?.reentryAllowed, true);
  assert.equal(session.selectedSubstrate, "NONE");

  session = await engine.addReasoningEvidenceAndReenter(session);
  assert.equal(session.phase, "REENTERED");
  assert.equal(session.candidate?.resolution.unresolved.length, 0);
  assert.equal(session.decision, undefined);
  assert.ok(session.candidate?.evidence.some((item) => item.source === "Simulation O-Agent"));

  session = await engine.commit(session);
  assert.equal(session.decision?.status, "AUTHORIZED");
  assert.equal(session.selectedSubstrate, "WEBMCP");
});

test("fails closed when authority state is unknown", async () => {
  const engine = createCommerceSimulationEngine();
  let session = engine.createSession();

  session = engine.updateInputs(session, { authorityState: "UNKNOWN" });
  session = await engine.resolve(session);
  session = await engine.commit(session);

  assert.equal(session.decision?.status, "ESCALATED");
  assert.equal(session.decision?.reentryAllowed, true);
  assert.equal(session.selectedSubstrate, "NONE");
  assert.equal(session.execution, undefined);
});

test("blocks execution before Commit returns Authorized", async () => {
  const engine = createCommerceSimulationEngine();
  let session = engine.createSession();

  session = await engine.resolve(session);

  await assert.rejects(() => engine.executeAndVerify(session), /AUTHORIZED/);
  assert.equal(session.execution, undefined);
});

test("blocks an authorized effect when state changes after Commit", async () => {
  const engine = createCommerceSimulationEngine();
  let session = await engine.resolve(engine.createSession());
  session = await engine.commit(session);

  const changedState = { ...session.currentState, version: session.currentState.version + 1 };
  session = {
    ...session,
    currentState: changedState,
    currentStateFingerprint: commerceScenarioPack.stateFingerprint(changedState),
  };

  await assert.rejects(() => engine.executeAndVerify(session), /fresh Commit decision/);
  assert.equal(session.execution, undefined);
});

test("all non-authorized decisions select substrate NONE", async () => {
  const engine = createCommerceSimulationEngine();

  const rejected = await engine.commit(
    await engine.resolve(engine.updateInputs(engine.createSession(), { refundAmount: 120 })),
  );

  const escalated = await engine.commit(
    await engine.resolve(engine.updateInputs(engine.createSession(), { semanticAmbiguity: true })),
  );

  let stale = await engine.resolve(engine.createSession());
  stale = engine.simulateConcurrentChange(stale);
  stale = await engine.commit(stale);

  for (const session of [rejected, escalated, stale]) {
    assert.notEqual(session.decision?.status, "AUTHORIZED");
    assert.equal(session.selectedSubstrate, "NONE");
    assert.equal(session.execution, undefined);
  }
});

test("does not report success when post-execution verification fails", async () => {
  const engine = createCommerceSimulationEngine();
  let session = engine.createSession();

  session = engine.updateInputs(session, { verificationShouldPass: false });
  session = await engine.resolve(session);
  session = await engine.commit(session);
  session = await engine.executeAndVerify(session);

  assert.equal(session.execution?.executed, true);
  assert.equal(session.verification?.verified, false);
  assert.equal(session.phase, "VERIFICATION_FAILED");
});
