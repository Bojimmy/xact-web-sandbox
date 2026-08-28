import assert from "node:assert/strict";
import test from "node:test";
// Codex imports ONLY the public facade — nothing else from src/explainer.
import {
  EXPLAINER_PUBLISH_CAPABILITY,
  EXPLAINER_RENDER_CAPABILITY,
  StoryboardPreview,
  explainerTools,
  prepareRunExplainer,
  publishEffectPayload,
  publishExplainer,
  renderApprovedExplainer,
  renderEffectPayload,
  verifyRender,
} from "../src/explainer";
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

test("the public facade exposes exactly the surface Codex needs", () => {
  assert.equal(typeof prepareRunExplainer, "function");
  assert.equal(typeof renderApprovedExplainer, "function");
  assert.equal(typeof publishExplainer, "function");
  assert.equal(typeof verifyRender, "function");
  assert.equal(typeof renderEffectPayload, "function");
  assert.equal(typeof publishEffectPayload, "function");
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

  const store = new InMemoryAuthorizationArtifactStore();
  const stateFingerprint = prepared.manifest.stateFingerprint.value;

  // render — its own Commit consequence (full ADR 0004 guard).
  const rendered = await renderApprovedExplainer(
    prepared,
    mintArtifact(store, EXPLAINER_RENDER_CAPABILITY, renderEffectPayload(prepared), stateFingerprint),
    store,
  );
  assert.equal(rendered.status, "RENDERED");
  assert.equal(verifyRender(rendered, {
    explainerId: prepared.explainerId,
    runId: prepared.runId,
    storyboard: prepared.storyboard,
    narration: prepared.narration,
  }).ok, true);

  // publish — a different consequence with its own Commit.
  const destination = "https://demo/xact/explainer";
  const published = publishExplainer(
    rendered,
    mintArtifact(store, EXPLAINER_PUBLISH_CAPABILITY, publishEffectPayload(rendered, destination), stateFingerprint),
    store,
    destination,
    stateFingerprint,
  );
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
  const store = new InMemoryAuthorizationArtifactStore();
  const stateFingerprint = prepared.manifest.stateFingerprint.value;

  await assert.rejects(
    () => renderApprovedExplainer(
      prepared,
      mintArtifact(store, EXPLAINER_PUBLISH_CAPABILITY, { type: "PUBLISH_EXPLAINER", explainerId: prepared.explainerId, runId: prepared.runId, destination: "https://demo/xact" }, stateFingerprint),
      store,
    ),
    /capability 'explainer:render'/,
  );

  const rendered = await renderApprovedExplainer(
    prepared,
    mintArtifact(store, EXPLAINER_RENDER_CAPABILITY, renderEffectPayload(prepared), stateFingerprint),
    store,
  );
  assert.throws(
    () => publishExplainer(
      rendered,
      mintArtifact(store, EXPLAINER_RENDER_CAPABILITY, renderEffectPayload(prepared), stateFingerprint),
      store,
      "https://demo/xact",
      stateFingerprint,
    ),
    /capability 'explainer:publish'/,
  );
});
