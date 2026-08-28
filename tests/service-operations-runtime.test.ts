import assert from "node:assert/strict";
import test from "node:test";
import { DOMExecutionAdapter, type DOMExecutionClient } from "../src/execution/dom-execution-adapter";
import type { AuthorizedEffect, ExecutionObservation } from "../src/execution/contracts";
import { WebMCPExecutionAdapter, type WebMCPExecutionClient } from "../src/execution/webmcp-execution-adapter";
import { InMemoryAuthorizationArtifactStore, stableFingerprint } from "../src/xact/authorization-artifact";
import { createServiceCreditEngine } from "../src/runtime/service-operations-engine";

class UnavailableWebMCP implements WebMCPExecutionClient {
  isAvailable() { return false; }
  async requestAction(): Promise<{ receipt: unknown }> { throw new Error("must not execute"); }
  async observeAction(): Promise<ExecutionObservation> { throw new Error("must not observe"); }
}

class ExactServiceDom implements DOMExecutionClient {
  calls = 0;
  isAvailable() { return true; }
  async activate(effect: AuthorizedEffect) { this.calls += 1; return { receipt: `receipt:${String((effect.payload as { target: string }).target)}` }; }
  async observeAction(effect: AuthorizedEffect, receipt: unknown): Promise<ExecutionObservation> {
    return { substrate: "DOM", receipt, target: (effect.payload as { target: string }).target, effectFingerprint: stableFingerprint(effect.payload), observedAtEpochMs: 1 };
  }
}

test("Service Operations credit requires Commit, then falls back from unavailable WebMCP to DOM with the exact artifact-bound target", async () => {
  const store = new InMemoryAuthorizationArtifactStore();
  const dom = new ExactServiceDom();
  const engine = createServiceCreditEngine(store, [new WebMCPExecutionAdapter(new UnavailableWebMCP(), store), new DOMExecutionAdapter(dom, store)]);
  let session = engine.createSession();

  await assert.rejects(() => engine.executeAndVerify(session), /blocked until Commit/i);
  session = await engine.resolve(session);
  session = await engine.commit(session);
  assert.equal(session.decision?.status, "AUTHORIZED");
  assert.equal(session.decision?.artifact?.capability, "service_credit:apply");
  assert.equal(session.decision?.artifact?.effectFingerprint, stableFingerprint(session.decision?.candidate.proposedEffect));

  session = await engine.executeAndVerify(session);
  assert.equal(session.phase, "VERIFIED");
  assert.equal(session.selectedSubstrate, "DOM");
  assert.equal(session.execution?.executed, true);
  assert.equal(dom.calls, 1);
  assert.equal(session.currentState.appliedCredit, 42);
  assert.ok(session.trace.some((event) => /DOM selected/.test(event.detail)));
});

test("unknown authority fails closed and emits no Service Operations artifact", async () => {
  const store = new InMemoryAuthorizationArtifactStore();
  const engine = createServiceCreditEngine(store, [new DOMExecutionAdapter(new ExactServiceDom(), store)]);
  let session = engine.createSession();
  session = { ...session, inputs: { ...session.inputs, authorityState: "UNKNOWN" } };
  session = await engine.resolve(session);
  session = await engine.commit(session);

  assert.equal(session.decision?.status, "ESCALATED");
  assert.equal(session.decision?.artifact, undefined);
  await assert.rejects(() => engine.executeAndVerify(session), /blocked until Commit/i);
});
