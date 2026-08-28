import { stableFingerprint } from "../xact/authorization-artifact";
import type { NarrationScript } from "./narration-script";
import type { Storyboard } from "./storyboard";

/**
 * Replaceable renderer boundary (E4).
 *
 * The renderer is strictly downstream: it receives only the already-validated
 * storyboard and narration, plus opaque `runId`/`explainerId` identifiers. It
 * never sees the run's session, decision, or authorization artifact, so it has
 * no authority over the run it renders. Rendering is a consequence; a real
 * renderer (E5) and the WebMCP surface (E6) will traverse the normal Commit
 * path — this interface does not grant one.
 */

export type RendererKind =
  | "MOCK"
  | "BROWSER"
  | "REMOTION"
  | "FFMPEG"
  | "CLOUD_VIDEO"
  | "IMAGE_GENERATION"
  | "TTS"
  | "MULTIMODAL";

export type RendererProvenance = "MOCK" | "LIVE";

export type RenderStatus = "RENDERED" | "FAILED";

export interface RenderAsset {
  id: string;
  kind: "IMAGE" | "AUDIO" | "FONT" | "STYLE" | "CAPTION";
  uri: string;
}

export interface RenderRequest {
  explainerId: string;
  runId: string;
  storyboard: Storyboard;
  narration: NarrationScript;
  assets?: readonly RenderAsset[];
}

export interface RenderResult {
  kind: "EXPLAINER_RENDER_RESULT";
  renderId: string;
  explainerId: string;
  runId: string;
  status: RenderStatus;
  renderer: { name: string; kind: RendererKind; provenance: RendererProvenance };
  /** Identifies the produced output (URL / path / id). */
  artifactRef: string;
  /** Deterministic over the render inputs; binds the artifact to its source. */
  fingerprint: string;
  outputBytes: number;
  observedAtEpochMs: number;
  error?: string;
}

/**
 * A narrow, provider-neutral renderer contract. Replaceable by browser,
 * Remotion, FFmpeg, cloud, image/TTS/multimodal providers without touching the
 * explainer architecture. It has no commit/execute/authorize surface.
 */
export interface ExplainerRenderer {
  readonly kind: RendererKind;
  readonly provenance: RendererProvenance;
  render(request: RenderRequest): Promise<RenderResult>;
}

/** Deterministic binding of a render to its exact inputs. */
export function renderFingerprint(request: RenderRequest): string {
  return stableFingerprint({
    explainerId: request.explainerId,
    runId: request.runId,
    storyboard: request.storyboard,
    narration: request.narration,
    assets: request.assets ?? [],
  });
}

export type RenderVerification = { ok: true } | { ok: false; reason: string };

/**
 * Verify a render result against its request: identity fields match and the
 * fingerprint matches the inputs. A MOCK renderer can never be verified as
 * LIVE — "do not fake a LIVE render".
 */
export function verifyRender(
  result: RenderResult,
  request: RenderRequest,
): RenderVerification {
  if (result.explainerId !== request.explainerId) {
    return { ok: false, reason: "Render result explainerId does not match the request." };
  }
  if (result.runId !== request.runId) {
    return { ok: false, reason: "Render result runId does not match the request." };
  }
  if (result.renderer.kind === "MOCK" && result.renderer.provenance === "LIVE") {
    return { ok: false, reason: "A MOCK renderer cannot be labeled LIVE." };
  }
  if (result.fingerprint !== renderFingerprint(request)) {
    return { ok: false, reason: "Render result fingerprint does not match the render inputs." };
  }
  return { ok: true };
}

/**
 * Public-safe mock renderer. Produces a verifiable render result but no video;
 * its provenance is MOCK and its artifact is `mock://` — never presented as a
 * live render.
 */
export class MockExplainerRenderer implements ExplainerRenderer {
  readonly kind = "MOCK" as const;
  readonly provenance = "MOCK" as const;

  constructor(private readonly now: () => number = Date.now) {}

  async render(request: RenderRequest): Promise<RenderResult> {
    return {
      kind: "EXPLAINER_RENDER_RESULT",
      renderId: `mock-render:${request.explainerId}`,
      explainerId: request.explainerId,
      runId: request.runId,
      status: "RENDERED",
      renderer: {
        name: "Public-safe mock renderer (no video produced)",
        kind: "MOCK",
        provenance: "MOCK",
      },
      artifactRef: `mock://explainer/${request.explainerId}`,
      fingerprint: renderFingerprint(request),
      outputBytes: 0,
      observedAtEpochMs: this.now(),
    };
  }
}
