import {
  recognizeGovernedCapability,
  type CapabilityBoundary,
  type CapabilityKind,
  type GovernedCapabilityDescriptor,
} from "./capability-vocabulary";

/**
 * WebMCP tool composer — Xact Foundry's deterministic compiler front end
 * (ADR 0016).
 *
 * Composes a governed capability descriptor into a WebMCP tool DEFINITION:
 * name, description, input/output schemas, the governed boundaries, and an
 * error contract. The definition is descriptive and inert — it has NO execute
 * handler and grants no authority. The tool's consequence handler is bound
 * later, only through the Commit-gated adapter.
 *
 * Invariant: composing a tool never authorizes using it. `requiresCommit` on a
 * MUTATION tool is a boundary flag, not a grant.
 */

export type ToolSchemaType = "string" | "number" | "boolean";

export interface ToolSchemaProperty {
  type: ToolSchemaType;
  description: string;
}

export interface ToolSchema {
  type: "object";
  properties: Readonly<Record<string, ToolSchemaProperty>>;
  required: readonly string[];
}

export interface ToolErrorContract {
  kind: "TOOL_ERROR_CONTRACT";
  errors: Readonly<Record<string, string>>;
}

export interface WebMCPToolDefinition {
  kind: "WEBMCP_TOOL_DEFINITION";
  name: string;
  description: string;
  capabilityKind: CapabilityKind;
  inputSchema: ToolSchema;
  outputSchema: ToolSchema;
  boundaries: readonly CapabilityBoundary[];
  errorContract: ToolErrorContract;
  requiresCommit: boolean;
  // Deliberately no `execute`: the definition is descriptive only.
}

const READ_ERRORS: Record<string, string> = {
  UNAVAILABLE: "The read capability is unavailable.",
  UNAUTHORIZED: "The read capability requires a valid session.",
};

const MUTATION_ERRORS: Record<string, string> = {
  UNAUTHORIZED: "The consequence requires a fresh Commit authorization.",
  STALE: "State changed after Commit; fresh resolution is required.",
  REPLAYED: "The authorization nonce was already consumed.",
  BOUND: "The effect does not match the authorized fingerprint.",
};

function stringSchema(fields: readonly string[], descriptionFor: (field: string) => string): ToolSchema {
  const properties: Record<string, ToolSchemaProperty> = {};
  for (const field of fields) {
    properties[field] = { type: "string", description: descriptionFor(field) };
  }
  return {
    type: "object",
    properties,
    required: [...fields],
  };
}

function mutationOutputSchema(resolves: readonly string[]): ToolSchema {
  const properties: Record<string, ToolSchemaProperty> = {
    receipt: { type: "string", description: "Execution receipt for the committed effect." },
    effectFingerprint: { type: "string", description: "Fingerprint of the authorized effect." },
  };
  for (const field of resolves) {
    properties[field] = { type: "string", description: `Resolved value for ${field}.` };
  }
  return {
    type: "object",
    properties,
    required: ["receipt", "effectFingerprint", ...resolves],
  };
}

/**
 * Deterministically compose a governed capability into a WebMCP tool
 * definition. Rejects a descriptor that fails recognition. The returned
 * definition carries no execute surface — composing it grants no authority.
 */
export function composeWebMCPTool(descriptor: GovernedCapabilityDescriptor): WebMCPToolDefinition {
  const recognition = recognizeGovernedCapability(descriptor);
  if (!recognition.recognized) {
    throw new Error(`Cannot compose a tool from an unrecognized descriptor: ${recognition.checks.join(" ")}`);
  }

  const inputSchema = stringSchema(descriptor.inputs, (field) => `Input parameter ${field}.`);
  const outputSchema = descriptor.capabilityKind === "READ"
    ? stringSchema(descriptor.resolves, (field) => `Resolved value for ${field}.`)
    : mutationOutputSchema(descriptor.resolves);

  const errorContract: ToolErrorContract = {
    kind: "TOOL_ERROR_CONTRACT",
    errors: descriptor.capabilityKind === "READ" ? { ...READ_ERRORS } : { ...MUTATION_ERRORS },
  };

  return Object.freeze({
    kind: "WEBMCP_TOOL_DEFINITION" as const,
    name: descriptor.id,
    description: descriptor.label,
    capabilityKind: descriptor.capabilityKind,
    inputSchema: Object.freeze({ ...inputSchema, properties: Object.freeze(inputSchema.properties), required: Object.freeze(inputSchema.required) }),
    outputSchema: Object.freeze({ ...outputSchema, properties: Object.freeze(outputSchema.properties), required: Object.freeze(outputSchema.required) }),
    boundaries: Object.freeze([...descriptor.boundaries]),
    errorContract: Object.freeze({ ...errorContract, errors: Object.freeze(errorContract.errors) }),
    requiresCommit: descriptor.capabilityKind === "MUTATION",
  });
}
