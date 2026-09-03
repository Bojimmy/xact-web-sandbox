import { FOUNDRY_CATALOG, type FoundryCatalogEntry } from "../flagship/foundry-catalog";
import { decomposeIntent, XactFoundryLiaison, type FoundryActivity } from "../flagship/foundry-liaison";
import type { WebMCPToolDefinition } from "../flagship/webmcp-tool-builder";
import type { OAgentProvider } from "../telemetry/o-agent-provider";
import {
  resolveCapabilityIntent,
  type CandidateBuildBrief,
  type CapabilityCandidate,
} from "./capability-resolution";
import {
  constructChatGPTCapability,
  normalizeValues,
  summarizeBuiltCapability,
} from "./xact-foundry-tools";
import {
  validateComposition,
  summarizeComposedTool,
  type CapabilityComposition,
} from "./capability-composition";

/**
 * The ChatGPT Boss loop (the three-tool WebMCP interface).
 *
 * ChatGPT itself is the O-Agent: Xact decomposes intent and returns any genuine
 * semantic U; ChatGPT interprets (asking the user when necessary), then submits
 * a structured resolution that re-enters Xact for normal construction.
 *
 * This module never invokes an internal LLM. The loop is literally:
 *
 *   ChatGPT reasoning → WebMCP → Xact
 */

export interface BossRequest {
  id: string;
  question: string;
  context: Record<string, unknown>;
  allowedValues?: string[];
}

/** The structured resolution ChatGPT submits for one unresolved item. */
export interface BossResolutionValue {
  /** The governed capability to satisfy the request (required when the original intent was unrecognized). */
  capabilityId?: string;
  /** Optional field values for the selected capability. */
  bounds?: Record<string, string>;
  /** Optional: the Boss's attested semantic interpretation for a genuine-U requirement. */
  interpretation?: string;
  /** Optional: a structured composition proposal (Xact classifies it, never the Boss). */
  composition?: CapabilityComposition;
}

export interface BossResolutionInput {
  unresolvedId: string;
  resolution: BossResolutionValue;
}

export type StartBuildStatus = "BUILT" | "WAITING_FOR_BOSS" | "CLARIFICATION_REQUIRED" | "BLOCKED";
export type SubmitResolutionStatus = "MORE_REASONING_REQUIRED" | "READY" | "BLOCKED" | "BUILT";

export interface StartBuildResult {
  runId: string;
  status: StartBuildStatus;
  unresolved?: BossRequest[];
  result?: unknown;
  clarification?: { question: string; candidates: readonly CapabilityCandidate[] };
  reason?: string;
  candidateBuildBrief?: CandidateBuildBrief;
}

export interface GetBossRequestResult {
  runId: string;
  userIntent: string;
  resolvedContext: Record<string, unknown>;
  unresolved: BossRequest[];
  selectionCandidates?: readonly CapabilityCandidate[];
}

export interface SubmitResolutionResult {
  runId: string;
  status: SubmitResolutionStatus;
  unresolved?: BossRequest[];
  result?: unknown;
}

export interface BossSession {
  runId: string;
  intent: string;
  recognized: boolean;
  patternId?: string;
  unresolved: BossRequest[];
  selectionCandidates?: readonly CapabilityCandidate[];
  built?: unknown;
}

export interface BossSessionStore {
  get(runId: string): Promise<BossSession | undefined>;
  set(session: BossSession): Promise<void>;
}

class InMemoryBossSessionStore implements BossSessionStore {
  private readonly sessions = new Map<string, BossSession>();

  async get(runId: string): Promise<BossSession | undefined> {
    return this.sessions.get(runId);
  }

  async set(session: BossSession): Promise<void> {
    this.sessions.set(session.runId, session);
  }
}

const defaultSessionStore = new InMemoryBossSessionStore();

export function createInMemoryBossSessionStore(): BossSessionStore {
  return new InMemoryBossSessionStore();
}

function newRunId(): string {
  return `xact-run-${crypto.randomUUID()}`;
}

/** Never invoked: ChatGPT is the O-Agent, so an internal LLM must never fire. */
const NO_INTERNAL_LLM: OAgentProvider = {
  telemetryKind: "LIVE_SANDBOX_MEASUREMENT",
  providerName: "ChatGPT Boss (no internal LLM)",
  async reason() {
    throw new Error("The Boss loop never invokes an internal LLM; ChatGPT is the O-Agent.");
  },
};

function slugify(value: string, index: number): string {
  const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return `u-${index}-${slug || "requirement"}`;
}

function unresolvedFor(genuineU: readonly string[], capabilityId: string, intent: string): BossRequest[] {
  return genuineU.map((u, index) => ({
    id: slugify(u, index),
    question: `Resolve this semantic requirement: "${u}".`,
    context: { capabilityId, intent: intent.slice(0, 240) },
  }));
}

