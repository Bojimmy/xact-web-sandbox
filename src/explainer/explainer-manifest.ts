import type {
  AuthorizationArtifact,
  CommitCheck,
  DecisionStatus,
  ResolvedFact,
  UnresolvedField,
} from "../xact/contracts";
import type { VerificationResult } from "../xact/providers";
import type {
  ExecutionObservation,
  ExecutionSubstrate,
} from "../execution/contracts";
import type { SimulationSession } from "../runtime/contracts";
import type {
  ConstructionRun,
  ServiceOperationsToolDescriptor,
} from "../construction/contracts";
import type { FlagshipLearningRun } from "../flagship/learning-run";
import type { EvolutionSnapshot } from "../evolution/contracts";
import type { CostComparisonRun } from "../telemetry/deterministic-reasoning-cost";
import { referenceXactBenchmark } from "../telemetry/reference-benchmark";

/**
 * Evidence-Grounded Run Explainer — the strictly downstream projection of a
 * verified run (ADR 0015).
 *
 * This module has ZERO authority over the run it describes. No type here
 * exposes commit / execute / authorize / activate / resolve / artifact. It
 * projects verified run/audit/telemetry evidence into a manifest and lets a
 * later narration layer speak only about what the evidence supports.
 */

// ---- Truth & clock labeling (never blended) -----------------------------

export type ExplainerTruthKind = "REFERENCE" | "LIVE" | "SIMULATED";

/** The three clocks (ADR 0011). DECISION is reference-only; never measured here. */
export type ExplainerClock = "DECISION" | "WORK" | "REASONING";

export type ExplainerClockProvenance =
  | "REFERENCE_XACT_CORE_BENCHMARK"
  | "LIVE_SANDBOX_MEASUREMENT"
  | "LIVE_O_AGENT_MEASUREMENT"
  | "SIMULATED_O_AGENT";

/** Every factual item points back at the source record it was projected from. */
export interface EvidenceRef {
  path: string;
  truth: ExplainerTruthKind;
  clock?: ExplainerClock;
}

// ---- Section item projections -------------------------------------------

export interface ManifestResolvedFact extends ResolvedFact {
  ref: EvidenceRef;
}

export interface ManifestUnresolvedItem extends UnresolvedField {
  ref: EvidenceRef;
}

export interface ManifestCommitConstraint {
  key: string;
  description: string;
  condition: string;
  satisfied: boolean | "unknown";
  ref: EvidenceRef;
}

export interface ManifestCommitEvent {
  commitId: string;
  status: DecisionStatus;
  capability: string;
  actor: string;
  effectFingerprint: string;
  nonce?: string;
  reason: string;
  checks: CommitCheck[];
  ref: EvidenceRef;
}

export interface ManifestExecutionEvent {
  substrate: ExecutionSubstrate | "NONE";
  executed: boolean;
  target?: string;
  receipt?: unknown;
  error?: string;
  ref: EvidenceRef;
}

export interface ManifestObservation {
  substrate: ExecutionSubstrate;
  target: string;
  effectFingerprint: string;
  receipt: unknown;
  observedAtEpochMs: number;
  ref: EvidenceRef;
}

export interface ManifestVerification {
  verified: boolean;
  reason: string;
  checks: string[];
  ref: EvidenceRef;
}

export interface ManifestTelemetry {
  stage: string;
  durationUs: number;
  truth: ExplainerTruthKind;
  clock: ExplainerClock;
  ref: EvidenceRef;
}

export interface ManifestTool {
  name: string;
  description: string;
  kind: "READ" | "CONSEQUENCE_REQUEST";
  requiresCommit: boolean;
  ref: EvidenceRef;
}

export interface ManifestGovernance {
  statesReached: string[];
  activated: boolean;
  activatedCapabilities: string[];
  refusedCapabilities: string[];
  refusalReasons: string[];
  ref: EvidenceRef;
}

export interface ManifestWorkProjection {
  executedConstructionOperations: number;
  deterministicallyResolvedOperations: number;
  reasoningOperations: number;
  checksum?: number;
  note: string;
  ref: EvidenceRef;
}

export interface ManifestReasoningComparison {
  callsBefore: number;
  callsAfter: number;
  callsDeltaPercent: number;
  checksumBefore: number;
  checksumAfter: number;
  /** Only true when the deterministic checksum is unchanged across the comparison. */
  checksumUnchanged: boolean;
  note: string;
  ref: EvidenceRef;
}

