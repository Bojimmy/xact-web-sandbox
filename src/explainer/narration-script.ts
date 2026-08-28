import {
  evidenceMap,
  manifestClaims,
  type ExplainerClaim,
  type ExplainerClock,
  type ExplainerManifest,
  type ExplainerTruthKind,
} from "./explainer-manifest";

/**
 * Evidence-Grounded Narration Script (E2).
 *
 * Produces a typed, inspectable script whose every factual sentence resolves to
 * validated ExplainerClaim evidence. Transition sentences are restricted to a
 * closed architectural library — they may connect, but never invent a measured
 * event. Renderer-independent: no TTS, video, or WebMCP surface here.
 */

// ---- Script contract ----------------------------------------------------

export type NarrationSentenceKind = "FACTUAL" | "TRANSITION";

export interface NarrationSentence {
  id: string;
  kind: NarrationSentenceKind;
  text: string;
  /** FACTUAL: ≥1 validated claim. TRANSITION: empty. */
  claims: ExplainerClaim[];
  /** FACTUAL: evidence paths (derived from claims). TRANSITION: empty. */
  sourceEventIds: string[];
  /** FACTUAL only: the provenance of the evidence. */
  truth?: ExplainerTruthKind;
  /** FACTUAL only: present when the underlying claim carries a clock. */
  clock?: ExplainerClock;
  /** TRANSITION only: the closed architectural library key. */
  architecturalKey?: ArchitecturalKey;
}

export interface NarrationScene {
  id: string;
  title: string;
  sentences: NarrationSentence[];
}

export interface NarrationScript {
  kind: "EXPLAINER_SCRIPT";
  runId: string;
  scenes: NarrationScene[];
  /** Every factual claim used by the script, for an "inspect evidence" control. */
  claims: ExplainerClaim[];
}

// ---- Closed architectural language (transition narration) ----------------

export const TRANSITION_LIBRARY = Object.freeze({
  master: "Reason when necessary. Execute Xactly.",
  authority: "Reasoning may propose a consequence. Only Xact may commit one.",
  webmcp: "WebMCP provides capability. Xact provides authority.",
  governance: "Capability may evolve. Authority remains governed.",
  learning: "Reasoning used to reduce the future need for reasoning.",
  absorption: "Reasoning discovers. Governance approves. Xact absorbs.",
  enterprise: "AI can learn without learning to overstep.",
  refusal: "Knowing how is not authority to act.",
  execution: "Execution substrate can change. Authority does not.",
  vision: "Vision may locate an authorized target. It may not redefine one.",
  overall: "Let intelligence expand capability without expanding authority.",
  activatedResolution: "ACTIVATED allows a capability to participate in deterministic resolution. It does not confer execution authority.",
  explainer: "The AI can tell the story. Xact determines what story the evidence supports.",
} as const);

export type ArchitecturalKey = keyof typeof TRANSITION_LIBRARY;

// ---- Deterministic generation -------------------------------------------

interface ScenePlan {
  title: string;
  claimTypes: string[];
  transition?: ArchitecturalKey;
}

const SCENE_PLAN: ScenePlan[] = [
  { title: "WHAT YOU ASKED", claimTypes: ["JUDGE_REQUEST", "REQUESTED_CAPABILITY"] },
  { title: "WHAT XACT RESOLVED", claimTypes: ["RESOLVED", "UNRESOLVED", "COMMIT_CONSTRAINT"] },
  { title: "WHERE REASONING WAS NEEDED", claimTypes: ["REASONING_CLOCK"] },
  { title: "GOVERNANCE", claimTypes: ["ACTIVATION", "REFUSAL"], transition: "governance" },
  { title: "WEBMCP", claimTypes: ["WEBMCP_TOOLS"], transition: "webmcp" },
  { title: "COMMIT", claimTypes: ["COMMIT"], transition: "authority" },
  { title: "EXECUTION", claimTypes: ["EXECUTION"], transition: "execution" },
  { title: "VERIFY", claimTypes: ["VERIFICATION", "OBSERVATION"] },
  { title: "LEARNING RESULT", claimTypes: ["WORK", "LEARNING_COMPARISON", "WORK_CLOCK", "DECISION_CLOCK"], transition: "learning" },
  { title: "XACT", claimTypes: [], transition: "overall" },
];

