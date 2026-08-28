import type {
  ExplainerClock,
  ExplainerManifest,
  ExplainerTruthKind,
} from "./explainer-manifest";
import { TRANSITION_LIBRARY, type NarrationScript, type NarrationSentence } from "./narration-script";

/**
 * Evidence-Grounded Storyboard (E3).
 *
 * A deterministic, timed, renderer-independent projection of the validated
 * NarrationScript + ExplainerManifest. No card introduces a factual claim that
 * did not already exist in E1/E2; derived facts (counts, lifecycle, checksum)
 * always carry the underlying evidence refs. The three clocks are emitted as
 * separate cards so the ~9 µs reference decision benchmark is never presented
 * beside live numbers as if from the same measurement.
 */

export type StoryboardVisualType =
  | "PROMPT"
  | "COUNTS"
  | "REASONING"
  | "GOVERNANCE"
  | "ACTIVATION"
  | "WEBMCP"
  | "COMMIT"
  | "EXECUTION"
  | "OBSERVATION"
  | "VERIFICATION"
  | "LEARNING"
  | "CLOCK"
  | "REFUSAL"
  | "BRAND";

export interface StoryboardFact {
  role: "PRIMARY" | "SUPPORTING";
  text: string;
  sourceEventIds: string[];
  truth: ExplainerTruthKind;
  clock?: ExplainerClock;
}

export interface StoryboardCard {
  id: string;
  title: string;
  visualType: StoryboardVisualType;
  startMs: number;
  durationMs: number;
  narrationSentenceIds: string[];
  evidenceRefs: string[];
  facts: StoryboardFact[];
  provenanceBadge: ExplainerTruthKind;
  clock?: ExplainerClock;
  transition?: string;
}

export interface Storyboard {
  kind: "EXPLAINER_STORYBOARD";
  runId: string;
  totalDurationMs: number;
  cards: StoryboardCard[];
}

const VISUAL_DURATION_MS: Record<StoryboardVisualType, number> = {
  PROMPT: 5000,
  COUNTS: 5000,
  REASONING: 4000,
  GOVERNANCE: 4000,
  ACTIVATION: 4000,
  WEBMCP: 4000,
  COMMIT: 4000,
  EXECUTION: 4000,
  OBSERVATION: 3500,
  VERIFICATION: 3500,
  LEARNING: 5500,
  CLOCK: 3000,
  REFUSAL: 4500,
  BRAND: 3000,
};

function conservativeTruth(truths: ExplainerTruthKind[]): ExplainerTruthKind {
  if (truths.includes("SIMULATED")) return "SIMULATED";
  if (truths.includes("REFERENCE")) return "REFERENCE";
  return "LIVE";
}

function factualSentences(script: NarrationScript): NarrationSentence[] {
  return script.scenes.flatMap((scene) => scene.sentences).filter((sentence) => sentence.kind === "FACTUAL");
}

function sentencesOfClaimType(script: NarrationScript, claimType: string): NarrationSentence[] {
  return factualSentences(script).filter((sentence) => sentence.claims.some((claim) => claim.claimType === claimType));
}

function factFromSentence(sentence: NarrationSentence, role: "PRIMARY" | "SUPPORTING"): StoryboardFact {
  return {
    role,
    text: sentence.text,
    sourceEventIds: [...sentence.sourceEventIds],
    truth: sentence.truth ?? "LIVE",
    ...(sentence.clock ? { clock: sentence.clock } : {}),
  };
}

function derivedFact(
  role: "PRIMARY" | "SUPPORTING",
  text: string,
  sourceEventIds: string[],
  truth: ExplainerTruthKind,
  clock?: ExplainerClock,
): StoryboardFact {
  return { role, text, sourceEventIds, truth, ...(clock ? { clock } : {}) };
}