export interface ExplainerClockReading {
  clock: ExplainerClock;
  provenance: ExplainerClockProvenance;
  truth: ExplainerTruthKind;
  label: string;
  value: string;
  ref: EvidenceRef;
}

export interface ExplainerAuthorityDistinction {
  activated: { reached: boolean; statement: string };
  commit: { occurred: boolean; statement: string };
}

/** One evidence entry in the manifest's lookup index. */
export interface ExplainerEvidenceEntry {
  path: string;
  truth: ExplainerTruthKind;
  clock?: ExplainerClock;
}

// ---- The manifest -------------------------------------------------------

export interface ExplainerManifest {
  kind: "EXPLAINER_MANIFEST";
  runId: string;
  generatedAtEpochMs: number;
  /** Integration-supplied judge inputs (never synthesized by the explainer). */
  judgePrompt: { value: string; ref: EvidenceRef };
  requestedCapability: { value: string; ref: EvidenceRef };
  resolvedFacts: ManifestResolvedFact[];
  unresolvedItems: ManifestUnresolvedItem[];
  commitConstraints: ManifestCommitConstraint[];
  commitEvents: ManifestCommitEvent[];
  executionEvents: ManifestExecutionEvent[];
  observations: ManifestObservation[];
  verificationResults: ManifestVerification[];
  telemetry: ManifestTelemetry[];
  clocks: ExplainerClockReading[];
  governance: ManifestGovernance;
  webMcpTools: ManifestTool[];
  artifactFingerprint: { value: string; truth: ExplainerTruthKind; ref: EvidenceRef };
  stateFingerprint: { value: string; truth: ExplainerTruthKind; ref: EvidenceRef };
  finalOutcome: { value: string; truth: ExplainerTruthKind; ref: EvidenceRef };
  workProjection: ManifestWorkProjection | null;
  reasoningComparison: ManifestReasoningComparison | null;
  authorityDistinction: ExplainerAuthorityDistinction;
  /** Complete evidence lookup: path → truth/clock for every factual section. */
  evidence: ExplainerEvidenceEntry[];
}

// ---- Builder ------------------------------------------------------------

export interface ExplainerRunInput<TInputs, TState, TEffect> {
  runId: string;
  judgePrompt: string;
  requestedCapability: string;
  session: SimulationSession<TInputs, TState, TEffect>;
  construction?: ConstructionRun;
  learning?: FlagshipLearningRun;
  learningBaseline?: FlagshipLearningRun;
  evolution?: EvolutionSnapshot;
  cost?: CostComparisonRun;
  webMcpTools?: readonly ServiceOperationsToolDescriptor[];
  /** Public-safe observation; absent on the current session type (flagged in ADR 0015). */
  observation?: ExecutionObservation;
}

function truthFor(provenance: string | undefined, fallback: ExplainerTruthKind): ExplainerTruthKind {
  if (provenance === "SIMULATED_O_AGENT") return "SIMULATED";
  if (provenance === "LIVE_O_AGENT_MEASUREMENT") return "LIVE";
  return fallback;
}

