import { FOUNDRY_CATALOG, type FoundryCatalogEntry } from "../flagship/foundry-catalog";
import { decomposeIntent, XactFoundryLiaison, type FoundryActivity } from "../flagship/foundry-liaison";
import type { OAgentProvider } from "../telemetry/o-agent-provider";
import type { WebMCPToolDefinition } from "../flagship/webmcp-tool-builder";
import { readAbsorbedFoundryTool } from "../flagship/foundry-read-substrate";
import type { BusinessWorkspaceResult } from "../flagship/business-workspace";

/**
 * Public-safe operations exposed to ChatGPT through the Xact MCP server.
 *
 * ChatGPT is the conversational Boss: it can interpret a judge's request and
 * select an approved recipe. Xact remains the construction authority. This
 * bridge deliberately exposes READ recipes only. It can construct an inert
 * WebMCP definition but has no execution or mutation surface.
 */

export interface ChatGPTCapabilitySummary {
  readonly id: string;
  readonly title: string;
  readonly kind: FoundryCatalogEntry["kind"];
  readonly description: string;
  readonly substrate: string;
  readonly fields: readonly { key: string; label: string; hint: string }[];
  readonly semanticReviewRequired: boolean;
}

/** The three-part self-explanatory build summary: answer, boundary, next step. */
export interface BuiltCapabilitySummary {
  readonly builtAndValidated: string;
  readonly currentBoundary: string;
  readonly nextRequiredCapability: string;
}

export interface ChatGPTConstructionResult {
  readonly status: "COMPOSED_DEFINITION";
  readonly capabilityId: string;
  readonly definition: Pick<WebMCPToolDefinition, "name" | "description" | "capabilityKind" | "inputSchema" | "outputSchema" | "boundaries" | "requiresCommit">;
  readonly activity: readonly FoundryActivity[];
  readonly guarantee: string;
  readonly summary: BuiltCapabilitySummary;
}

const REASONING_MUST_NOT_RUN: OAgentProvider = {
  telemetryKind: "LIVE_SANDBOX_MEASUREMENT",
  providerName: "Not used by ChatGPT MCP construction",
  async reason() {
    throw new Error("This MCP bridge accepts only deterministic READ recipes; reasoning is owned by ChatGPT before it calls Xact.");
  },
};

function toSummary(entry: FoundryCatalogEntry): ChatGPTCapabilitySummary {
  const defaults = Object.fromEntries(entry.fields.map((field) => [field.key, field.defaultValue]));
  const semanticReviewRequired = (decomposeIntent(entry.buildIntent(defaults)).pattern?.genuineU.length ?? 0) > 0;
  return {
    id: entry.id,
    title: entry.title,
    kind: entry.kind,
    description: entry.description,
    substrate: entry.substrate,
    fields: entry.fields.map(({ key, label, hint }) => ({ key, label, hint })),
    semanticReviewRequired,
  };
}

/** Lists every public-safe recipe Xact Foundry knows how to compose. */
export function listChatGPTCapabilities(query = ""): ChatGPTCapabilitySummary[] {
  const normalized = query.trim().toLowerCase();
  return FOUNDRY_CATALOG
    .filter((entry) => !normalized || [entry.id, entry.title, entry.description, entry.substrate]
      .join(" ").toLowerCase().includes(normalized))
    .map(toSummary);
}

export function normalizeValues(entry: FoundryCatalogEntry, raw: Readonly<Record<string, string>>): Record<string, string> {
  const allowed = new Set(entry.fields.map((field) => field.key));
  for (const [key, value] of Object.entries(raw)) {
    if (!allowed.has(key)) throw new Error(`Unknown bound "${key}" for ${entry.id}.`);
    if (typeof value !== "string" || value.trim().length === 0 || value.length > 120) {
      throw new Error(`Bound "${key}" must be a non-empty string of at most 120 characters.`);
    }
  }

  const values: Record<string, string> = {};
  for (const field of entry.fields) values[field.key] = raw[field.key]?.trim() || field.defaultValue;
  return values;
}

function humanizeField(field: string): string {
  return field.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
}

function outputsPhrase(tool: WebMCPToolDefinition): string {
  const outputs = tool.outputSchema.required.map(humanizeField);
  if (outputs.length === 0) return "with no declared outputs";
  if (outputs.length === 1) return `with one output: ${outputs[0]}`;
  return `with ${outputs.length} outputs: ${outputs.join(", ")}`;
}

/**
 * Produce the three-part build summary so a successful build states, in one
 * result, what was created, what it is not, and what the next capability is.
 */
