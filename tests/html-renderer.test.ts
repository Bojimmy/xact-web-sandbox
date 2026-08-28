import assert from "node:assert/strict";
import test from "node:test";
import { HtmlSlideshowRenderer, renderStoryboardHtml } from "../src/explainer/html-renderer";
import { verifyRender } from "../src/explainer/renderer";
import type { Storyboard } from "../src/explainer/storyboard";
import type { NarrationScript } from "../src/explainer/narration-script";

function sampleStoryboard(): Storyboard {
  return {
    kind: "EXPLAINER_STORYBOARD",
    runId: "run:1",
    totalDurationMs: 11_500,
    cards: [
      {
        id: "card:1",
        title: "WHAT XACT LEARNED",
        visualType: "LEARNING",
        startMs: 0,
        durationMs: 5_500,
        narrationSentenceIds: [],
        evidenceRefs: ["flagship.learning.comparison"],
        clock: "REASONING",
        facts: [
          { role: "PRIMARY", text: "30 → 4 O-Agent calls", sourceEventIds: ["flagship.learning.comparison"], truth: "LIVE", clock: "REASONING" },
          { role: "SUPPORTING", text: "-86.7%", sourceEventIds: ["flagship.learning.comparison"], truth: "LIVE" },
          { role: "SUPPORTING", text: "Checksum 698530768 → 698530768 (identical)", sourceEventIds: ["flagship.learning.comparison"], truth: "LIVE" },
        ],
        provenanceBadge: "LIVE",
      },
      {
        id: "card:2",
        title: "CLOCK · DECISION (REFERENCE)",
        visualType: "CLOCK",
        startMs: 5_500,
        durationMs: 3_000,
        narrationSentenceIds: [],
        evidenceRefs: ["referenceXactBenchmark"],
        clock: "DECISION",
        facts: [
          { role: "PRIMARY", text: "Reference Xact Core decision latency: ≈9 µs mean (reference — not measured here)", sourceEventIds: ["referenceXactBenchmark"], truth: "REFERENCE", clock: "DECISION" },
        ],
        provenanceBadge: "REFERENCE",
      },
      {
        id: "card:3",
        title: "XACT",
        visualType: "BRAND",
        startMs: 8_500,
        durationMs: 3_000,
        narrationSentenceIds: [],
        evidenceRefs: [],
        facts: [],
        provenanceBadge: "LIVE",
        transition: "Reason when necessary. Execute Xactly.",
      },
    ],
  };
}

function narration(): NarrationScript {
  return { kind: "EXPLAINER_SCRIPT", runId: "run:1", scenes: [], claims: [] };
}

test("renderStoryboardHtml faithfully serializes grounded storyboard content", () => {
  const html = renderStoryboardHtml(sampleStoryboard());

  // Card titles.
  assert.ok(html.includes("WHAT XACT LEARNED"));
  assert.ok(html.includes("CLOCK · DECISION (REFERENCE)"));

  // Grounded facts — the learning delta is exact, not rounded.
  assert.ok(html.includes("30 → 4 O-Agent calls"));
  assert.ok(html.includes("-86.7%"));
  assert.ok(html.includes("Checksum 698530768 → 698530768 (identical)"));

  // Provenance + clock badges are carried through, never relabeled.
  assert.ok(html.includes("REFERENCE"));
  assert.ok(html.includes("DECISION CLOCK"));
  assert.ok(html.includes("REASONING CLOCK"));
  assert.ok(html.includes("not measured here"));

  // Transition line.
  assert.ok(html.includes("Reason when necessary. Execute Xactly."));

  // It is a self-contained document with an autoplay runner.
  assert.ok(html.startsWith("<!doctype html>"));
  assert.ok(html.includes("durations"));
});

test("renderStoryboardHtml escapes text and invents nothing", () => {
  const storyboard: Storyboard = {
    kind: "EXPLAINER_STORYBOARD",
    runId: "run:1",
    totalDurationMs: 1000,
    cards: [
      {
        id: "card:1",
        title: "WHAT YOU ASKED",
        visualType: "PROMPT",
        startMs: 0,
        durationMs: 1000,
        narrationSentenceIds: [],
        evidenceRefs: ["input.judgePrompt"],
        facts: [
          { role: "PRIMARY", text: "The judge asked Xact to <script>alert(1)</script> & more", sourceEventIds: ["input.judgePrompt"], truth: "LIVE" },
        ],
        provenanceBadge: "LIVE",
      },
    ],
  };

  const html = renderStoryboardHtml(storyboard);
  assert.ok(!html.includes("<script>alert(1)</script>"));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(html.includes("&amp;"));
});

test("the HTML renderer produces a LIVE result that verifies and has no authority surface", async () => {
  const renderer = new HtmlSlideshowRenderer(() => 99);
  const request = { explainerId: "explainer:run:1", runId: "run:1", storyboard: sampleStoryboard(), narration: narration() };
  const result = await renderer.render(request);

  assert.equal(result.renderer.kind, "BROWSER");
  assert.equal(result.renderer.provenance, "LIVE");
  assert.equal(result.status, "RENDERED");
  assert.ok(result.outputBytes > 0, "a real render produces real bytes");
  assert.ok(result.artifactRef.startsWith("html://"));
  assert.equal(result.observedAtEpochMs, 99);

  const verification = verifyRender(result, request);
  assert.equal(verification.ok, true);

  assert.equal("commit" in renderer, false);
  assert.equal("execute" in renderer, false);
  assert.equal("authorize" in renderer, false);
});

test("the HTML renderer is replaceable behind the ExplainerRenderer boundary", () => {
  const renderer = new HtmlSlideshowRenderer();
  assert.equal(renderer.kind, "BROWSER");
  assert.equal(renderer.provenance, "LIVE");
  assert.equal(typeof renderer.render, "function");
});
