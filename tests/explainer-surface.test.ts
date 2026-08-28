import assert from "node:assert/strict";
import test from "node:test";
import {
  EXPLAINER_PUBLISH_CAPABILITY,
  EXPLAINER_RENDER_CAPABILITY,
  explainerTools,
  prepareRunExplainer,
  publishExplainer,
  renderApprovedExplainer,
} from "../src/explainer/explainer-surface";
import type { AuthorizationArtifact } from "../src/xact/contracts";
import { createServiceCreditEngine, type ServiceCreditSession } from "../src/runtime/service-operations-engine";
import { WebMCPExecutionAdapter, type WebMCPExecutionClient } from "../src/execution/webmcp-execution-adapter";
import type { AuthorizedEffect, ExecutionObservation } from "../src/execution/contracts";
import { InMemoryAuthorizationArtifactStore, stableFingerprint } from "../src/xact/authorization-artifact";

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

function artifact(capability: string, overrides: Partial<AuthorizationArtifact> = {}): AuthorizationArtifact {
  return {
    commitId: "commit:1",
    effectFingerprint: "fp",
    baseStateFingerprint: "bs",
    actor: "support.agent",
    capability,
    nonce: "nonce:1",
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

  // The plan is pure data; it cannot render or publish on its own.
  assert.equal("render" in plan, false);
  assert.equal("publish" in plan, false);
  assert.equal("commit" in plan, false);
  assert.equal("execute" in plan, false);
  assert.equal("authorize" in plan, false);
});

test("render requires its own Commit authorization and blocks on a publish artifact", async () => {
  const plan = await prepared();

  await assert.rejects(
    () => renderApprovedExplainer(plan, artifact(EXPLAINER_PUBLISH_CAPABILITY)),
    /capability 'explainer:render'/,
  );

  const rendered = await renderApprovedExplainer(plan, artifact(EXPLAINER_RENDER_CAPABILITY));
  assert.equal(rendered.status, "RENDERED");
  assert.equal(rendered.runId, "run:1");
});

test("publish requires its own Commit authorization and cannot use a render artifact", async () => {
  const plan = await prepared();
  const rendered = await renderApprovedExplainer(plan, artifact(EXPLAINER_RENDER_CAPABILITY));

  assert.throws(
    () => publishExplainer(rendered, artifact(EXPLAINER_RENDER_CAPABILITY), "https://demo/xact"),
    /capability 'explainer:publish'/,
  );

  const published = publishExplainer(rendered, artifact(EXPLAINER_PUBLISH_CAPABILITY), "https://demo/xact", () => 5000);
  assert.equal(published.kind, "EXPLAINER_PUBLISH_RESULT");
  assert.equal(published.destination, "https://demo/xact");
  assert.equal(published.publishedAtEpochMs, 5000);
  assert.equal(published.artifactRef, rendered.artifactRef);
});

test("expired or nonce-less authorizations block every consequence", async () => {
  const plan = await prepared();

  await assert.rejects(
    () => renderApprovedExplainer(plan, artifact(EXPLAINER_RENDER_CAPABILITY, { expiresAtEpochMs: 1 })),
    /expired/,
  );
  await assert.rejects(
    () => renderApprovedExplainer(plan, artifact(EXPLAINER_RENDER_CAPABILITY, { nonce: "" })),
    /nonce/,
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
  const rendered = await renderApprovedExplainer(plan, artifact(EXPLAINER_RENDER_CAPABILITY));
  publishExplainer(rendered, artifact(EXPLAINER_PUBLISH_CAPABILITY), "https://demo/xact");

  // The session is untouched — the explainer is strictly downstream.
  assert.equal(session.currentStateFingerprint, beforeFingerprint);
  assert.equal(session.phase, beforePhase);
});
