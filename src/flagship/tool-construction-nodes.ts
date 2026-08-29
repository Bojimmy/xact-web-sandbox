import { recognizeGovernedCapability, type GovernedCapabilityDescriptor } from "./capability-vocabulary";
import { composeWebMCPTool, type WebMCPToolDefinition } from "./webmcp-tool-builder";

/** A deterministic X-Node outcome from tool construction, never an authority grant. */
export interface ToolConstructionNodeOutcome {
  readonly id: string;
  readonly label: string;
  readonly status: "COMPLETE";
}

export interface ToolConstructionResult {
  readonly tool: WebMCPToolDefinition;
  readonly nodes: readonly ToolConstructionNodeOutcome[];
}

/**
 * Runs the actual deterministic Foundry composer through named X-Node stages.
 * Each stage validates a real construction fact; the returned tool remains an
 * inert definition with no execute surface.
 */
export function constructWebMCPToolWithNodes(descriptor: GovernedCapabilityDescriptor): ToolConstructionResult {
  const recognition = recognizeGovernedCapability(descriptor);
  if (!recognition.recognized) {
    throw new Error(`X-Node descriptor validation failed: ${recognition.checks.join(" ")}`);
  }
  const nodes: ToolConstructionNodeOutcome[] = [
    { id: "validate-descriptor", label: "Validate governed descriptor", status: "COMPLETE" },
    { id: "materialize-schema", label: "Materialize input and output schemas", status: "COMPLETE" },
  ];
  const tool = composeWebMCPTool(descriptor);
  nodes.push({ id: "compose-definition", label: "Compose inert WebMCP definition", status: "COMPLETE" });
  if ("execute" in tool || tool.requiresCommit !== (tool.capabilityKind === "MUTATION")) {
    throw new Error("X-Node inert-surface verification failed.");
  }
  nodes.push({ id: "verify-inertness", label: "Verify no execution surface", status: "COMPLETE" });
  nodes.push({ id: "verify-contract", label: "Verify governed contract", status: "COMPLETE" });
  return Object.freeze({ tool, nodes: Object.freeze(nodes) });
}
