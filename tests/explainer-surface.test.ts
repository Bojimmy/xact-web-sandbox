import assert from "node:assert/strict";
import test from "node:test";
import {
  EXPLAINER_PUBLISH_CAPABILITY,
  EXPLAINER_RENDER_CAPABILITY,
  explainerTools,
  prepareRunExplainer,
  publishEffectPayload,
  publishExplainer,
  renderApprovedExplainer,
  renderEffectPayload,
} from "../src/explainer/explainer-surface";
import type { AuthorizationArtifact } from "../src/xact/contracts";
import { AuthorizationArtifactIssuer, InMemoryAuthorizationArtifactStore, stableFingerprint } from "../src/xact/authorization-artifact";
import { createServiceCreditEngine, type ServiceCreditSession } from "../src/runtime/service-operations-engine";
import { WebMCPExecutionAdapter, type WebMCPExecutionClient } from "../src/execution/webmcp-execution-adapter";
import type { AuthorizedEffect, ExecutionObservation } from "../src/execution/contracts";

class AvailableWebMCP implements WebMCPExecutionClient {
  private lastEffect?: AuthorizedEffect;
  isAvailable() { return true; }
  async requestAction(effect: AuthorizedEffect) { this.lastEffect = effect; return { receipt: "r" }; }
  async observeAction(receipt: unknown): Promise<ExecutionObservation> {
    const effect = this.lastEffect!;
    return { substrate: "WEBMCP", receipt, target: (effect.payload as { target: string }).target, effectFingerprint: stableFingerprint(effect.payload), observedAtEpochMs: 1 };
  }
}

async function verifiedSession(): Promise<ServiceCreditSession> {
  const store = new InMemoryAuthorizationArtifactStore();
  const engine = createServiceCreditEngine(store, [new WebMCPExecutionAdapter(new AvailableWebMCP(), store)]);
  let session = engine.createSession();
  session = await engine.resolve(session);
  session = await engine.commit(session);
  session = await engine.executeAndVerify(session);
  return session;
}

let mintOrdinal = 0;

function mintArtifact(store: InMemoryAuthorizationArtifactStore, capability: string, effectPayload: unknown, stateFingerprint: string): AuthorizationArtifact {
  mintOrdinal += 1;
  return new AuthorizationArtifactIssuer(store).issue({
    commitId: `commit:${capability}:${mintOrdinal}`,
    effectFingerprint: stableFingerprint(effectPayload),
    baseStateFingerprint: stateFingerprint,
    actor: "support.agent",
    capability,
  });
}

function rawArtifact(overrides: Partial<AuthorizationArtifact> = {}): AuthorizationArtifact {
  return {
    commitId: "commit:raw",
    effectFingerprint: "fp",
    baseStateFingerprint: "bs",
    actor: "support.agent",
    capability: EXPLAINER_RENDER_CAPABILITY,
    nonce: "nonce:raw",
    issuedAtEpochMs: 1,
    expiresAtEpochMs: 9_000_000_000_000,
    ...overrides,
  };
}

async function prepared() {
  const session = await verifiedSession();
  return prepareRunExplainer({
    runId: "run:1",
    judgePrompt: "Apply a $42 service credit.",
    requestedCapability: "request_service_credit",
    session,
  });
}

test("the explainer surface is exactly three tools: one READ, two Commit-gated consequences", () => {
  assert.equal(explainerTools.length, 3);
  assert.deepEqual(explainerTools.map((tool) => tool.name), ["prepare_run_explainer", "render_approved_explainer", "publish_explainer"]);

  const prepare = explainerTools.find((tool) => tool.name === "prepare_run_explainer");
  assert.equal(prepare?.kind, "READ");
  assert.equal(prepare?.requiresCommit, false);

  for (const name of ["render_approved_explainer", "publish_explainer"] as const) {
    const tool = explainerTools.find((candidate) => candidate.name === name);
    assert.equal(tool?.kind, "CONSEQUENCE_REQUEST");
    assert.equal(tool?.requiresCommit, true);
  }
});

