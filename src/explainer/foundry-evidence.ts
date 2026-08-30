import { stableFingerprint } from "../xact/authorization-artifact";
import { prepareFoundryRunExplanation, type FoundryRunEvidence } from "../flagship/foundry-run-explainer";
import type { NarrationScript } from "./narration-script";
import type { Storyboard, StoryboardCard, StoryboardVisualType } from "./storyboard";
import type { FoundryExplainerManifest, PreparedExplainer } from "./explainer-surface";

const visualFor: Record<string, StoryboardVisualType> = {
  "WHAT YOU ASKED": "PROMPT",
  "WHAT XACT CONSTRUCTED": "WEBMCP",
  "WHAT THE HOST VERIFIED": "VERIFICATION",
  "HOST EXPOSURE BLOCKED": "REFUSAL",
  "WHAT THE TOOL DID": "EXECUTION",
  "WHAT XACT APPLIED": "EXECUTION",
  "WHAT XACT REFUSED TO DO": "REFUSAL",
  "WHERE XACT STOPPED": "REFUSAL",
};

/**
 * READ: prepare a Foundry build/invocation explanation for the existing E7
 * renderer and publisher. The returned plan has no render or publish power;
 * those remain gated by renderApprovedExplainer and publishExplainer.
 */
export function prepareFoundryRunExplainer(
  evidence: FoundryRunEvidence,
): PreparedExplainer | undefined {
  const explanation = prepareFoundryRunExplanation(evidence);
  if (!explanation) return undefined;
  const snapshot = stableFingerprint(evidence);
  const runId = `foundry:${snapshot.slice(0, 16)}`;
  const manifest: FoundryExplainerManifest = {
    kind: "FOUNDRY_EXPLAINER_MANIFEST",
    runId,
    stateFingerprint: { value: snapshot },
  };
  const claims = explanation.cards.flatMap((card) => [card.primary, ...card.supporting].map((fact, index) => ({
    claimId: `${card.id}:${index}`,
    claimType: card.id,
    fact,
    sourceEventIds: [...card.evidenceRefs],
    truth: card.truth === "NOT_MEASURED" ? "LIVE" as const : card.truth,
    verified: true,
  })));
  const narration: NarrationScript = {
    kind: "EXPLAINER_SCRIPT",
    runId,
    scenes: explanation.cards.map((card) => ({
      id: `scene:${card.id}`,
      title: card.title,
      sentences: [card.primary, ...card.supporting].map((text, index) => ({
        id: `sentence:${card.id}:${index}`,
        kind: "FACTUAL" as const,
        text,
        claims: [claims.find((claim) => claim.claimId === `${card.id}:${index}`)!],
        sourceEventIds: [...card.evidenceRefs],
        truth: "LIVE" as const,
      })),
    })),
    claims,
  };
  let startMs = 0;
  const cards: StoryboardCard[] = explanation.cards.map((card, index) => {
    const durationMs = 4000;
    const next: StoryboardCard = {
      id: `card:${index + 1}`,
      title: card.title,
      visualType: visualFor[card.title] ?? "WEBMCP",
      startMs,
      durationMs,
      narrationSentenceIds: [card.primary, ...card.supporting].map((_, factIndex) => `sentence:${card.id}:${factIndex}`),
      evidenceRefs: [...card.evidenceRefs],
      facts: [card.primary, ...card.supporting].map((text, factIndex) => ({
        role: factIndex === 0 ? "PRIMARY" as const : "SUPPORTING" as const,
        text,
        sourceEventIds: [...card.evidenceRefs],
        truth: "LIVE" as const,
      })),
      provenanceBadge: "LIVE",
    };
    startMs += durationMs;
    return next;
  });
  const storyboard: Storyboard = { kind: "EXPLAINER_STORYBOARD", runId, totalDurationMs: startMs, cards };
  return {
    explainerId: `explainer:${runId}`,
    runId,
    manifest,
    narration,
    storyboard,
    renderPlan: { rendererKind: "BROWSER", outputKind: "HTML_SLIDESHOW", targetDurationMs: storyboard.totalDurationMs },
  };
}