export function buildExplainerManifest<TInputs, TState, TEffect>(
  input: ExplainerRunInput<TInputs, TState, TEffect>,
  now: () => number = Date.now,
): ExplainerManifest {
  const session = input.session;
  const candidate = session.candidate;
  const decision = session.decision;
  const artifact = decision?.artifact;

  const resolvedFacts: ManifestResolvedFact[] = (candidate?.resolution.resolved ?? []).map((fact, index) => ({
    ...fact,
    ref: { path: `session.candidate.resolution.resolved[${index}]`, truth: "LIVE" },
  }));
  const unresolvedItems: ManifestUnresolvedItem[] = (candidate?.resolution.unresolved ?? []).map((item, index) => ({
    ...item,
    ref: { path: `session.candidate.resolution.unresolved[${index}]`, truth: "LIVE" },
  }));
  const commitConstraints: ManifestCommitConstraint[] = (candidate?.resolution.commitConstraints ?? []).map((constraint, index) => ({
    key: constraint.key,
    description: constraint.description,
    condition: constraint.condition,
    satisfied: constraint.satisfied,
    ref: { path: `session.candidate.resolution.commitConstraints[${index}]`, truth: "LIVE" },
  }));

  const commitEvents: ManifestCommitEvent[] = decision
    ? [{
        commitId: decision.candidate.candidateId,
        status: decision.status,
        capability: artifact?.capability ?? decision.candidate.candidateId,
        actor: artifact?.actor ?? "unknown",
        effectFingerprint: artifact?.effectFingerprint ?? "",
        nonce: artifact?.nonce,
        reason: decision.reason,
        checks: decision.checks,
        ref: { path: "session.decision", truth: "LIVE" },
      }]
    : [];

  const executionEvents: ManifestExecutionEvent[] = session.execution
    ? [{
        substrate: session.selectedSubstrate,
        executed: session.execution.executed,
        receipt: session.execution.receipt,
        error: session.execution.error,
        ref: { path: "session.execution", truth: "LIVE" },
      }]
    : [];

  const observations: ManifestObservation[] = input.observation
    ? [{
        substrate: input.observation.substrate,
        target: input.observation.target,
        effectFingerprint: input.observation.effectFingerprint,
        receipt: input.observation.receipt,
        observedAtEpochMs: input.observation.observedAtEpochMs,
        ref: { path: "session.observation", truth: "LIVE" },
      }]
    : [];

  const verificationResults: ManifestVerification[] = session.verification
    ? [{
        verified: session.verification.verified,
        reason: session.verification.reason,
        checks: session.verification.checks,
        ref: { path: "session.verification", truth: "LIVE" },
      }]
    : [];

  const telemetry: ManifestTelemetry[] = session.telemetry.map((sample, index) => ({
    stage: sample.stage,
    durationUs: sample.durationUs,
    truth: "LIVE",
    clock: "WORK",
    ref: { path: `session.telemetry[${index}]`, truth: "LIVE", clock: "WORK" },
  }));

  const webMcpTools: ManifestTool[] = (input.webMcpTools ?? []).map((tool, index) => ({
    name: tool.name,
    description: tool.description,
    kind: tool.kind,
    requiresCommit: tool.requiresCommit,
    ref: { path: `webMcpTools[${index}]`, truth: "LIVE" },
  }));

  const governance = buildGovernance(input, decision?.status);

  const workProjection = buildWorkProjection(input.learning, input.cost);

  const reasoningComparison = buildReasoningComparison(input.learning, input.learningBaseline);

  const clocks = buildClocks(input);

  const artifactFingerprint = artifact
    ? { value: artifact.effectFingerprint, truth: "LIVE" as const, ref: { path: "session.decision.artifact.effectFingerprint", truth: "LIVE" as const } }
    : { value: "", truth: "LIVE" as const, ref: { path: "session.decision.artifact", truth: "LIVE" as const } };

  const stateFingerprint = {
    value: session.currentStateFingerprint,
    truth: "LIVE" as const,
    ref: { path: "session.currentStateFingerprint", truth: "LIVE" as const },
  };

  const finalOutcome = {
    value: session.phase,
    truth: "LIVE" as const,
    ref: { path: "session.phase", truth: "LIVE" as const },
  };

  const authorityDistinction = authorityStatements(
    governance,
    commitEvents.some((event) => event.status === "AUTHORIZED"),
  );

  const judgePrompt = { value: input.judgePrompt, ref: { path: "input.judgePrompt", truth: "LIVE" as const } };
  const requestedCapability = { value: input.requestedCapability, ref: { path: "input.requestedCapability", truth: "LIVE" as const } };

  const evidence: ExplainerEvidenceEntry[] = [
    evidenceEntry(judgePrompt.ref),
    evidenceEntry(requestedCapability.ref),
    evidenceEntry(governance.ref),
    ...(workProjection ? [evidenceEntry(workProjection.ref)] : []),
    ...(reasoningComparison ? [evidenceEntry(reasoningComparison.ref)] : []),
    evidenceEntry(artifactFingerprint.ref),
    evidenceEntry(stateFingerprint.ref),
    evidenceEntry(finalOutcome.ref),
    ...resolvedFacts.map((fact) => evidenceEntry(fact.ref)),
    ...unresolvedItems.map((item) => evidenceEntry(item.ref)),
    ...commitConstraints.map((constraint) => evidenceEntry(constraint.ref)),
    ...commitEvents.map((event) => evidenceEntry(event.ref)),
    ...executionEvents.map((event) => evidenceEntry(event.ref)),
    ...observations.map((observation) => evidenceEntry(observation.ref)),
    ...verificationResults.map((verification) => evidenceEntry(verification.ref)),
    ...telemetry.map((sample) => evidenceEntry(sample.ref)),
    ...webMcpTools.map((tool) => evidenceEntry(tool.ref)),
    ...clocks.map((clock) => evidenceEntry(clock.ref)),
  ];

  return {
    kind: "EXPLAINER_MANIFEST",
    runId: input.runId,
    generatedAtEpochMs: now(),
    judgePrompt,
    requestedCapability,
    resolvedFacts,
    unresolvedItems,
    commitConstraints,
    commitEvents,
    executionEvents,
    observations,
    verificationResults,
    telemetry,
    clocks,
    governance,
    webMcpTools,
    artifactFingerprint,
    stateFingerprint,
    finalOutcome,
    workProjection,
    reasoningComparison,
    authorityDistinction,
    evidence,
  };
}

