import { FOUNDRY_CATALOG, type FoundryCatalogEntry } from "../flagship/foundry-catalog";
import { XactFoundryLiaison, type FoundryActivity } from "../flagship/foundry-liaison";
import type { OAgentProvider } from "../telemetry/o-agent-provider";
import type { WebMCPToolDefinition } from "../flagship/webmcp-tool-builder";

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
  readonly description: string;
  readonly substrate: string;
  readonly fields: readonly { key: string; label: string; hint: string }[];
}

export interface ChatGPTConstructionResult {
  readonly status: "COMPOSED_DEFINITION";
  readonly capabilityId: string;
  readonly definition: Pick<WebMCPToolDefinition, "name" | "description" | "capabilityKind" | "inputSchema" | "outputSchema" | "boundaries" | "requiresCommit">;
  readonly activity: readonly FoundryActivity[];
  readonly guarantee: string;
}

const REASONING_MUST_NOT_RUN: OAgentProvider = {
  telemetryKind: "LIVE_SANDBOX_MEASUREMENT",
  providerName: "Not used by ChatGPT MCP construction",
  async reason() {
    throw new Error("This MCP bridge accepts only deterministic READ recipes; reasoning is owned by ChatGPT before it calls Xact.");
  },
};

function toSummary(entry: FoundryCatalogEntry): ChatGPTCapabilitySummary {
  return {
    id: entry.id,
    title: entry.title,
    description: entry.description,
    substrate: entry.substrate,
    fields: entry.fields.map(({ key, label, hint }) => ({ key, label, hint })),
  };
}

/** Lists only public-safe, deterministic READ recipes for the first MCP slice. */
export function listChatGPTCapabilities(query = ""): ChatGPTCapabilitySummary[] {
  const normalized = query.trim().toLowerCase();
  return FOUNDRY_CATALOG
    .filter((entry) => entry.kind === "READ")
    .filter((entry) => !normalized || [entry.id, entry.title, entry.description, entry.substrate]
      .join(" ").toLowerCase().includes(normalized))
    .map(toSummary);
}

function normalizeValues(entry: FoundryCatalogEntry, raw: Readonly<Record<string, string>>): Record<string, string> {
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

/**
 * Build a known READ recipe with real Foundry construction. The resulting
 * definition is intentionally inert: it contains no execute handler and
 * grants no authority over any external system.
 */
export async function constructChatGPTReadCapability(
  capabilityId: string,
  rawValues: Readonly<Record<string, string>> = {},
): Promise<ChatGPTConstructionResult> {
  const entry = FOUNDRY_CATALOG.find((candidate) => candidate.id === capabilityId);
  if (!entry) throw new Error(`Unknown approved Xact capability "${capabilityId}". List the catalog before construction.`);
  if (entry.kind !== "READ") {
    throw new Error(`${capabilityId} is not available through the public ChatGPT bridge. Mutation and draft capabilities remain inside the Foundry UI.`);
  }

  const liaison = new XactFoundryLiaison(REASONING_MUST_NOT_RUN);
  const result = await liaison.buildCapability(entry.buildIntent(normalizeValues(entry, rawValues)));
  if (result.outcome !== "COMPOSED_DEFINITION" || !result.tool || !result.descriptor) {
    throw new Error(`Xact did not compose ${capabilityId}; outcome was ${result.outcome}.`);
  }
  if (result.tool.capabilityKind !== "READ" || result.tool.requiresCommit) {
    throw new Error(`Xact refused an unsafe ChatGPT bridge contract for ${capabilityId}.`);
  }

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
    guarantee: "Xact composed an inert READ tool definition. It has no execute handler and no authority over external systems.",
  };
}
