import assert from "node:assert/strict";
import test from "node:test";
import {
  MockExplainerRenderer,
  renderFingerprint,
  verifyRender,
  type RenderRequest,
  type RenderResult,
} from "../src/explainer/renderer";
import type { NarrationScript } from "../src/explainer/narration-script";
import type { Storyboard } from "../src/explainer/storyboard";

function narration(runId: string): NarrationScript {
  return { kind: "EXPLAINER_SCRIPT", runId, scenes: [], claims: [] };
}

function storyboard(runId: string, cards = 0): Storyboard {
  return {
    kind: "EXPLAINER_STORYBOARD",
    runId,
    totalDurationMs: cards * 1000,
    cards: Array.from({ length: cards }, (_, index) => ({
      id: `card:${index + 1}`,
      title: `CARD ${index + 1}`,
      visualType: "PROMPT" as const,
      startMs: index * 1000,
      durationMs: 1000,
      narrationSentenceIds: [],
      evidenceRefs: [`ev:${index + 1}`],
      facts: [{ role: "PRIMARY" as const, text: `fact ${index + 1}`, sourceEventIds: [`ev:${index + 1}`], truth: "LIVE" as const }],
      provenanceBadge: "LIVE" as const,
    })),
  };
}

function request(runId: string, cards = 0): RenderRequest {
  return {
    explainerId: `explainer:${runId}`,
    runId,
    storyboard: storyboard(runId, cards),
    narration: narration(runId),
  };
}

test("the mock renderer produces a verifiable, clearly-labeled mock result", async () => {
  const renderer = new MockExplainerRenderer(() => 1234);
  const req = request("run:1", 2);
  const result = await renderer.render(req);

  assert.equal(result.kind, "EXPLAINER_RENDER_RESULT");
  assert.equal(result.status, "RENDERED");
  assert.equal(result.renderer.kind, "MOCK");
  assert.equal(result.renderer.provenance, "MOCK");
  assert.ok(result.artifactRef.startsWith("mock://"));
  assert.equal(result.outputBytes, 0);
  assert.equal(result.runId, "run:1");
  assert.equal(result.explainerId, "explainer:run:1");
  assert.equal(result.observedAtEpochMs, 1234);

  const verification = verifyRender(result, req);
  assert.equal(verification.ok, true);
});

test("renderFingerprint is deterministic and binds the render to its inputs", () => {
  const req = request("run:1", 3);
  assert.equal(renderFingerprint(req), renderFingerprint(request("run:1", 3)));
  assert.notEqual(renderFingerprint(req), renderFingerprint(request("run:1", 4)));
  assert.notEqual(renderFingerprint(req), renderFingerprint(request("run:2", 3)));
});

test("a render result fails verification against different inputs or mislabeled renderer", async () => {
  const renderer = new MockExplainerRenderer(() => 1);
  const result = await renderer.render(request("run:1", 2));

  const wrongRun = verifyRender(result, request("run:2", 2));
  assert.equal(wrongRun.ok, false);

  const wrongContent = verifyRender(result, request("run:1", 3));
  assert.equal(wrongContent.ok, false);

  const mislabeled: RenderResult = { ...result, renderer: { ...result.renderer, provenance: "LIVE" } };
  const fakedLive = verifyRender(mislabeled, request("run:1", 2));
  assert.equal(fakedLive.ok, false);
  if (!fakedLive.ok) assert.ok(fakedLive.reason.includes("cannot be labeled LIVE"));
});

test("the renderer and its result have no authority over the run", async () => {
  const renderer = new MockExplainerRenderer();
  // The renderer interface exposes only render() and read-only kind/provenance.
  assert.equal("commit" in renderer, false);
  assert.equal("execute" in renderer, false);
  assert.equal("authorize" in renderer, false);
  assert.equal("activate" in renderer, false);

  const result = await renderer.render(request("run:1", 1));
  // The result is pure data — no callable authority surface.
  assert.ok(Object.values(result).every((value) => typeof value !== "function"));

  // The request carries only downstream projections and opaque ids — never the
  // run's session, decision, or authorization artifact.
  const req = request("run:1", 1);
  assert.equal("session" in req, false);
  assert.equal("decision" in req, false);
  assert.equal("artifact" in req, false);
});
