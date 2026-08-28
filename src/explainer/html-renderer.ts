import {
  renderFingerprint,
  type ExplainerRenderer,
  type RenderRequest,
  type RenderResult,
} from "./renderer";
import type { Storyboard, StoryboardCard } from "./storyboard";

/**
 * Real browser-native renderer (E5).
 *
 * Produces a genuine, self-contained HTML slideshow artifact from a validated
 * Storyboard — real bytes, real provenance (LIVE), no video pipeline required.
 * It is a faithful serialization of the grounded storyboard: every title, fact,
 * badge, and clock is copied from the storyboard, never invented. Replaceable
 * by FFmpeg / Remotion / cloud renderers behind the same ExplainerRenderer
 * boundary (E4).
 */

const BADGE_COLOR: Record<string, string> = {
  LIVE: "#1d7a3f",
  REFERENCE: "#7c6f1d",
  SIMULATED: "#8a5cf6",
};

const CLOCK_LABEL: Record<string, string> = {
  DECISION: "DECISION CLOCK",
  WORK: "WORK CLOCK",
  REASONING: "REASONING CLOCK",
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function cardHtml(card: StoryboardCard): string {
  const primary = card.facts.find((fact) => fact.role === "PRIMARY");
  const supporting = card.facts.filter((fact) => fact.role === "SUPPORTING");
  const badge = card.facts.length > 0
    ? `<span class="badge" style="background:${BADGE_COLOR[card.provenanceBadge] ?? "#56635d"}">${escapeHtml(card.provenanceBadge)}</span>`
    : "";
  const clock = card.clock
    ? `<span class="clock">${escapeHtml(CLOCK_LABEL[card.clock] ?? card.clock)}</span>`
    : "";
  const transition = card.transition ? `<p class="transition">${escapeHtml(card.transition)}</p>` : "";
  const primaryHtml = primary ? `<div class="primary">${escapeHtml(primary.text)}</div>` : "";
  const supportingHtml = supporting.length
    ? `<ul>${supporting.map((fact) => `<li>${escapeHtml(fact.text)}</li>`).join("")}</ul>`
    : "";
  return `
  <section class="card" data-duration="${card.durationMs}">
    <header><span class="meta">${escapeHtml(card.title)}</span><span class="badges">${badge}${clock}</span></header>
    ${transition}
    ${primaryHtml}
    ${supportingHtml}
  </section>`;
}

/**
 * Deterministically render a Storyboard into a self-contained, autoplaying HTML
 * slideshow. This is the actual explainer artifact.
 */
export function renderStoryboardHtml(storyboard: Storyboard): string {
  const cards = storyboard.cards.map(cardHtml).join("\n");
  const durations = JSON.stringify(storyboard.cards.map((card) => card.durationMs));
  const runId = escapeHtml(storyboard.runId);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Xact — Run Explainer</title>
<style>
  :root { color-scheme: light; }
  body { margin: 0; font-family: system-ui, sans-serif; background: #0f1613; color: #e7ede9; display: grid; place-items: center; min-height: 100vh; }
  .stage { width: min(720px, 92vw); }
  .card { display: none; border: 1px solid #2a3831; border-radius: 12px; padding: 28px; background: #16201b; }
  .card.active { display: block; }
  header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
  .meta { font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: #8fa099; }
  .badges { display: inline-flex; gap: 6px; }
  .badge { font-size: 10px; padding: 2px 9px; border-radius: 10px; color: #fff; font-weight: 700; }
  .clock { font-size: 10px; padding: 2px 9px; border-radius: 10px; border: 1px solid #4a5a51; color: #aebbb4; }
  .transition { font-style: italic; color: #9fb0a7; font-size: 14px; }
  .primary { font-size: 34px; font-weight: 800; line-height: 1.12; margin: 14px 0; }
  ul { margin: 0 0 8px; padding-left: 18px; font-size: 15px; color: #c3cfc9; }
  li { margin-bottom: 4px; }
  .controls { display: flex; gap: 10px; margin-top: 18px; align-items: center; }
  button { background: #1d7a3f; color: #fff; border: 0; border-radius: 6px; padding: 8px 14px; font-size: 13px; cursor: pointer; }
  button.ghost { background: transparent; border: 1px solid #4a5a51; color: #c3cfc9; }
  .progress { height: 4px; background: #24312a; border-radius: 2px; margin-top: 16px; overflow: hidden; }
  .progress > div { height: 4px; background: #1d7a3f; width: 0; transition: width 300ms; }
</style>
</head>
<body>
<div class="stage">
  <div id="cards">${cards}</div>
  <div class="controls">
    <button id="prev" class="ghost">← prev</button>
    <button id="play">play</button>
    <button id="next" class="ghost">next →</button>
  </div>
  <div class="progress"><div id="bar"></div></div>
</div>
<script>
  var durations = ${durations};
  var cards = Array.prototype.slice.call(document.querySelectorAll('.card'));
  var index = 0, timer = null;
  function show(i) {
    index = (i + cards.length) % cards.length;
    cards.forEach(function (c, j) { c.classList.toggle('active', j === index); });
    document.getElementById('bar').style.width = ((index + 1) / cards.length * 100) + '%';
  }
  function step() { show(index + 1); }
  function play() {
    if (timer) return;
    timer = setInterval(function () { step(); if (index === cards.length - 1) stop(); }, durations[index] || 4000);
  }
  function stop() { clearInterval(timer); timer = null; }
  document.getElementById('play').addEventListener('click', function () { if (timer) { stop(); this.textContent = 'play'; } else { play(); this.textContent = 'pause'; } });
  document.getElementById('prev').addEventListener('click', function () { stop(); show(index - 1); });
  document.getElementById('next').addEventListener('click', function () { stop(); show(index + 1); });
  show(0);
</script>
</body>
</html>
`;
}

/**
 * Real renderer: produces the HTML artifact and returns verifiable render
 * evidence. Provenance is LIVE because real bytes are produced; kind is BROWSER
 * and the name makes clear this is an HTML slideshow, not a video.
 */
export class HtmlSlideshowRenderer implements ExplainerRenderer {
  readonly kind = "BROWSER" as const;
  readonly provenance = "LIVE" as const;

  constructor(private readonly now: () => number = Date.now) {}

  async render(request: RenderRequest): Promise<RenderResult> {
    const html = renderStoryboardHtml(request.storyboard);
    return {
      kind: "EXPLAINER_RENDER_RESULT",
      renderId: `html-render:${request.explainerId}`,
      explainerId: request.explainerId,
      runId: request.runId,
      status: "RENDERED",
      renderer: {
        name: "Self-contained HTML slideshow renderer (browser-native)",
        kind: "BROWSER",
        provenance: "LIVE",
      },
      artifactRef: `html://explainer/${request.explainerId}`,
      fingerprint: renderFingerprint(request),
      outputBytes: new TextEncoder().encode(html).length,
      observedAtEpochMs: this.now(),
    };
  }
}