function definitionOf(tool: WebMCPToolDefinition) {
  return {
    name: tool.name,
    description: tool.description,
    capabilityKind: tool.capabilityKind,
    inputSchema: tool.inputSchema,
    outputSchema: tool.outputSchema,
    boundaries: tool.boundaries,
    requiresCommit: tool.requiresCommit,
  };
}

function entryFor(capabilityId: string): FoundryCatalogEntry | undefined {
  return FOUNDRY_CATALOG.find((candidate) => candidate.id === capabilityId);
}

function buildIntentFor(entry: FoundryCatalogEntry, bounds: Readonly<Record<string, string>> = {}): string {
  return entry.buildIntent(normalizeValues(entry, bounds));
}

async function constructDeterministic(
  runId: string,
  intent: string,
  capabilityId: string,
  sessionStore: BossSessionStore,
): Promise<StartBuildResult> {
  try {
    const built = await constructChatGPTCapability(capabilityId, {});
    await sessionStore.set({ runId, intent, recognized: true, patternId: capabilityId, unresolved: [], built });
    return { runId, status: "BUILT", result: built };
  } catch {
    return {
      runId,
      status: "BLOCKED",
      reason: "The selected governed capability could not be constructed under its current public-safe contract.",
    };
  }
}

/**
 * `start_capability_build` — decompose the user's request deterministically.
 * Any genuinely unresolved semantic requirement becomes a BossRequest.
 */
export async function startCapabilityBuild(
  intent: string,
  sessionStore: BossSessionStore = defaultSessionStore,
): Promise<StartBuildResult> {
  const decomposition = decomposeIntent(intent);
  const runId = newRunId();

  if (decomposition.pattern?.blocked) {
    await sessionStore.set({ runId, intent, recognized: true, patternId: decomposition.pattern.id, unresolved: [] });
    return { runId, status: "BLOCKED" };
  }

  if (!decomposition.pattern) {
    const resolution = resolveCapabilityIntent(intent);
    if (resolution.outcome === "UNAVAILABLE") {
      return {
        runId,
        status: "BLOCKED",
        reason: resolution.reason,
        candidateBuildBrief: resolution.candidateBuildBrief,
      };
    }

    if (resolution.outcome === "CLARIFY") {
      const unresolved: BossRequest[] = [{
        id: "select-capability",
        question: resolution.question,
        context: { intent: intent.slice(0, 240), selectionOnly: true },
        allowedValues: resolution.candidates.map((candidate) => candidate.id),
      }];
      await sessionStore.set({ runId, intent, recognized: false, unresolved, selectionCandidates: resolution.candidates });
      return { runId, status: "CLARIFICATION_REQUIRED", unresolved, clarification: { question: resolution.question, candidates: resolution.candidates } };
    }

    const entry = entryFor(resolution.candidate.id)!;
    const resolvedIntent = buildIntentFor(entry);
    const genuineU = decomposeIntent(resolvedIntent).pattern?.genuineU ?? [];
    if (genuineU.length > 0) {
      const unresolved = unresolvedFor(genuineU, entry.id, intent);
      await sessionStore.set({ runId, intent, recognized: true, patternId: entry.id, unresolved });
      return { runId, status: "WAITING_FOR_BOSS", unresolved };
    }
    return constructDeterministic(runId, intent, entry.id, sessionStore);
  }

  const genuineU = decomposition.pattern.genuineU;
  if (genuineU.length > 0) {
    const unresolved = unresolvedFor(genuineU, decomposition.pattern.id, intent);
    await sessionStore.set({ runId, intent, recognized: true, patternId: decomposition.pattern.id, unresolved });
    return { runId, status: "WAITING_FOR_BOSS", unresolved };
  }

  // Fully deterministic — Xact constructs now; no Boss reasoning required.
  const built = await constructChatGPTCapability(decomposition.pattern.id, {});
  await sessionStore.set({ runId, intent, recognized: true, patternId: decomposition.pattern.id, unresolved: [], built });
  return { runId, status: "BUILT", result: built };
}

/** `get_boss_request` — the exact unresolved information ChatGPT needs to reason as the Boss. */
export async function getBossRequest(
  runId: string,
  sessionStore: BossSessionStore = defaultSessionStore,
): Promise<GetBossRequestResult> {
  const session = await sessionStore.get(runId);
  if (!session) throw new Error(`Unknown run "${runId}".`);
  return {
    runId,
    userIntent: session.intent,
    resolvedContext: {
      recognized: session.recognized,
      patternId: session.patternId ?? null,
      built: session.built !== undefined,
    },
    unresolved: session.unresolved,
    selectionCandidates: session.selectionCandidates,
  };
}

function boundsFrom(resolutions: readonly BossResolutionInput[]): Record<string, string> {
  const bounds: Record<string, string> = {};
  for (const { resolution } of resolutions) {
    for (const [key, value] of Object.entries(resolution.bounds ?? {})) bounds[key] = value;
  }
  return bounds;
}

function interpretationsFrom(resolutions: readonly BossResolutionInput[]): string[] {
  return resolutions
    .map(({ resolution }) => resolution.interpretation)
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0);
}

