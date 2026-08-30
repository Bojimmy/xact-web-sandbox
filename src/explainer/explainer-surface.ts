import type { AuthorizationArtifact } from "../xact/contracts";
import type { AuthorizationArtifactStore } from "../xact/authorization-artifact";
import { validateAuthorizationArtifact } from "../execution/artifact-guard";
import {
  buildExplainerManifest,
  type ExplainerManifest,
  type ExplainerRunInput,
} from "./explainer-manifest";
import { generateScript, type NarrationScript } from "./narration-script";
import { buildStoryboard, type Storyboard } from "./storyboard";
import { HtmlSlideshowRenderer } from "./html-renderer";
import {
  renderFingerprint,
  type ExplainerRenderer,
  type RenderRequest,
  type RenderResult,
} from "./renderer";

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
 * publish authority. Render and publish traverse the same ADR 0004 artifact
 * guard as execution (issuance, well-formedness, expiry, replay, effect
 * binding, state freshness), plus atomic nonce consumption.
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
  manifest: ExplainerManifest | FoundryExplainerManifest;
  narration: NarrationScript;
  storyboard: Storyboard;
  renderPlan: RenderPlan;
}

/**
 * The public-safe evidence snapshot for a Foundry-hosted tool run. It is not
 * coerced into a SimulationSession: its fingerprint binds render authority to
 * the observed Foundry evidence exactly as it was prepared.
 */
export interface FoundryExplainerManifest {
  kind: "FOUNDRY_EXPLAINER_MANIFEST";
  runId: string;
  stateFingerprint: { value: string };
}

/** The effect payload a render Commit authorizes (bound to explainer + run). */
export interface RenderConsequenceEffect {
  type: "RENDER_EXPLAINER";
  explainerId: string;
  runId: string;
  inputFingerprint: string;
}

/** The effect payload a publish Commit authorizes (bound to render + destination). */
export interface PublishConsequenceEffect {
  type: "PUBLISH_EXPLAINER";
  explainerId: string;
  runId: string;
  destination: string;
  renderId: string;
  artifactRef: string;
  renderFingerprint: string;
}

export function renderEffectPayload(prepared: PreparedExplainer): RenderConsequenceEffect {
  return {
    type: "RENDER_EXPLAINER",
    explainerId: prepared.explainerId,
    runId: prepared.runId,
    inputFingerprint: renderFingerprint(renderRequest(prepared)),
  };
}

export function publishEffectPayload(rendered: RenderResult, destination: string): PublishConsequenceEffect {
  return {
    type: "PUBLISH_EXPLAINER",
    explainerId: rendered.explainerId,
    runId: rendered.runId,
    destination,
    renderId: rendered.renderId,
    artifactRef: rendered.artifactRef,
    renderFingerprint: rendered.fingerprint,
  };
}

function renderRequest(prepared: PreparedExplainer): RenderRequest {
  return {
    explainerId: prepared.explainerId,
    runId: prepared.runId,
    storyboard: prepared.storyboard,
    narration: prepared.narration,
  };
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
 * AuthorizationArtifact for `explainer:render`, validated through the ADR 0004
 * guard and nonce-consumed atomically. A publish artifact (or an unissued,
 * expired, replayed, mis-bound, or stale artifact) cannot render; failure
 * blocks without effect.
 */
export async function renderApprovedExplainer(
  prepared: PreparedExplainer,
  authorization: AuthorizationArtifact,
  store: AuthorizationArtifactStore,
  renderer: ExplainerRenderer = new HtmlSlideshowRenderer(),
  now: () => number = Date.now,
): Promise<RenderResult> {
  assertConsequenceAuthorized(
    store,
    authorization,
    EXPLAINER_RENDER_CAPABILITY,
    renderEffectPayload(prepared),
    prepared.manifest.stateFingerprint.value,
    now,
  );
  return renderer.render(renderRequest(prepared));
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
 * `explainer:publish`, validated through the ADR 0004 guard and nonce-consumed
 * atomically. A render artifact cannot publish.
 */
export function publishExplainer(
  rendered: RenderResult,
  authorization: AuthorizationArtifact,
  store: AuthorizationArtifactStore,
  destination: string,
  stateFingerprint: string,
  now: () => number = Date.now,
): PublishResult {
  assertConsequenceAuthorized(
    store,
    authorization,
    EXPLAINER_PUBLISH_CAPABILITY,
    publishEffectPayload(rendered, destination),
    stateFingerprint,
    now,
  );
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

/**
 * The render/publish authority gate. It first checks the consequence
 * capability, then runs the full ADR 0004 artifact guard (authentic →
 * well-formed → unexpired → unreplayed → effect-bound → state-fresh), then
 * consumes the nonce atomically. This is the same guard the execution adapters
 * enforce — not a weaker explainer-specific check.
 */
function assertConsequenceAuthorized(
  store: AuthorizationArtifactStore,
  authorization: AuthorizationArtifact,
  capability: string,
  payload: unknown,
  currentStateFingerprint: string,
  now: () => number,
): void {
  if (authorization.capability !== capability) {
    throw new Error(`This consequence requires a Commit AuthorizationArtifact with capability '${capability}'.`);
  }
  const validation = validateAuthorizationArtifact(store, authorization, payload, currentStateFingerprint, now);
  if (!validation.valid) {
    throw new Error(`Authorization artifact validation failed: ${validation.reason}`);
  }
  if (!store.consumeNonce(authorization.nonce)) {
    throw new Error("Nonce already consumed (replay blocked).");
  }
}