function claimTypeFor(claim: ExplainerClaim): string {
  // CLOCK claims are further discriminated by their clock so each of the three
  // clocks lands in its own scene and is never blended.
  if (claim.claimType === "CLOCK") {
    return `${claim.clock ?? "UNKNOWN"}_CLOCK`;
  }
  return claim.claimType;
}

export function generateScript(manifest: ExplainerManifest): NarrationScript {
  const claims = manifestClaims(manifest);
  const byType = new Map<string, ExplainerClaim[]>();
  for (const claim of claims) {
    const type = claimTypeFor(claim);
    const list = byType.get(type) ?? [];
    list.push(claim);
    byType.set(type, list);
  }

  const scenes: NarrationScene[] = [];
  const used: ExplainerClaim[] = [];
  let sceneOrdinal = 0;

  for (const plan of SCENE_PLAN) {
    const sentences: NarrationSentence[] = [];
    const sceneClaims = plan.claimTypes.flatMap((type) => byType.get(type) ?? []);

    if (plan.transition && (sceneClaims.length > 0 || plan.title === "XACT")) {
      sentences.push(transitionSentence(plan.transition));
    }

    for (const claim of sceneClaims) {
      sentences.push(factualSentence(claim));
      used.push(claim);
    }

    if (sentences.length > 0) {
      sceneOrdinal += 1;
      scenes.push({ id: `scene:${sceneOrdinal}`, title: plan.title, sentences });
    }
  }

  return { kind: "EXPLAINER_SCRIPT", runId: manifest.runId, scenes, claims: used };
}

function factualSentence(claim: ExplainerClaim): NarrationSentence {
  return {
    id: `sentence:${claim.claimId}`,
    kind: "FACTUAL",
    text: claim.fact,
    claims: [claim],
    sourceEventIds: [...claim.sourceEventIds],
    truth: claim.truth,
    ...(claim.clock ? { clock: claim.clock } : {}),
  };
}

function transitionSentence(key: ArchitecturalKey): NarrationSentence {
  return {
    id: `sentence:transition:${key}`,
    kind: "TRANSITION",
    text: TRANSITION_LIBRARY[key],
    claims: [],
    sourceEventIds: [],
    architecturalKey: key,
  };
}

// ---- Constrained O-Agent narration --------------------------------------

export interface NarrationProvider {
  readonly providerName: string;
  draft(manifest: ExplainerManifest): Promise<NarrationDraft>;
}

export interface NarrationDraftSentence {
  id?: string;
  kind: NarrationSentenceKind;
  /** Required for FACTUAL; ignored for TRANSITION (the library text is canonical). */
  text?: string;
  /** FACTUAL: evidence paths the sentence is grounded in. */
  sourceEventIds?: string[];
  /** TRANSITION: closed architectural library key. */
  architecturalKey?: string;
  /** FACTUAL: provenance the draft claims for its evidence. */
  truth?: ExplainerTruthKind;
  /** FACTUAL: clock the draft claims for its evidence. */
  clock?: ExplainerClock;
}

export interface NarrationDraft {
  scenes: Array<{ title: string; sentences: NarrationDraftSentence[] }>;
}

export type NarrationAcceptance =
  | { ok: true; script: NarrationScript }
  | { ok: false; reason: string };

/**
 * Validate an O-Agent draft against the manifest. Rejects:
 *  - factual sentences with no evidence reference,
 *  - factual sentences referencing evidence absent from the manifest,
 *  - relabeling REFERENCE/SIMULATED evidence as LIVE,
 *  - blending clocks across one sentence,
 *  - authority-collapse phrasing (automatic execution/commit),
 *  - transition sentences not drawn from the closed library.
 */