/**
 * `submit_boss_resolution` — feed ChatGPT's interpretation into the Xact
 * re-entry path and continue normal construction. No internal LLM is invoked.
 */
export async function submitBossResolution(
  runId: string,
  resolutions: readonly BossResolutionInput[],
  sessionStore: BossSessionStore = defaultSessionStore,
): Promise<SubmitResolutionResult> {
  const session = await sessionStore.get(runId);
  if (!session) throw new Error(`Unknown run "${runId}".`);

  if (session.built !== undefined) {
    return { runId, status: "BUILT", result: session.built };
  }

  const byId = new Map(resolutions.map((r) => [r.unresolvedId, r.resolution]));
  const remaining = session.unresolved.filter((u) => !byId.has(u.id));
  if (remaining.length > 0) {
    return { runId, status: "MORE_REASONING_REQUIRED", unresolved: remaining };
  }

  // A structured composition proposal takes priority over capabilityId selection.
  // Xact—not the Boss—classifies it.
  const composition = resolutions.find((r) => r.resolution.composition)?.resolution.composition;
  if (composition) {
    const validation = validateComposition(composition);
    if (validation.outcome === "UNAUTHORIZED") {
      return { runId, status: "BLOCKED" };
    }
    if (validation.outcome === "NOVEL_BOUNDARY") {
      return { runId, status: "BLOCKED" };
    }
    if (validation.outcome === "NEEDS_RESOLUTION") {
      return {
        runId,
        status: "MORE_REASONING_REQUIRED",
        unresolved: [{ id: "composition-operation", question: validation.question, context: {} }],
      };
    }
    if (validation.outcome === "ALREADY_GOVERNED") {
      const built = await constructChatGPTCapability(validation.capabilityId, {});
      session.built = built;
      await sessionStore.set(session);
      return { runId, status: "BUILT", result: built };
    }
    const liaison = new XactFoundryLiaison(NO_INTERNAL_LLM);
    const build = await liaison.buildFromDescriptor(validation.descriptor);
    if (build.outcome !== "COMPOSED_DEFINITION" || !build.tool) {
      return { runId, status: "BLOCKED" };
    }
    const result = {
      status: "COMPOSED_DEFINITION" as const,
      capabilityId: build.tool.name,
      definition: definitionOf(build.tool),
      activity: build.activity,
      summary: summarizeComposedTool(build.tool),
    };
    session.built = result;
    await sessionStore.set(session);
    return { runId, status: "BUILT", result };
  }

  // Determine the governed capability to satisfy the request.
  const proposed = resolutions.find((r) => r.resolution.capabilityId)?.resolution.capabilityId;
  const capabilityId = session.patternId ?? proposed;
  if (!capabilityId) return { runId, status: "BLOCKED" };

  const entry = capabilityId ? entryFor(capabilityId) : undefined;
  if (!entry) return { runId, status: "BLOCKED" };

  if (!session.patternId && session.selectionCandidates && !session.selectionCandidates.some((candidate) => candidate.id === capabilityId)) {
    return { runId, status: "BLOCKED" };
  }

  const bounds = boundsFrom(resolutions);
  const intent = entry.buildIntent(normalizeValues(entry, bounds));
  const genuineU = decomposeIntent(intent).pattern?.genuineU ?? [];

  if (genuineU.length > 0) {
    const interpretations = interpretationsFrom(resolutions);
    if (interpretations.length === 0) {
      const unresolved = unresolvedFor(genuineU, capabilityId, intent);
      session.unresolved = unresolved;
      session.patternId = capabilityId;
      await sessionStore.set(session);
      return { runId, status: "MORE_REASONING_REQUIRED", unresolved };
    }

    // Re-enter Xact with the Boss's attested interpretation.
    const liaison = new XactFoundryLiaison(NO_INTERNAL_LLM);
    const build = await liaison.buildCapabilityWithReasoning(intent, {
      unresolved: [...genuineU],
      claims: interpretations,
      provider: "ChatGPT Boss",
    });
    if (build.outcome !== "COMPOSED_DEFINITION" || !build.tool) {
      return { runId, status: "BLOCKED" };
    }
    const result = {
      status: "COMPOSED_DEFINITION" as const,
      capabilityId,
      definition: definitionOf(build.tool),
      activity: build.activity,
      guarantee: build.tool.requiresCommit
        ? "Xact composed an inert governed mutation-tool definition. It has no execute handler; every future consequence still requires a separate fresh Commit."
        : "Xact composed an inert governed tool definition. It has no execute handler and no authority over external systems.",
      summary: summarizeBuiltCapability(entry, build.tool),
    };
    session.built = result;
    await sessionStore.set(session);
    return { runId, status: "BUILT", result };
  }

  // Deterministic re-entry — construct the governed recipe directly.
  try {
    const built = await constructChatGPTCapability(capabilityId, bounds);
    session.built = built;
    await sessionStore.set(session);
    return { runId, status: "BUILT", result: built };
  } catch {
    return { runId, status: "BLOCKED" };
  }
}
