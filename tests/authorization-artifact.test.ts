import assert from "node:assert/strict";
import test from "node:test";
import {
  AuthorizationArtifactIssuer,
  InMemoryAuthorizationArtifactStore,
  stableFingerprint,
} from "../src/xact/authorization-artifact";
import { SimulatedExecutionAdapter } from "../src/execution/simulated-adapter";
import { DeterministicExecutionRouter } from "../src/execution/execution-router";
import { createCommerceSimulationEngine } from "../src/runtime/commerce-engine";
import type { AuthorizationArtifact } from "../src/xact/contracts";
import type { AuthorizedEffect } from "../src/execution/contracts";

function setup() {
  const store = new InMemoryAuthorizationArtifactStore();
  const issuer = new AuthorizationArtifactIssuer(store);
  return { store, issuer };
}

test("store records and authenticates the exact issued artifact", () => {
  const { store, issuer } = setup();
  const artifact = issuer.issue({
    commitId: "c:1",
    effectFingerprint: "f",
    baseStateFingerprint: "s",
    actor: "support.agent",
    capability: "refund:create",
  });
  assert.equal(store.issued(artifact), true);
});

test("rejects an artifact not issued by Xact", async () => {
  const { store } = setup();
  const adapter = new SimulatedExecutionAdapter("WEBMCP", store);
  const forged: AuthorizationArtifact = {
    commitId: "c:forged",
    effectFingerprint: "f",
    baseStateFingerprint: "s",
    actor: "a",
    capability: "c",
    nonce: "n",
    issuedAtEpochMs: 0,
    expiresAtEpochMs: Date.now() + 10_000,
  };
  const validation = await adapter.validate(forged, {}, "s");
  assert.equal(validation.valid, false);
  assert.match(validation.reason ?? "", /not issued/i);
});

test("rejects a tampered artifact (any field changed)", async () => {
  const { store, issuer } = setup();
  const artifact = issuer.issue({
    commitId: "c:1",
    effectFingerprint: "f",
    baseStateFingerprint: "s",
    actor: "a",
    capability: "c",
  });
  const tampered = { ...artifact, effectFingerprint: "DIFFERENT" };
  const adapter = new SimulatedExecutionAdapter("WEBMCP", store);
  const validation = await adapter.validate(tampered, {}, "s");
  assert.equal(validation.valid, false);
  assert.match(validation.reason ?? "", /not issued|tampered/i);
});

test("rejects a malformed artifact", async () => {
  const { store } = setup();
  const adapter = new SimulatedExecutionAdapter("WEBMCP", store);
  const malformed: AuthorizationArtifact = {
    commitId: "c:1",
    effectFingerprint: stableFingerprint({}),
    baseStateFingerprint: "s",
    actor: "a",
    capability: "", // malformed: empty
    nonce: "n",
    issuedAtEpochMs: 0,
    expiresAtEpochMs: Date.now() + 10_000,
  };
  store.record(malformed);
  const validation = await adapter.validate(malformed, {}, "s");
  assert.equal(validation.valid, false);
  assert.match(validation.reason ?? "", /malformed/i);
});

test("expiresAtEpochMs equal to now is stale (strictly greater)", async () => {
  const store = new InMemoryAuthorizationArtifactStore();
  const now = () => 1_000_000;
  const artifact: AuthorizationArtifact = {
    commitId: "c:1",
    effectFingerprint: "f",
    baseStateFingerprint: "s",
    actor: "a",
    capability: "c",
    nonce: "n",
    issuedAtEpochMs: 999_000,
    expiresAtEpochMs: 1_000_000, // === now → stale
  };
  store.record(artifact);
  const adapter = new SimulatedExecutionAdapter("WEBMCP", store, now);
  const validation = await adapter.validate(artifact, {}, "s");
  assert.equal(validation.valid, false);
  assert.match(validation.reason ?? "", /expired/i);
});

test("rejects when the effect payload does not match the artifact fingerprint", async () => {
  const { store, issuer } = setup();
  const artifact = issuer.issue({
    commitId: "c:1",
    effectFingerprint: stableFingerprint({ amount: 42 }),
    baseStateFingerprint: "s",
    actor: "a",
    capability: "c",
  });
  const adapter = new SimulatedExecutionAdapter("WEBMCP", store);
  const validation = await adapter.validate(artifact, { amount: 999 }, "s");
  assert.equal(validation.valid, false);
  assert.match(validation.reason ?? "", /effect/i);
});

