/**
 * Evidence-Grounded Run Explainer — public integration surface (E7).
 *
 * Codex imports ONLY this module to add "EXPLAIN THIS RUN" to the end of the
 * flagship experience. No other explainer module needs to be understood or
 * imported.
 *
 * Canonical flow:
 *
 *   completedVerifiedRun
 *        ↓
 *   prepareRunExplainer(evidence)      // READ — manifest + script + storyboard
 *        ↓
 *   <StoryboardPreview storyboard={...} />   // preview (no render yet)
 *        ↓
 *   renderApprovedExplainer(prepared, renderArtifact, store)   // CONSEQUENCE → Commit
 *        ↓
 *   verifyRender(result, request)      // optional: confirm the artifact
 *        ↓
 *   publishExplainer(rendered, publishArtifact, store, destination, stateFingerprint)  // DIFFERENT consequence → its OWN Commit
 *
 * The explainer is strictly downstream: it never modifies or authorizes the run
 * it describes. Render and publish are distinct consequences, each gated by its
 * own Commit AuthorizationArtifact (capabilities `explainer:render` and
 * `explainer:publish`).
 */

// The React preview component (mount it with the prepared storyboard).
export { StoryboardPreview } from "./storyboard-preview";

// The real browser renderer (replaceable behind ExplainerRenderer).
export { HtmlSlideshowRenderer } from "./html-renderer";

// The tool surface and the one-call entry point.
export {
  prepareRunExplainer,
  renderApprovedExplainer,
  publishExplainer,
  explainerTools,
  EXPLAINER_RENDER_CAPABILITY,
  EXPLAINER_PUBLISH_CAPABILITY,
  renderEffectPayload,
  publishEffectPayload,
} from "./explainer-surface";
export type {
  PreparedExplainer,
  ExplainerToolName,
  ExplainerToolDescriptor,
  RenderPlan,
  PublishResult,
  RenderConsequenceEffect,
  PublishConsequenceEffect,
} from "./explainer-surface";

// Render verification (bind the artifact to its inputs).
export { verifyRender, renderFingerprint } from "./renderer";
export type { RenderResult, ExplainerRenderer, RenderRequest } from "./renderer";

// Types Codex needs to assemble the evidence input and consume the output.
export type { ExplainerRunInput, ExplainerManifest } from "./explainer-manifest";
export type { NarrationScript } from "./narration-script";
export type { Storyboard, StoryboardCard, StoryboardFact } from "./storyboard";