test("prepare projects the run and has no authority surface", async () => {
  const plan = await prepared();
  assert.equal(plan.explainerId, "explainer:run:1");
  assert.equal(plan.runId, "run:1");
  assert.equal(plan.manifest.kind, "EXPLAINER_MANIFEST");
  assert.equal(plan.narration.kind, "EXPLAINER_SCRIPT");
  assert.equal(plan.storyboard.kind, "EXPLAINER_STORYBOARD");
  assert.equal(plan.renderPlan.outputKind, "HTML_SLIDESHOW");

  assert.equal("render" in plan, false);
  assert.equal("publish" in plan, false);
  assert.equal("commit" in plan, false);
  assert.equal("execute" in plan, false);
  assert.equal("authorize" in plan, false);
});

test("render requires its own Commit authorization and blocks on a publish artifact", async () => {
  const plan = await prepared();
  const store = new InMemoryAuthorizationArtifactStore();
  const stateFp = plan.manifest.stateFingerprint.value;

  const publishArtifact = mintArtifact(store, EXPLAINER_PUBLISH_CAPABILITY, { type: "PUBLISH_EXPLAINER", explainerId: plan.explainerId, runId: plan.runId, destination: "https://demo/xact" }, stateFp);
  await assert.rejects(
    () => renderApprovedExplainer(plan, publishArtifact, store),
    /capability 'explainer:render'/,
  );

  const renderArtifact = mintArtifact(store, EXPLAINER_RENDER_CAPABILITY, renderEffectPayload(plan), stateFp);
  const rendered = await renderApprovedExplainer(plan, renderArtifact, store);
  assert.equal(rendered.status, "RENDERED");
  assert.equal(rendered.runId, "run:1");
});

test("publish requires its own Commit authorization and cannot use a render artifact", async () => {
  const plan = await prepared();
  const store = new InMemoryAuthorizationArtifactStore();
  const stateFp = plan.manifest.stateFingerprint.value;

  const renderArtifact = mintArtifact(store, EXPLAINER_RENDER_CAPABILITY, renderEffectPayload(plan), stateFp);
  const rendered = await renderApprovedExplainer(plan, renderArtifact, store);

  assert.throws(
    () => publishExplainer(rendered, renderArtifact, store, "https://demo/xact", stateFp),
    /capability 'explainer:publish'/,
  );

  const publishArtifact = mintArtifact(store, EXPLAINER_PUBLISH_CAPABILITY, publishEffectPayload(rendered, "https://demo/xact"), stateFp);
  const published = publishExplainer(rendered, publishArtifact, store, "https://demo/xact", stateFp, () => 5000);
  assert.equal(published.kind, "EXPLAINER_PUBLISH_RESULT");
  assert.equal(published.destination, "https://demo/xact");
  assert.equal(published.publishedAtEpochMs, 5000);
  assert.equal(published.artifactRef, rendered.artifactRef);
});

test("the ADR 0004 guard blocks unissued, expired, and malformed artifacts", async () => {
  const plan = await prepared();
  const store = new InMemoryAuthorizationArtifactStore();
  const stateFp = plan.manifest.stateFingerprint.value;

  // Unissued (never recorded in the store) → authentic FAIL.
  await assert.rejects(
    () => renderApprovedExplainer(plan, rawArtifact({ effectFingerprint: stableFingerprint(renderEffectPayload(plan)), baseStateFingerprint: stateFp }), store),
    /not issued|validation failed/,
  );

  // Expired (recorded, but expires in the past) → unexpired FAIL.
  store.record(rawArtifact({ commitId: "commit:expired", nonce: "nonce:expired", expiresAtEpochMs: 1 }));
  await assert.rejects(
    () => renderApprovedExplainer(plan, rawArtifact({ commitId: "commit:expired", nonce: "nonce:expired", expiresAtEpochMs: 1 }), store),
    /expired/,
  );

  // Malformed (empty nonce) → well-formed FAIL.
  store.record(rawArtifact({ commitId: "commit:malformed", nonce: "" }));
  await assert.rejects(
    () => renderApprovedExplainer(plan, rawArtifact({ commitId: "commit:malformed", nonce: "" }), store),
    /malformed/,
  );
});