test("rejects when the current state fingerprint is stale", async () => {
  const { store, issuer } = setup();
  const artifact = issuer.issue({
    commitId: "c:1",
    effectFingerprint: stableFingerprint({}),
    baseStateFingerprint: "s",
    actor: "a",
    capability: "c",
  });
  const adapter = new SimulatedExecutionAdapter("WEBMCP", store);
  const validation = await adapter.validate(artifact, {}, "s-CHANGED");
  assert.equal(validation.valid, false);
  assert.match(validation.reason ?? "", /stale/i);
});

test("consumes a nonce exactly once", () => {
  const { store } = setup();
  assert.equal(store.consumeNonce("n"), true);
  assert.equal(store.consumeNonce("n"), false);
});

test("execute blocks a replayed nonce", async () => {
  const { store, issuer } = setup();
  const artifact = issuer.issue({
    commitId: "c:1",
    effectFingerprint: stableFingerprint({}),
    baseStateFingerprint: "s",
    actor: "a",
    capability: "c",
  });
  const adapter = new SimulatedExecutionAdapter("WEBMCP", store);
  const effect: AuthorizedEffect = { artifact, substrate: "WEBMCP", payload: {} };

  const first = await adapter.execute(effect);
  assert.equal(first.executed, true);

  const second = await adapter.execute(effect);
  assert.equal(second.executed, false);
  assert.match(second.error ?? "", /replay/i);
});

test("router selects deterministically by priority and explains the fallback", async () => {
  const { store, issuer } = setup();
  const router = new DeterministicExecutionRouter();
  const adapter = new SimulatedExecutionAdapter("VISION", store);
  const artifact = issuer.issue({
    commitId: "c:1",
    effectFingerprint: "f",
    baseStateFingerprint: "s",
    actor: "a",
    capability: "c",
  });
  const effect: AuthorizedEffect = { artifact, substrate: "VISION", payload: {} };
  const selection = await router.select(effect, [adapter]);
  assert.ok(selection.adapter);
  assert.match(selection.reason, /VISION selected/);
  assert.match(selection.reason, /LOCAL unavailable → WEBMCP unavailable → DOM unavailable/);
});

test("router fails closed when no adapter can handle the effect", async () => {
  const { store, issuer } = setup();
  const router = new DeterministicExecutionRouter();
  const artifact = issuer.issue({
    commitId: "c:1",
    effectFingerprint: "f",
    baseStateFingerprint: "s",
    actor: "a",
    capability: "c",
  });
  const effect: AuthorizedEffect = { artifact, substrate: "WEBMCP", payload: {} };
  const selection = await router.select(effect, []);
  assert.equal(selection.adapter, null);
  assert.match(selection.reason, /fail closed/i);
});

test("AUTHORIZED commit emits an artifact; non-AUTHORIZED carries none", async () => {
  const engine = createCommerceSimulationEngine();

  const authorized = await engine.commit(await engine.resolve(engine.createSession()));
  assert.equal(authorized.decision?.status, "AUTHORIZED");
  assert.ok(authorized.decision?.artifact);
  assert.equal(authorized.decision?.artifact?.capability, "refund:create");

  const rejected = await engine.commit(
    await engine.resolve(engine.createSession({ refundAmount: 120 })),
  );
  assert.equal(rejected.decision?.status, "REJECTED");
  assert.equal(rejected.decision?.artifact, undefined);
});

test("execution validates the artifact before causing an effect", async () => {
  const engine = createCommerceSimulationEngine();
  const session = await engine.commit(await engine.resolve(engine.createSession()));
  const artifact = session.decision?.artifact;
  assert.ok(artifact);

  const verified = await engine.executeAndVerify(session);
  assert.equal(verified.phase, "VERIFIED");
  // The nonce is consumed exactly once; a second execution attempt is a replay.
  await assert.rejects(() => engine.executeAndVerify(session), /stale|replay|AUTHORIZED/i);
});
