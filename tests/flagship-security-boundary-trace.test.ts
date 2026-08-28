import assert from "node:assert/strict";
import test from "node:test";
import { buildSecurityBoundaryTrace } from "../src/flagship/security-boundary-trace";

test("security trace fails closed before Door, Ledger, Commit, artifact, and verification facts exist", () => {
  const trace = buildSecurityBoundaryTrace({ requestSource: "Operator input" });
  const byId = new Map(trace.map((entry) => [entry.id, entry]));

  assert.equal(byId.get("source")?.status, "PASS");
  assert.equal(byId.get("provider")?.status, "PENDING");
  assert.equal(byId.get("door")?.status, "PENDING");
  assert.equal(byId.get("commit")?.status, "PENDING");
  assert.match(byId.get("commit")?.detail ?? "", /No artifact/);
});

test("security trace preserves a blocked capability-hijacking attempt as BLOCK", () => {
  const trace = buildSecurityBoundaryTrace({
    requestSource: "Operator input → deterministic bounded decomposition",
    doorPassed: false,
    ledgerPassed: false,
  });
  const byId = new Map(trace.map((entry) => [entry.id, entry]));

  assert.equal(byId.get("door")?.status, "BLOCK");
  assert.equal(byId.get("ledger")?.status, "BLOCK");
  assert.equal(byId.get("artifact")?.status, "PENDING");
  assert.match(byId.get("ledger")?.detail ?? "", /Authority-bearing proposal blocked/);
});

test("security trace distinguishes evidence, verified consequence, governance, and resolution-only activation from authority", () => {
  const trace = buildSecurityBoundaryTrace({
    requestSource: "Operator input → deterministic bounded decomposition",
    provider: "kimi",
    doorPassed: true,
    ledgerPassed: true,
    commitStatus: "AUTHORIZED",
    artifact: { commitId: "commit:1", capability: "resolution_capability:construct", effectFingerprint: "fp:1" },
    target: "xact:resolution-capability/candidate:get_audit_history",
    verification: { verified: true, reason: "Exact construction observed." },
    governanceActor: "Governance Review",
    promotionApproved: true,
    lifecycleState: "ACTIVATED",
  });
  const byId = new Map(trace.map((entry) => [entry.id, entry]));

  assert.equal(byId.get("provider")?.status, "EVIDENCE");
  assert.equal(byId.get("commit")?.status, "PASS");
  assert.equal(byId.get("artifact")?.status, "PASS");
  assert.equal(byId.get("verification")?.status, "VERIFIED");
  assert.equal(byId.get("governance")?.status, "RESOLUTION_ONLY");
  assert.match(byId.get("governance")?.detail ?? "", /fresh Commit/);
  assert.doesNotMatch(JSON.stringify(trace), /token|secret|api.?key/i);
});