export function summarizeBuiltCapability(entry: FoundryCatalogEntry, tool: WebMCPToolDefinition): BuiltCapabilitySummary {
  const name = tool.name;
  const phrase = outputsPhrase(tool);

  if (entry.kind === "MUTATION") {
    return {
      builtAndValidated: `Xact created the governed mutation \`${name}\` contract ${phrase}.`,
      currentBoundary: "This is a contract-only definition. No consequence was authorized; every future use requires a fresh Xact Commit.",
      nextRequiredCapability: "Bind an executable mutation handler through fresh Resolve → Commit → exact dispatch. Confirmation and audit remain separate Commit-time boundaries.",
    };
  }

  if (entry.kind === "DRAFT_ONLY") {
    return {
      builtAndValidated: `Xact created the governed, draft-only \`${name}\` contract ${phrase}.`,
      currentBoundary: "This is a contract-only draft definition. No draft was materialized, and nothing was sent or scheduled.",
      nextRequiredCapability: "Add a separate delivery capability with its own Commit. Sending and scheduling are distinct future capabilities.",
    };
  }

  const runtimeReadAvailable = Boolean(readAbsorbedFoundryTool(entry.id, {}));
  return {
    builtAndValidated: `Xact created the governed, read-only \`${name}\` contract ${phrase}.`,
    currentBoundary: runtimeReadAvailable
      ? "Construction produced an inert definition; it does not read data by itself. The approved runtime read is separate and remains read-only."
      : "This is a contract-only definition. No data was read, freshness was not verified, and no scheduled updates or notifications exist.",
    nextRequiredCapability: runtimeReadAvailable
      ? `Call \`read_xact_capability\` with \`${entry.id}\` for an on-demand read from the approved ${entry.substrate}. Scheduling and notifications are separate future capabilities.`
      : `Add an executable read handler bound to the approved ${entry.substrate}. Scheduling and notifications are separate future capabilities.`,
  };
}

/** The runtime read result: real current data, read-only, with its schema. */
export interface ChatGPTCapabilityReadResult {
  readonly capabilityId: string;
  readonly kind: "READ_RESULT";
  readonly readOnly: true;
  readonly readAtEpochMs: number;
  readonly boundary: string;
  readonly schema: {
    readonly type: "object";
    readonly properties: {
      readonly kind: string;
      readonly title: string;
      readonly source: string;
      readonly summary: string;
      readonly columns: string;
      readonly rows: string;
    };
  };
  readonly data: BusinessWorkspaceResult;
}

/**
 * `read_xact_capability` — the runtime retrieval seam, separate from construction.
 * It reads the approved public-safe substrate on demand. It never constructs,
 * never reasons, never mutates, and never commits.
 */
export function readChatGPTCapability(
  capabilityId: string,
  input: Readonly<Record<string, string>> = {},
  now: () => number = Date.now,
): ChatGPTCapabilityReadResult {
  const entry = FOUNDRY_CATALOG.find((candidate) => candidate.id === capabilityId);
  if (!entry) throw new Error(`Unknown approved Xact capability "${capabilityId}".`);
  if (entry.kind !== "READ") {
    throw new Error(`"${capabilityId}" is ${entry.kind}; only READ capabilities expose an on-demand runtime read.`);
  }
  const data = readAbsorbedFoundryTool(capabilityId, input);
  if (!data) throw new Error(`"${capabilityId}" has no approved runtime read substrate.`);
  return {
    capabilityId,
    kind: "READ_RESULT",
    readOnly: true,
    readAtEpochMs: now(),
    boundary: "On-demand read of the public-safe business workspace. No external action, no mutation, no polling, and no scheduled updates.",
    schema: {
      type: "object",
      properties: {
        kind: "string",
        title: "string",
        source: "string",
        summary: "array of {label, value, detail}",
        columns: "array of string",
        rows: "array of object",
      },
    },
    data,
  };
}

/**
 * Build a known deterministic recipe with real Foundry construction. The resulting
 * definition is intentionally inert: it contains no execute handler and
 * grants no authority over any external system.
 */
export async function constructChatGPTCapability(
  capabilityId: string,
  rawValues: Readonly<Record<string, string>> = {},
): Promise<ChatGPTConstructionResult> {
  const entry = FOUNDRY_CATALOG.find((candidate) => candidate.id === capabilityId);
  if (!entry) throw new Error(`Unknown approved Xact capability "${capabilityId}". List the catalog before construction.`);
  const values = normalizeValues(entry, rawValues);
  const intent = entry.buildIntent(values);
  const decomposition = decomposeIntent(intent);
  if ((decomposition.pattern?.genuineU.length ?? 0) > 0) {
    throw new Error(`${capabilityId} needs semantic review before construction. ChatGPT can reason about it, but this public bridge does not yet carry an attested semantic proposal into Xact.`);
  }

  const liaison = new XactFoundryLiaison(REASONING_MUST_NOT_RUN);
  const result = await liaison.buildCapability(intent);
  if (result.outcome !== "COMPOSED_DEFINITION" || !result.tool || !result.descriptor) {
    throw new Error(`Xact did not compose ${capabilityId}; outcome was ${result.outcome}.`);
  }
  if ("execute" in result.tool) throw new Error(`Xact refused an unsafe ChatGPT bridge contract for ${capabilityId}.`);

  return {
    status: "COMPOSED_DEFINITION",
    capabilityId,
    definition: {
      name: result.tool.name,
      description: result.tool.description,
      capabilityKind: result.tool.capabilityKind,
      inputSchema: result.tool.inputSchema,
      outputSchema: result.tool.outputSchema,
      boundaries: result.tool.boundaries,
      requiresCommit: result.tool.requiresCommit,
    },
    activity: result.activity,
    guarantee: result.tool.requiresCommit
      ? "Xact composed an inert governed mutation-tool definition. It has no execute handler; every future consequence still requires a separate fresh Commit."
      : "Xact composed an inert governed tool definition. It has no execute handler and no authority over external systems.",
    summary: summarizeBuiltCapability(entry, result.tool),
  };
}