function evidenceEntry(ref: EvidenceRef): ExplainerEvidenceEntry {
  return ref.clock ? { path: ref.path, truth: ref.truth, clock: ref.clock } : { path: ref.path, truth: ref.truth };
}

function buildGovernance<TInputs, TState, TEffect>(
  input: ExplainerRunInput<TInputs, TState, TEffect>,
  decisionStatus: DecisionStatus | undefined,
): ManifestGovernance {
  const evolution = input.evolution;
  const statesReached = evolution?.candidate
    ? PROMOTION_ORDER.filter((state) => PROMOTION_ORDER.indexOf(state) <= PROMOTION_ORDER.indexOf(evolution.candidate!.state))
    : [];

  const activated = evolution?.candidate?.state === "ACTIVATED";
  const activatedCapabilities = activated ? [...(evolution?.candidate?.resolves ?? [])] : [];

  const refused = decisionStatus !== undefined && decisionStatus !== "AUTHORIZED";
  const refusedCapabilities = refused ? [input.requestedCapability] : [];
  const refusalReasons = refused
    ? (input.session.decision?.reason ? [input.session.decision.reason] : [])
        .concat(input.session.decision?.checks.filter((check) => check.outcome === "FAIL" || check.outcome === "HOLD").map((check) => `${check.key}: ${check.detail}`) ?? [])
    : [];

  return {
    statesReached,
    activated,
    activatedCapabilities,
    refusedCapabilities,
    refusalReasons,
    ref: { path: "evolution.candidate", truth: "LIVE" },
  };
}

const PROMOTION_ORDER = ["OBSERVED", "CANDIDATE", "VALIDATED", "APPROVED", "ACTIVATED"] as const;

function buildWorkProjection(
  learning: FlagshipLearningRun | undefined,
  cost: CostComparisonRun | undefined,
): ManifestWorkProjection | null {
  if (!learning && !cost) return null;
  const executed = learning?.executedConstructionOperations ?? cost?.totalOperations ?? 0;
  const resolved = learning?.deterministicallyResolvedOperations ?? cost?.deterministicOperations ?? 0;
  const reasoning = learning?.reasoningOperations ?? cost?.reasoningOperations ?? 0;
  const checksum = learning?.checksum ?? cost?.checksum;
  return {
    executedConstructionOperations: executed,
    deterministicallyResolvedOperations: resolved,
    reasoningOperations: reasoning,
    checksum,
    note: "Deterministic construction work executed is distinct from deterministically resolved: learning changes how many operations require reasoning, not whether the work was performed.",
    ref: { path: learning ? "flagship.learning" : "telemetry.cost", truth: learning ? truthFor(learning.provenance, "LIVE") : "LIVE", clock: "WORK" },
  };
}

function buildReasoningComparison(
  learning: FlagshipLearningRun | undefined,
  baseline: FlagshipLearningRun | undefined,
): ManifestReasoningComparison | null {
  if (!learning || !baseline) return null;
  const callsBefore = baseline.reasoningOperations;
  const callsAfter = learning.reasoningOperations;
  const callsDeltaPercent = callsBefore === 0 ? 0 : ((callsAfter - callsBefore) / callsBefore) * 100;
  const checksumUnchanged = baseline.checksum === learning.checksum;
  const note = checksumUnchanged && callsAfter < callsBefore
    ? "The LLM did not get faster; Xact stopped needing it."
    : "Reasoning calls changed, but the deterministic checksum did not remain identical across the comparison.";
  return {
    callsBefore,
    callsAfter,
    callsDeltaPercent: Number(callsDeltaPercent.toFixed(1)),
    checksumBefore: baseline.checksum,
    checksumAfter: learning.checksum,
    checksumUnchanged,
    note,
    ref: {
      path: "flagship.learning.comparison",
      truth: truthFor(learning.provenance, "LIVE"),
      clock: "REASONING",
    },
  };
}

