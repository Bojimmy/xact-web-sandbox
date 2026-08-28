import assert from "node:assert/strict";
import test from "node:test";
import {
  analyzeCapabilityRequest,
  CapabilityConstructionEngine,
} from "../src/flagship/capability-extension";

test("Stage 3 accepts only the declared audit-history capability and emits a descriptive candidate", () => {
  const result = analyzeCapabilityRequest("Show me audit history for customer 1042");

  assert.equal(result.door.admissible, true);
  assert.equal(result.ledger.valid, true);
  assert.equal(result.candidate?.id, "candidate:get_audit_history");
  assert.equal("execute" in result.candidate!, false);
  assert.equal("artifact" in result.candidate!, false);
});

test("a forbidden request is understood but fails Door with no candidate or execution surface", () => {
  const result = analyzeCapabilityRequest("Delete customer account 1042");

  assert.equal(result.door.admissible, false);
  assert.equal(result.ledger.valid, true);
  assert.equal(result.candidate, undefined);
  assert.match(result.door.errors.join(" "), /closed capability ontology/);
});

test("bounded capability construction requires a fresh AUTHORIZED Commit, artifact, local execution, and verification", async () => {
  const analysis = analyzeCapabilityRequest("Show me audit history for customer 1042");
  const engine = new CapabilityConstructionEngine();
  let session = engine.createSession(analysis.candidate!);

  await assert.rejects(() => engine.executeAndVerify(session), /blocked until Commit/);

  session = await engine.resolve(session);
  session = await engine.commit(session);
  assert.equal(session.decision?.status, "AUTHORIZED");
  assert.ok(session.decision?.artifact);

  session = await engine.executeAndVerify(session);
  assert.equal(session.phase, "VERIFIED");
  assert.equal(session.verification?.verified, true);
  assert.deepEqual(session.currentState.constructedCapabilityIds, ["candidate:get_audit_history"]);
  assert.equal(session.selectedSubstrate, "LOCAL");
});

test("construction replay is blocked after the effect changes the state binding", async () => {
  const analysis = analyzeCapabilityRequest("Show me audit history for customer 1042");
  const engine = new CapabilityConstructionEngine();
  let session = engine.createSession(analysis.candidate!);
  session = await engine.resolve(session);
  session = await engine.commit(session);
  session = await engine.executeAndVerify(session);

  await assert.rejects(() => engine.executeAndVerify(session), /state changed after Commit/);
});