test("effect binding and state freshness are enforced by the full guard", async () => {
  const plan = await prepared();
  const store = new InMemoryAuthorizationArtifactStore();
  const stateFp = plan.manifest.stateFingerprint.value;

  // Effect-bound: a fingerprint that does not match the render payload.
  const wrongEffect = mintArtifact(store, EXPLAINER_RENDER_CAPABILITY, { type: "RENDER_EXPLAINER", explainerId: "other", runId: "run:1" }, stateFp);
  await assert.rejects(
    () => renderApprovedExplainer(plan, wrongEffect, store),
    /effect does not match|validation failed/,
  );

  // State-fresh: baseStateFingerprint does not match the run's current state.
  const stale = mintArtifact(store, EXPLAINER_RENDER_CAPABILITY, renderEffectPayload(plan), "stale-state");
  await assert.rejects(
    () => renderApprovedExplainer(plan, stale, store),
    /stale|validation failed/,
  );
});

test("render authority is bound to the exact storyboard and narration inputs", async () => {
  const plan = await prepared();
  const store = new InMemoryAuthorizationArtifactStore();
  const stateFp = plan.manifest.stateFingerprint.value;
  const artifact = mintArtifact(store, EXPLAINER_RENDER_CAPABILITY, renderEffectPayload(plan), stateFp);
  const changed = {
    ...plan,
    storyboard: { ...plan.storyboard, totalDurationMs: plan.storyboard.totalDurationMs + 1 },
  };

  await assert.rejects(
    () => renderApprovedExplainer(changed, artifact, store),
    /effect does not match|validation failed/,
  );
  assert.equal(store.nonceConsumed(artifact.nonce), false);
});

test("publish authority is bound to the exact rendered artifact", async () => {
  const plan = await prepared();
  const store = new InMemoryAuthorizationArtifactStore();
  const stateFp = plan.manifest.stateFingerprint.value;
  const rendered = await renderApprovedExplainer(
    plan,
    mintArtifact(store, EXPLAINER_RENDER_CAPABILITY, renderEffectPayload(plan), stateFp),
    store,
  );
  const destination = "https://demo/xact";
  const artifact = mintArtifact(store, EXPLAINER_PUBLISH_CAPABILITY, publishEffectPayload(rendered, destination), stateFp);
  const changed = { ...rendered, artifactRef: "html://explainer/different-artifact" };

  assert.throws(
    () => publishExplainer(changed, artifact, store, destination, stateFp),
    /effect does not match|validation failed/,
  );
  assert.equal(store.nonceConsumed(artifact.nonce), false);
});

test("the nonce is consumed atomically — a replay is blocked", async () => {
  const plan = await prepared();
  const store = new InMemoryAuthorizationArtifactStore();
  const stateFp = plan.manifest.stateFingerprint.value;

  const renderArtifact = mintArtifact(store, EXPLAINER_RENDER_CAPABILITY, renderEffectPayload(plan), stateFp);
  await renderApprovedExplainer(plan, renderArtifact, store);

  // Same artifact again → nonce already consumed.
  await assert.rejects(
    () => renderApprovedExplainer(plan, renderArtifact, store),
    /already consumed|replay/,
  );
});

test("prepare, render, and publish never mutate or authorize the underlying run", async () => {
  const session = await verifiedSession();
  const beforeFingerprint = session.currentStateFingerprint;
  const beforePhase = session.phase;

  const plan = prepareRunExplainer({
    runId: "run:1",
    judgePrompt: "Apply a $42 service credit.",
    requestedCapability: "request_service_credit",
    session,
  });
  const store = new InMemoryAuthorizationArtifactStore();
  const stateFp = plan.manifest.stateFingerprint.value;

  const renderArtifact = mintArtifact(store, EXPLAINER_RENDER_CAPABILITY, renderEffectPayload(plan), stateFp);
  const rendered = await renderApprovedExplainer(plan, renderArtifact, store);

  const publishArtifact = mintArtifact(store, EXPLAINER_PUBLISH_CAPABILITY, publishEffectPayload(rendered, "https://demo/xact"), stateFp);
  publishExplainer(rendered, publishArtifact, store, "https://demo/xact", stateFp);

  assert.equal(session.currentStateFingerprint, beforeFingerprint);
  assert.equal(session.phase, beforePhase);
});