function buildClocks<TInputs, TState, TEffect>(
  input: ExplainerRunInput<TInputs, TState, TEffect>,
): ExplainerClockReading[] {
  const clocks: ExplainerClockReading[] = [];

  // DECISION clock — reference only, never measured by this sandbox.
  clocks.push({
    clock: "DECISION",
    provenance: "REFERENCE_XACT_CORE_BENCHMARK",
    truth: "REFERENCE",
    label: "Reference Xact Core decision latency",
    value: `≈${referenceXactBenchmark.meanDecisionLatencyUs} µs mean (${referenceXactBenchmark.iterations.toLocaleString()} iterations, reference — not measured here)`,
    ref: { path: "referenceXactBenchmark", truth: "REFERENCE", clock: "DECISION" },
  });

  // WORK clock — live deterministic construction workload.
  if (input.construction) {
    clocks.push({
      clock: "WORK",
      provenance: "LIVE_SANDBOX_MEASUREMENT",
      truth: "LIVE",
      label: "Deterministic construction workload",
      value: `${input.construction.metrics.schedulerTimeMs.toFixed(0)} ms scheduler (${input.construction.metrics.deterministicOperations} deterministic ops)`,
      ref: { path: "construction.metrics", truth: "LIVE", clock: "WORK" },
    });
  } else if (input.cost) {
    clocks.push({
      clock: "WORK",
      provenance: "LIVE_SANDBOX_MEASUREMENT",
      truth: "LIVE",
      label: "Deterministic construction workload",
      value: `${input.cost.deterministic.schedulerTimeMs.toFixed(0)} ms scheduler (${input.cost.deterministic.operations} ops)`,
      ref: { path: "cost.deterministic", truth: "LIVE", clock: "WORK" },
    });
  } else if (input.learning) {
    clocks.push({
      clock: "WORK",
      provenance: "LIVE_SANDBOX_MEASUREMENT",
      truth: "LIVE",
      label: "Deterministic construction workload",
      value: `${input.learning.workTimeMs.toFixed(0)} ms deterministic work (${input.learning.executedConstructionOperations} ops executed)`,
      ref: { path: "flagship.learning.workTimeMs", truth: "LIVE", clock: "WORK" },
    });
  }

  // REASONING clock — live or simulated O-Agent, never relabeled.
  if (input.learning) {
    const provenance: ExplainerClockProvenance = input.learning.provenance === "SIMULATED_O_AGENT" ? "SIMULATED_O_AGENT" : "LIVE_O_AGENT_MEASUREMENT";
    const simulated = input.learning.provenance === "SIMULATED_O_AGENT";
    clocks.push({
      clock: "REASONING",
      provenance,
      truth: simulated ? "SIMULATED" : "LIVE",
      label: "O-Agent reasoning",
      value: `${input.learning.reasoningOperations} calls · ${input.learning.reasoningTimeMs.toFixed(1)} ms wall${simulated ? " (simulated)" : ""}`,
      ref: { path: "flagship.learning", truth: simulated ? "SIMULATED" : "LIVE", clock: "REASONING" },
    });
  } else if (input.cost) {
    const kind = input.cost.reasoning.kind;
    const simulated = kind === "SIMULATED_O_AGENT";
    clocks.push({
      clock: "REASONING",
      provenance: kind === "SIMULATED_O_AGENT" ? "SIMULATED_O_AGENT" : "LIVE_O_AGENT_MEASUREMENT",
      truth: simulated ? "SIMULATED" : "LIVE",
      label: "O-Agent reasoning",
      value: `${input.cost.reasoning.calls} calls · ${input.cost.reasoning.wallTimeMs.toFixed(1)} ms wall · ${input.cost.reasoning.totalTokens} tokens${simulated ? " (simulated)" : ""}`,
      ref: { path: "cost.reasoning", truth: simulated ? "SIMULATED" : "LIVE", clock: "REASONING" },
    });
  }

  return clocks;
}