export function acceptNarrationDraft(
  draft: NarrationDraft,
  manifest: ExplainerManifest,
): NarrationAcceptance {
  const index = evidenceMap(manifest);
  const scenes: NarrationScene[] = [];
  const usedClaims: ExplainerClaim[] = [];

  let sceneOrdinal = 0;
  for (const draftScene of draft.scenes) {
    const sentences: NarrationSentence[] = [];
    for (const sentence of draftScene.sentences) {
      if (sentence.kind === "TRANSITION") {
        const key = sentence.architecturalKey as ArchitecturalKey | undefined;
        if (!key || !(key in TRANSITION_LIBRARY)) {
          return { ok: false, reason: `Transition sentence references an unknown architectural key: ${String(sentence.architecturalKey)}.` };
        }
        sentences.push({
          id: `sentence:draft:transition:${key}`,
          kind: "TRANSITION",
          text: TRANSITION_LIBRARY[key],
          claims: [],
          sourceEventIds: [],
          architecturalKey: key,
        });
        continue;
      }

      // FACTUAL
      const ids = sentence.sourceEventIds ?? [];
      if (ids.length === 0) {
        return { ok: false, reason: `Factual narration has no evidence: "${sentence.text ?? ""}"` };
      }
      if (!sentence.text?.trim()) {
        return { ok: false, reason: "Factual narration has no text." };
      }
      const refs = ids.map((id) => index.get(id));
      if (refs.some((ref) => ref === undefined)) {
        const missing = ids.filter((id) => !index.has(id));
        return { ok: false, reason: `Factual narration references unsupported evidence: ${missing.join(", ")}.` };
      }

      const expectedTruth = conservativeTruth(refs.map((ref) => ref!.truth));
      if (sentence.truth && sentence.truth !== expectedTruth) {
        return { ok: false, reason: `Factual narration relabels ${expectedTruth} evidence as ${sentence.truth}: "${sentence.text}"` };
      }

      const clocks = new Set(refs.map((ref) => ref!.clock).filter((clock): clock is ExplainerClock => clock !== undefined));
      if (sentence.clock && (clocks.size === 0 || !clocks.has(sentence.clock))) {
        return { ok: false, reason: `Factual narration mislabels its clock: "${sentence.text}"` };
      }

      if (/(?:execute|commit|authorize|activate)\s+automatically/i.test(sentence.text)) {
        return { ok: false, reason: `Factual narration asserts automatic authority: "${sentence.text}"` };
      }

      const claim: ExplainerClaim = {
        claimId: `draft-claim:${sentence.id ?? Math.random().toString(36).slice(2)}`,
        claimType: "DRAFT",
        fact: sentence.text,
        sourceEventIds: [...ids],
        truth: expectedTruth,
        ...(sentence.clock ? { clock: sentence.clock } : {}),
        verified: true,
      };
      sentences.push({
        id: `sentence:draft:${sentence.id ?? ids[0]}`,
        kind: "FACTUAL",
        text: sentence.text,
        claims: [claim],
        sourceEventIds: [...ids],
        truth: expectedTruth,
        ...(sentence.clock ? { clock: sentence.clock } : {}),
      });
      usedClaims.push(claim);
    }

    sceneOrdinal += 1;
    scenes.push({ id: `scene:draft:${sceneOrdinal}`, title: draftScene.title, sentences });
  }

  return { ok: true, script: { kind: "EXPLAINER_SCRIPT", runId: manifest.runId, scenes, claims: usedClaims } };
}

function conservativeTruth(truths: ExplainerTruthKind[]): ExplainerTruthKind {
  if (truths.includes("SIMULATED")) return "SIMULATED";
  if (truths.includes("REFERENCE")) return "REFERENCE";
  return "LIVE";
}
