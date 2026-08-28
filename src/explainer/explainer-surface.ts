import type { AuthorizationArtifact } from "../xact/contracts";
import {
  buildExplainerManifest,
  type ExplainerManifest,
  type ExplainerRunInput,
} from "./explainer-manifest";
import { generateScript, type NarrationScript } from "./narration-script";
import { buildStoryboard, type Storyboard } from "./storyboard";
import { HtmlSlideshowRenderer } from "./html-renderer";
import type { ExplainerRenderer, RenderResult } from "./renderer";

/**
 * WebMCP surface for the explainer (E6).
 *
 * A small, high-level tool surface — exactly three tools, no low-level
 * rendering functions:
 *
 *   prepare_run_explainer({ runId })  → READ (projection, no consequence)
 *   render_approved_explainer         → CONSEQUENCE (persistent artifact) → Commit
 *   publish_explainer                 → CONSEQUENCE (external side effect) → its OWN Commit
 *
 * Preparation never grants render authority; render authority never grants
 * publish authority. Each consequence traverses the Commit path via an
 * AuthorizationArtifact with its own capability.
 */

export type ExplainerToolName =
  | "prepare_run_explainer"
  | "render_approved_explainer"
  | "publish_explainer";

export interface ExplainerToolDescriptor {
  name: ExplainerToolName;
  description: string;
  kind: "READ" | "CONSEQUENCE_REQUEST";
  requiresCommit: boolean;
}

export const explainerTools: readonly ExplainerToolDescriptor[] = Object.freeze([
  {
    name: "prepare_run_explainer",
    description: "Project a completed verified run into a manifest, script, and storyboard (no consequence).",
    kind: "READ",
    requiresCommit: false,
  },
  {
    name: "render_approved_explainer",
    description: "Render the prepared explainer into a persistent artifact.",
    kind: "CONSEQUENCE_REQUEST",
    requiresCommit: true,
  },
  {
    name: "publish_explainer",
    description: "Publish the rendered explainer to a destination.",
    kind: "CONSEQUENCE_REQUEST",
    requiresCommit: true,
  },
]);

export const EXPLAINER_RENDER_CAPABILITY = "explainer:render";
export const EXPLAINER_PUBLISH_CAPABILITY = "explainer:publish";

export interface RenderPlan {
  rendererKind: "BROWSER";
  outputKind: "HTML_SLIDESHOW";
  targetDurationMs: number;
}

export interface PreparedExplainer {
  explainerId: string;
  runId: string;
  manifest: ExplainerManifest;
  narration: NarrationScript;
  storyboard: Storyboard;
  renderPlan: RenderPlan;
}

/**
 * READ: project a run into the explainer plan. No consequence, no artifact, no
 * authority — the returned plan cannot render or publish by itself.
 */
export function prepareRunExplainer<TInputs, TState, TEffect>(
  evidence: ExplainerRunInput<TInputs, TState, TEffect>,
  now: () => number = Date.now,
): PreparedExplainer {
  const manifest = buildExplainerManifest(evidence, now);
  const narration = generateScript(manifest);
  const storyboard = buildStoryboard(narration, manifest);
  return {
    explainerId: `explainer:${evidence.runId}`,
    runId: evidence.runId,
    manifest,
    narration,
    storyboard,
    renderPlan: {
      rendererKind: "BROWSER",
      outputKind: "HTML_SLIDESHOW",
      targetDurationMs: storyboard.totalDurationMs,
    },
  };
}

/**
 * CONSEQUENCE: render the prepared explainer. Requires a Commit
 * AuthorizationArtifact for `explainer:render`. A publish artifact (or no
 * artifact) cannot render; failure blocks without effect.
 */
export async function renderApprovedExplainer(
  prepared: PreparedExplainer,
  authorization: AuthorizationArtifact,
  renderer: ExplainerRenderer = new HtmlSlideshowRenderer(),
): Promise<RenderResult> {
  assertConsequenceAuthorized(authorization, EXPLAINER_RENDER_CAPABILITY);
  return renderer.render({
    explainerId: prepared.explainerId,
    runId: prepared.runId,
    storyboard: prepared.storyboard,
    narration: prepared.narration,
  });
}

export interface PublishResult {
  kind: "EXPLAINER_PUBLISH_RESULT";
  explainerId: string;
  runId: string;
  destination: string;
  artifactRef: string;
  publishedAtEpochMs: number;
}

/**
 * CONSEQUENCE: publish the rendered explainer. A DIFFERENT consequence than
 * render — it requires its own Commit AuthorizationArtifact for
 * `explainer:publish`. A render artifact cannot publish.
 */
export function publishExplainer(
  rendered: RenderResult,
  authorization: AuthorizationArtifact,
  destination: string,
  now: () => number = Date.now,
): PublishResult {
  assertConsequenceAuthorized(authorization, EXPLAINER_PUBLISH_CAPABILITY);
  if (rendered.status !== "RENDERED") {
    throw new Error("Publishing requires a successfully rendered explainer.");
  }
  return {
    kind: "EXPLAINER_PUBLISH_RESULT",
    explainerId: rendered.explainerId,
    runId: rendered.runId,
    destination,
    artifactRef: rendered.artifactRef,
    publishedAtEpochMs: now(),
  };
}

function assertConsequenceAuthorized(
  authorization: AuthorizationArtifact,
  capability: string,
  now: () => number = Date.now,
): void {
  if (authorization.capability !== capability) {
    throw new Error(`This consequence requires a Commit AuthorizationArtifact with capability '${capability}'.`);
  }
  if (authorization.expiresAtEpochMs <= now()) {
    throw new Error("The Commit AuthorizationArtifact has expired.");
  }
  if (!authorization.nonce) {
    throw new Error("The Commit AuthorizationArtifact carries no nonce.");
  }
}