/** Precise authority narration; ACTIVATED is resolution-only, never execution. */
export function authorityStatements(
  governance: ManifestGovernance,
  commitOccurred: boolean,
): ExplainerAuthorityDistinction {
  return {
    activated: governance.activated
      ? {
          reached: true,
          statement: "This capability can now participate in deterministic resolution. It does not confer execution authority.",
        }
      : {
          reached: false,
          statement: "This capability was not ACTIVATED in this run.",
        },
    commit: commitOccurred
      ? {
          occurred: true,
          statement: "Commit established authority for this exact consequence.",
        }
      : {
          occurred: false,
          statement: "No Commit authorized a consequence in this run.",
        },
  };
}

// ---- Claim provenance ---------------------------------------------------

export interface ExplainerClaim {
  claimId: string;
  claimType: string;
  fact: string;
  sourceEventIds: string[];
  truth: ExplainerTruthKind;
  clock?: ExplainerClock;
  verified: boolean;
}

/** All evidence paths present in the manifest. */
export function evidenceIndex(manifest: ExplainerManifest): Set<string> {
  return new Set(manifest.evidence.map((entry) => entry.path));
}

/** Evidence path → truth/clock lookup, for provenance-preserving validation. */
export function evidenceMap(manifest: ExplainerManifest): Map<string, ExplainerEvidenceEntry> {
  return new Map(manifest.evidence.map((entry) => [entry.path, entry]));
}

/**
 * A narration claim is admissible only if it is marked verified and every
 * source event id resolves to manifest evidence. Unsupported claims are
 * rejected, never silently allowed.
 */
export function validateClaim(
  claim: ExplainerClaim,
  manifest: ExplainerManifest,
): { ok: boolean; reason?: string } {
  if (!claim.verified) {
    return { ok: false, reason: "Claim is not marked verified." };
  }
  if (claim.sourceEventIds.length === 0) {
    return { ok: false, reason: "Claim has no evidence reference." };
  }
  const index = evidenceIndex(manifest);
  const missing = claim.sourceEventIds.filter((id) => !index.has(id));
  if (missing.length > 0) {
    return { ok: false, reason: `Claim references unsupported evidence: ${missing.join(", ")}.` };
  }
  return { ok: true };
}

/**
 * Deterministic, evidence-grounded claim set. Every claim cites a manifest
 * evidence path; nothing is invented. This is the E2 script foundation.
 */
