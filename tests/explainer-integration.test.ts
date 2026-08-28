import assert from "node:assert/strict";
import test from "node:test";
// Codex imports ONLY the public facade — nothing else from src/explainer.
import {
  EXPLAINER_PUBLISH_CAPABILITY,
  EXPLAINER_RENDER_CAPABILITY,
  StoryboardPreview,
  explainerTools,
  prepareRunExplainer,
  publishExplainer,
  renderApprovedExplainer,
  verifyRender,
} from "../src/explainer";
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

async function completedVerifiedRun(): Promise<ServiceCreditSession> {
  const store = new InMemoryAuthorizationArtifactStore();
  const engine = createServiceCreditEngine(store, [new WebMCPExecutionAdapter(new AvailableWebMCP(), store)]);
  let session = engine.createSession();
  session = await engine.resolve(session);
  session = await engine.commit(session);
  session = await engine.executeAndVerify(session);
  assert.equal(session.phase, "VERIFIED");
  return session;
}

function artifact(capability: string): AuthorizationArtifact {
  return {
    commitId: "commit:explainer",
    effectFingerprint: "fp",
    baseStateFingerprint: "bs",
    actor: "support.agent",
    capability,
    nonce: "nonce:1",
    issuedAtEpochMs: 1,
    expiresAtEpochMs: 9_000_000_000_000,
  };
}

test("the public facade exposes exactly the surface Codex needs", () => {
  assert.equal(typeof prepareRunExplainer, "function");
  assert.equal(typeof renderApprovedExplainer, "function");
  assert.equal(typeof publishExplainer, "function");
  assert.equal(typeof verifyRender, "function");
  assert.equal(typeof StoryboardPreview, "function");
  assert.equal(explainerTools.length, 3);
});

test("the end-to-end Codex flow works from the facade alone and never touches the run", async () => {
  const session = await completedVerifiedRun();
  const beforeFingerprint = session.currentStateFingerprint;
  const beforePhase = session.phase;

  // completedVerifiedRun → runId → prepare
  const prepared = prepareRunExplainer({
    runId: "run:flagship-1",
    judgePrompt: "Apply a $42 service credit to customer 1042.",
    requestedCapability: "request_service_credit",
    session,
    observation: {
      substrate: "WEBMCP",
      receipt: "r",
      target: "customer:1042/service-credit",
      effectFingerprint: session.decision!.artifact!.effectFingerprint,
      observedAtEpochMs: 1,
    },
  });

  // preview — the storyboard is ready to mount without any render.
  assert.ok(prepared.storyboard.cards.length > 0);
  assert.ok(prepared.storyboard.cards.some((card) => card.visualType === "COMMIT"));
  assert.ok(prepared.storyboard.cards.some((card) => card.visualType === "EXECUTION"));

  // render — its own Commit consequence.
  const rendered = await renderApprovedExplainer(prepared, artifact(EXPLAINER_RENDER_CAPABILITY));
  assert.equal(rendered.status, "RENDERED");
  assert.equal(verifyRender(rendered, {
    explainerId: prepared.explainerId,
    runId: prepared.runId,
    storyboard: prepared.storyboard,
    narration: prepared.narration,
  }).ok, true);

  // publish — a different consequence with its own Commit.
  const published = publishExplainer(rendered, artifact(EXPLAINER_PUBLISH_CAPABILITY), "https://demo/xact/explainer");
  assert.equal(published.kind, "EXPLAINER_PUBLISH_RESULT");

  // The run is untouched — the explainer is strictly downstream.
  assert.equal(session.currentStateFingerprint, beforeFingerprint);
  assert.equal(session.phase, beforePhase);
});

test("a render authorization cannot publish, and a publish authorization cannot render", async () => {
  const session = await completedVerifiedRun();
  const prepared = prepareRunExplainer({
    runId: "run:flagship-1",
    judgePrompt: "Apply a $42 service credit.",
    requestedCapability: "request_service_credit",
    session,
  });

  await assert.rejects(
    () => renderApprovedExplainer(prepared, artifact(EXPLAINER_PUBLISH_CAPABILITY)),
    /capability 'explainer:render'/,
  );

  const rendered = await renderApprovedExplainer(prepared, artifact(EXPLAINER_RENDER_CAPABILITY));
  assert.throws(
    () => publishExplainer(rendered, artifact(EXPLAINER_RENDER_CAPABILITY), "https://demo/xact"),
    /capability 'explainer:publish'/,
  );
});