export function buildStoryboard(script: NarrationScript, manifest: ExplainerManifest): Storyboard {
  const cards: StoryboardCard[] = [];
  let cursorMs = 0;
  let ordinal = 0;

  const emit = (card: Omit<StoryboardCard, "id" | "startMs" | "durationMs" | "evidenceRefs" | "provenanceBadge">): void => {
    ordinal += 1;
    const durationMs = VISUAL_DURATION_MS[card.visualType];
    const evidenceRefs = [...new Set(card.facts.flatMap((fact) => fact.sourceEventIds))];
    cards.push({
      ...card,
      id: `card:${ordinal}`,
      startMs: cursorMs,
      durationMs,
      evidenceRefs,
      provenanceBadge: conservativeTruth(card.facts.map((fact) => fact.truth)),
    });
    cursorMs += durationMs;
  };

  const sentenceIds = (claimTypes: string[]): string[] =>
    claimTypes.flatMap((type) => sentencesOfClaimType(script, type)).map((sentence) => sentence.id);

  // ---- Refusal path -----------------------------------------------------
  if (manifest.governance.refusedCapabilities.length > 0) {
    const requested = sentencesOfClaimType(script, "REQUESTED_CAPABILITY");
    const judge = sentencesOfClaimType(script, "JUDGE_REQUEST");
    const commit = sentencesOfClaimType(script, "COMMIT");
    const refusal = sentencesOfClaimType(script, "REFUSAL");

    const capabilityName = manifest.requestedCapability.value;
    emit({
      title: "REQUEST UNDERSTOOD",
      visualType: "PROMPT",
      narrationSentenceIds: sentenceIds(["JUDGE_REQUEST", "REQUESTED_CAPABILITY"]),
      facts: [
        ...judge.map((sentence) => factFromSentence(sentence, "PRIMARY")),
        ...requested.map((sentence) => factFromSentence(sentence, "SUPPORTING")),
      ],
    });

    emit({
      title: "CAPABILITY POSSIBLE",
      visualType: "REFUSAL",
      narrationSentenceIds: [],
      facts: [derivedFact("PRIMARY", `Capability: ${capabilityName}`, [manifest.requestedCapability.ref.path], "LIVE")],
      transition: TRANSITION_LIBRARY.refusal,
    });

    emit({
      title: "AUTHORITY NOT ESTABLISHED",
      visualType: "REFUSAL",
      narrationSentenceIds: sentenceIds(["COMMIT"]),
      facts: [
        ...commit.map((sentence) => factFromSentence(sentence, "PRIMARY")),
        ...manifest.governance.refusalReasons.map((reason) => derivedFact("SUPPORTING", reason, [manifest.governance.ref.path], "LIVE")),
      ],
    });

    emit({
      title: "CAPABILITY NOT ACTIVATED",
      visualType: "REFUSAL",
      narrationSentenceIds: sentenceIds(["REFUSAL"]),
      facts: [
        ...refusal.map((sentence) => factFromSentence(sentence, "PRIMARY")),
        derivedFact("SUPPORTING", "CAPABILITY NOT ACTIVATED", [manifest.governance.ref.path], "LIVE"),
      ],
    });

    emit({ title: "XACT", visualType: "BRAND", narrationSentenceIds: [], facts: [], transition: TRANSITION_LIBRARY.master });
    return { kind: "EXPLAINER_STORYBOARD", runId: manifest.runId, totalDurationMs: cursorMs, cards };
  }

  // ---- Happy path (flagship sequence) ----------------------------------
  const judge = sentencesOfClaimType(script, "JUDGE_REQUEST");
  const requested = sentencesOfClaimType(script, "REQUESTED_CAPABILITY");
  if (judge.length || requested.length) {
    emit({
      title: "WHAT YOU ASKED",
      visualType: "PROMPT",
      narrationSentenceIds: sentenceIds(["JUDGE_REQUEST", "REQUESTED_CAPABILITY"]),
      facts: [
        ...judge.map((sentence) => factFromSentence(sentence, "PRIMARY")),
        ...requested.map((sentence) => factFromSentence(sentence, "SUPPORTING")),
      ],
    });
  }

  const resolved = sentencesOfClaimType(script, "RESOLVED");
  const unresolved = sentencesOfClaimType(script, "UNRESOLVED");
  const constraints = sentencesOfClaimType(script, "COMMIT_CONSTRAINT");
  if (resolved.length || unresolved.length || constraints.length) {
    const countIds = [
      ...manifest.resolvedFacts.map((fact) => fact.ref.path),
      ...manifest.unresolvedItems.map((item) => item.ref.path),
      ...manifest.commitConstraints.map((constraint) => constraint.ref.path),
    ];
    emit({
      title: "WHAT XACT RESOLVED",
      visualType: "COUNTS",
      narrationSentenceIds: sentenceIds(["RESOLVED", "UNRESOLVED", "COMMIT_CONSTRAINT"]),
      facts: [
        derivedFact("PRIMARY", `Resolved ${resolved.length} · Unresolved ${unresolved.length} · Commit constraints ${constraints.length}`, countIds, "LIVE"),
        ...resolved.map((sentence) => factFromSentence(sentence, "SUPPORTING")),
        ...unresolved.map((sentence) => factFromSentence(sentence, "SUPPORTING")),
        ...constraints.map((sentence) => factFromSentence(sentence, "SUPPORTING")),
      ],
    });
  }

  const reasoningClock = manifest.clocks.find((clock) => clock.clock === "REASONING");
  if (reasoningClock) {
    const reasoningSentenceIds = sentencesOfClaimType(script, "CLOCK")
      .filter((sentence) => sentence.clock === "REASONING")
      .map((sentence) => sentence.id);
    emit({
      title: "WHAT REQUIRED REASONING",
      visualType: "REASONING",
      narrationSentenceIds: reasoningSentenceIds,
      facts: [derivedFact("PRIMARY", reasoningClock.value, [reasoningClock.ref.path], reasoningClock.truth, reasoningClock.clock)],
      clock: reasoningClock.clock,
    });
  }

  if (manifest.governance.activated) {
    const lifecycle = manifest.governance.statesReached.join(" → ");
    emit({
      title: "WHAT GOVERNANCE ALLOWED",
      visualType: "GOVERNANCE",
      narrationSentenceIds: sentenceIds(["ACTIVATION"]),
      facts: [derivedFact("PRIMARY", lifecycle, [manifest.governance.ref.path], "LIVE")],
      transition: TRANSITION_LIBRARY.governance,
    });

    const activation = sentencesOfClaimType(script, "ACTIVATION");
    emit({
      title: "WHAT BECAME ACTIVATED",
      visualType: "ACTIVATION",
      narrationSentenceIds: sentenceIds(["ACTIVATION"]),
      facts: [
        ...activation.map((sentence) => factFromSentence(sentence, "PRIMARY")),
        ...manifest.governance.activatedCapabilities.map((capability) => derivedFact("SUPPORTING", `Activated: ${capability}`, [manifest.governance.ref.path], "LIVE")),
      ],
      transition: TRANSITION_LIBRARY.activatedResolution,
    });
  }

  const tools = sentencesOfClaimType(script, "WEBMCP_TOOLS");
  if (tools.length) {
    emit({
      title: "WEBMCP CAPABILITY",
      visualType: "WEBMCP",
      narrationSentenceIds: sentenceIds(["WEBMCP_TOOLS"]),
      facts: tools.map((sentence) => factFromSentence(sentence, "PRIMARY")),
      transition: TRANSITION_LIBRARY.webmcp,
    });
  }

  const commit = sentencesOfClaimType(script, "COMMIT");
  if (commit.length) {
    emit({
      title: "WHAT COMMIT AUTHORIZED",
      visualType: "COMMIT",
      narrationSentenceIds: sentenceIds(["COMMIT"]),
      facts: commit.map((sentence) => factFromSentence(sentence, "PRIMARY")),
      transition: TRANSITION_LIBRARY.authority,
    });
  }

  const execution = sentencesOfClaimType(script, "EXECUTION");
  if (execution.length) {
    emit({
      title: "HOW IT EXECUTED",
      visualType: "EXECUTION",
      narrationSentenceIds: sentenceIds(["EXECUTION"]),
      facts: execution.map((sentence) => factFromSentence(sentence, "PRIMARY")),
      transition: TRANSITION_LIBRARY.execution,
    });
  }

  const observation = sentencesOfClaimType(script, "OBSERVATION");
  if (observation.length) {
    emit({
      title: "WHAT XACT OBSERVED",
      visualType: "OBSERVATION",
      narrationSentenceIds: sentenceIds(["OBSERVATION"]),
      facts: observation.map((sentence) => factFromSentence(sentence, "PRIMARY")),
    });
  }

  const verification = sentencesOfClaimType(script, "VERIFICATION");
  if (verification.length) {
    emit({
      title: "WHAT XACT VERIFIED",
      visualType: "VERIFICATION",
      narrationSentenceIds: sentenceIds(["VERIFICATION"]),
      facts: verification.map((sentence) => factFromSentence(sentence, "PRIMARY")),
    });
  }

  if (manifest.reasoningComparison) {
    const comparison = manifest.reasoningComparison;
    emit({
      title: "WHAT XACT LEARNED",
      visualType: "LEARNING",
      narrationSentenceIds: sentenceIds(["LEARNING_COMPARISON"]),
      clock: "REASONING",
      facts: [
        derivedFact("PRIMARY", `${comparison.callsBefore} → ${comparison.callsAfter} O-Agent calls`, [comparison.ref.path], comparison.ref.truth, "REASONING"),
        derivedFact("SUPPORTING", `${comparison.callsDeltaPercent.toFixed(1)}%`, [comparison.ref.path], comparison.ref.truth, "REASONING"),
        derivedFact("SUPPORTING", `Checksum ${comparison.checksumBefore} → ${comparison.checksumAfter} (identical)`, [comparison.ref.path], comparison.ref.truth),
        derivedFact("SUPPORTING", comparison.note, [comparison.ref.path], comparison.ref.truth),
      ],
      transition: TRANSITION_LIBRARY.learning,
    });
  }

  // ---- The three clocks, always as separate cards ----------------------
  for (const clock of manifest.clocks) {
    emit({
      title: clock.clock === "DECISION" ? "CLOCK · DECISION (REFERENCE)" : clock.clock === "WORK" ? "CLOCK · WORK (LIVE)" : "CLOCK · REASONING",
      visualType: "CLOCK",
      narrationSentenceIds: [],
      clock: clock.clock,
      facts: [derivedFact("PRIMARY", `${clock.label}: ${clock.value}`, [clock.ref.path], clock.truth, clock.clock)],
    });
  }

  emit({ title: "XACT", visualType: "BRAND", narrationSentenceIds: [], facts: [], transition: TRANSITION_LIBRARY.master });

  return { kind: "EXPLAINER_STORYBOARD", runId: manifest.runId, totalDurationMs: cursorMs, cards };
}