export function manifestClaims(manifest: ExplainerManifest): ExplainerClaim[] {
  const claims: ExplainerClaim[] = [];
  const next = (() => { let ordinal = 0; return () => ++ordinal; })();

  claims.push({
    claimId: `claim:${next()}`,
    claimType: "JUDGE_REQUEST",
    fact: `The judge asked Xact to ${manifest.judgePrompt.value}`,
    sourceEventIds: [manifest.judgePrompt.ref.path],
    truth: manifest.judgePrompt.ref.truth,
    verified: true,
  });
  claims.push({
    claimId: `claim:${next()}`,
    claimType: "REQUESTED_CAPABILITY",
    fact: `The requested capability was ${manifest.requestedCapability.value}.`,
    sourceEventIds: [manifest.requestedCapability.ref.path],
    truth: manifest.requestedCapability.ref.truth,
    verified: true,
  });

  for (const fact of manifest.resolvedFacts) {
    claims.push({
      claimId: `claim:${next()}`,
      claimType: "RESOLVED",
      fact: `Xact resolved ${fact.key} deterministically.`,
      sourceEventIds: [fact.ref.path],
      truth: fact.ref.truth,
      verified: true,
    });
  }
  for (const item of manifest.unresolvedItems) {
    claims.push({
      claimId: `claim:${next()}`,
      claimType: "UNRESOLVED",
      fact: `${item.key} was unresolved: ${item.reason}`,
      sourceEventIds: [item.ref.path],
      truth: item.ref.truth,
      verified: true,
    });
  }
  for (const constraint of manifest.commitConstraints) {
    claims.push({
      claimId: `claim:${next()}`,
      claimType: "COMMIT_CONSTRAINT",
      fact: `Commit constraint "${constraint.description}" was ${String(constraint.satisfied)}.`,
      sourceEventIds: [constraint.ref.path],
      truth: constraint.ref.truth,
      verified: true,
    });
  }
  for (const event of manifest.commitEvents) {
    claims.push({
      claimId: `claim:${next()}`,
      claimType: "COMMIT",
      fact: event.status === "AUTHORIZED"
        ? "Commit issued an AuthorizationArtifact for this exact consequence."
        : `Commit did not authorize a consequence: ${event.reason}`,
      sourceEventIds: [event.ref.path],
      truth: event.ref.truth,
      verified: true,
    });
  }
  for (const event of manifest.executionEvents) {
    claims.push({
      claimId: `claim:${next()}`,
      claimType: "EXECUTION",
      fact: `Xact executed the authorized effect on the ${event.substrate} substrate.`,
      sourceEventIds: [event.ref.path],
      truth: event.ref.truth,
      verified: true,
    });
  }
  if (manifest.webMcpTools.length > 0) {
    claims.push({
      claimId: `claim:${next()}`,
      claimType: "WEBMCP_TOOLS",
      fact: `Xact exposed ${manifest.webMcpTools.length} WebMCP capability descriptors: ${manifest.webMcpTools.map((tool) => tool.name).join(", ")}.`,
      sourceEventIds: manifest.webMcpTools.map((tool) => tool.ref.path),
      truth: "LIVE",
      verified: true,
    });
  }
  for (const verification of manifest.verificationResults) {
    claims.push({
      claimId: `claim:${next()}`,
      claimType: "VERIFICATION",
      fact: verification.verified ? "The authorized consequence was verified." : `Verification did not pass: ${verification.reason}`,
      sourceEventIds: [verification.ref.path],
      truth: verification.ref.truth,
      verified: true,
    });
  }
  for (const observation of manifest.observations) {
    claims.push({
      claimId: `claim:${next()}`,
      claimType: "OBSERVATION",
      fact: `Xact observed the ${observation.substrate} effect at target ${observation.target}.`,
      sourceEventIds: [observation.ref.path],
      truth: observation.ref.truth,
      verified: true,
    });
  }
  for (const clock of manifest.clocks) {
    claims.push({
      claimId: `claim:${next()}`,
      claimType: "CLOCK",
      fact: `${clock.label}: ${clock.value}`,
      sourceEventIds: [clock.ref.path],
      truth: clock.truth,
      clock: clock.clock,
      verified: true,
    });
  }
  if (manifest.governance.activated) {
    claims.push({
      claimId: `claim:${next()}`,
      claimType: "ACTIVATION",
      fact: manifest.authorityDistinction.activated.statement,
      sourceEventIds: [manifest.governance.ref.path],
      truth: manifest.governance.ref.truth,
      verified: true,
    });
  }
  for (const capability of manifest.governance.refusedCapabilities) {
    claims.push({
      claimId: `claim:${next()}`,
      claimType: "REFUSAL",
      fact: `Xact understood ${capability} but did not establish authority: knowing how is not authority to act.`,
      sourceEventIds: [manifest.governance.ref.path],
      truth: manifest.governance.ref.truth,
      verified: true,
    });
  }
  if (manifest.workProjection) {
    claims.push({
      claimId: `claim:${next()}`,
      claimType: "WORK",
      fact: `Xact executed ${manifest.workProjection.executedConstructionOperations} construction operations and deterministically resolved ${manifest.workProjection.deterministicallyResolvedOperations}; ${manifest.workProjection.reasoningOperations} required reasoning.`,
      sourceEventIds: [manifest.workProjection.ref.path],
      truth: manifest.workProjection.ref.truth,
      clock: manifest.workProjection.ref.clock,
      verified: true,
    });
  }
  if (manifest.reasoningComparison) {
    const comparison = manifest.reasoningComparison;
    claims.push({
      claimId: `claim:${next()}`,
      claimType: "LEARNING_COMPARISON",
      fact: `Reasoning calls went from ${comparison.callsBefore} to ${comparison.callsAfter} (${comparison.callsDeltaPercent.toFixed(1)}%); checksum ${comparison.checksumBefore} → ${comparison.checksumAfter}. ${comparison.note}`,
      sourceEventIds: [comparison.ref.path],
      truth: comparison.ref.truth,
      clock: comparison.ref.clock,
      verified: true,
    });
  }

  return claims;
}
