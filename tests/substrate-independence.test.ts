import assert from "node:assert/strict";
import test from "node:test";
import {
  AuthorizationArtifactIssuer,
  InMemoryAuthorizationArtifactStore,
  stableFingerprint,
} from "../src/xact/authorization-artifact";
import { BrowserDOMExecutionClient } from "../src/execution/browser-dom-client";
import type { AuthorizedEffect, ExecutionObservation } from "../src/execution/contracts";
import { DOMExecutionAdapter, type DOMExecutionClient } from "../src/execution/dom-execution-adapter";
import { DeterministicExecutionRouter } from "../src/execution/execution-router";
import { VisionExecutionAdapter, type VisionExecutionClient } from "../src/execution/vision-execution-adapter";
import { WebMCPExecutionAdapter, type WebMCPExecutionClient } from "../src/execution/webmcp-execution-adapter";
import { createCommerceSimulationEngine } from "../src/runtime/commerce-engine";

const payload = { type: "REFUND", amount: 42, rail: "ORIGINAL", target: "order:XC-MUTABLE/refund" };

function setup() {
  const store = new InMemoryAuthorizationArtifactStore();
  const artifact = new AuthorizationArtifactIssuer(store).issue({
    commitId: `phase4:${Math.random()}`,
    effectFingerprint: stableFingerprint(payload),
    baseStateFingerprint: "commerce:v1",
    actor: "support.agent",
    capability: "refund:create",
  });
  return {
    store,
    effect: { artifact, substrate: "WEBMCP", payload } satisfies AuthorizedEffect,
  };
}

function observed(substrate: ExecutionObservation["substrate"], receipt: unknown): ExecutionObservation {
  return {
    substrate,
    receipt,
    target: payload.target,
    effectFingerprint: stableFingerprint(payload),
    observedAtEpochMs: 1_788_000_000_000,
  };
}

class FakeDomClient implements DOMExecutionClient {
  calls = 0;
  constructor(private readonly available = true) {}
  isAvailable() { return this.available; }
  async activate() { this.calls += 1; return { receipt: "dom-receipt" }; }
  async observeAction(_effect: AuthorizedEffect, receipt: unknown) { return observed("DOM", receipt); }
}

class FakeVisionClient implements VisionExecutionClient {
  activateCalls = 0;
  constructor(private readonly available = true, private readonly locatedTarget = payload.target) {}
  isAvailable() { return this.available; }
  async locate() { return { target: this.locatedTarget }; }
  async activateLocatedTarget() { this.activateCalls += 1; return { receipt: "vision-receipt" }; }
  async observeAction(_effect: AuthorizedEffect, receipt: unknown) { return observed("VISION", receipt); }
}

class UnavailableWebMCPClient implements WebMCPExecutionClient {
  isAvailable() { return false; }
  async requestAction(): Promise<{ receipt: unknown }> { throw new Error("not reachable"); }
  async observeAction(): Promise<ExecutionObservation> { throw new Error("not reachable"); }
}

test("WebMCP unavailable routes the same authorized artifact and effect through DOM", async () => {
  const { store, effect } = setup();
  const domClient = new FakeDomClient();
  const router = new DeterministicExecutionRouter();
  const selection = await router.select(effect, [
    new WebMCPExecutionAdapter(new UnavailableWebMCPClient(), store),
    new DOMExecutionAdapter(domClient, store),
  ]);

  assert.equal(selection.adapter?.substrate, "DOM");
  assert.equal(selection.effect?.substrate, "DOM");
  assert.equal(selection.effect?.artifact, effect.artifact);
  assert.equal(selection.effect?.payload, effect.payload);
  assert.match(selection.reason, /WEBMCP unavailable → DOM selected/);

  const validation = await selection.adapter?.validate(effect.artifact, selection.effect?.payload, "commerce:v1");
  assert.equal(validation?.valid, true);
  const execution = await selection.adapter?.execute(selection.effect as AuthorizedEffect);
  assert.equal(execution?.executed, true);
  const observation = await selection.adapter?.observe(selection.effect as AuthorizedEffect, execution!);
  assert.deepEqual(observation, observed("DOM", "dom-receipt"));
  assert.equal(domClient.calls, 1);
});

test("WebMCP and DOM unavailable route the same authorized artifact and effect through Vision", async () => {
  const { store, effect } = setup();
  const router = new DeterministicExecutionRouter();
  const selection = await router.select(effect, [
    new WebMCPExecutionAdapter(new UnavailableWebMCPClient(), store),
    new DOMExecutionAdapter(new FakeDomClient(false), store),
    new VisionExecutionAdapter(new FakeVisionClient(), store),
  ]);

  assert.equal(selection.adapter?.substrate, "VISION");
  assert.equal(selection.effect?.substrate, "VISION");
  assert.equal(selection.effect?.artifact, effect.artifact);
  assert.equal(selection.effect?.payload, effect.payload);
  assert.match(selection.reason, /WEBMCP unavailable → DOM unavailable → VISION selected/);
});

test("Vision cannot activate a visually located target different from the authorized effect", async () => {
  const { store, effect } = setup();
  const client = new FakeVisionClient(true, "order:OTHER/refund");
  const adapter = new VisionExecutionAdapter(client, store);
  const routed = { ...effect, substrate: "VISION" as const };

  assert.equal((await adapter.validate(routed.artifact, routed.payload, "commerce:v1")).valid, true);
  const execution = await adapter.execute(routed);

  assert.equal(execution.executed, false);
  assert.match(execution.error ?? "", /different from the authorized effect/i);
  assert.equal(client.activateCalls, 0);
});

test("Browser DOM client activates only the exact bound target and observes its own audit attributes", async () => {
  let clicked = 0;
  const attributes = new Map<string, string>();
  const element = {
    click() {
      clicked += 1;
      attributes.set("data-xact-receipt", "dom-browser-receipt");
      attributes.set("data-xact-effect-fingerprint", stableFingerprint(payload));
    },
    getAttribute(name: string) { return attributes.get(name) ?? null; },
  };
  const client = new BrowserDOMExecutionClient({
    querySelector(selector) {
      return selector.includes(payload.target) ? element : null;
    },
  }, () => 1_788_000_000_000);
  const { effect } = setup();
  const routed = { ...effect, substrate: "DOM" as const };

  const execution = await client.activate(routed);
  const observation = await client.observeAction(routed, execution.receipt);

  assert.equal(clicked, 1);
  assert.deepEqual(observation, observed("DOM", "dom-browser-receipt"));
});

test("the same Commit decision verifies through DOM when WebMCP is unavailable", async () => {
  const store = new InMemoryAuthorizationArtifactStore();
  const engine = createCommerceSimulationEngine({
    store,
    executionAdapter: new DOMExecutionAdapter(new FakeDomClient(), store),
  });
  let session = await engine.resolve(engine.createSession());
  session = await engine.commit(session);
  const artifact = session.decision?.artifact;

  session = await engine.executeAndVerify(session);

  assert.equal(session.decision?.artifact, artifact);
  assert.equal(session.execution?.substrate, "DOM");
  assert.equal(session.selectedSubstrate, "DOM");
  assert.equal(session.verification?.verified, true);
  assert.equal(session.phase, "VERIFIED");
});
