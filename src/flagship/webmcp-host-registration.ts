import type { WebMCPToolDefinition } from "./webmcp-tool-builder";
import { stableFingerprint } from "../xact/authorization-artifact";

/**
 * The real WebMCP host registration path (ADR 0019).
 *
 * BUILD composes an inert definition; this module completes the loop by putting
 * that contract into a live browser host:
 *
 *   REGISTER → OBSERVE → VERIFY
 *
 * REGISTER calls the browser's `modelContext.registerTool`. OBSERVE confirms the
 * tool is present via `getTools`. VERIFY checks the registered contract matches
 * the composed artifact. Only after all three is the tool `WORKING_TOOL`.
 *
 * The `execute` handler is injected by the caller: for a MUTATION tool it must
 * be Commit-gated (a fresh AuthorizationArtifact required before any effect),
 * and for a READ tool it is a deterministic read. This module never supplies
 * authority — it only registers a contract.
 */

export interface FoundryWebMCPTool {
  name?: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export interface FoundryWebMCPObservedTool {
  name?: string;
  description?: string;
  /** Hosts may return a JSON-schema object or its serialized JSON text. */
  inputSchema?: unknown;
}

export interface FoundryWebMCPHost {
  registerTool?(tool: FoundryWebMCPTool & { execute(input: unknown): Promise<unknown> }, options?: { signal?: AbortSignal }): Promise<unknown>;
  getTools(): Promise<FoundryWebMCPObservedTool[]>;
}

export interface RegistrationEvent {
  type: "REGISTER" | "OBSERVE" | "VERIFY";
  label: string;
  detail: string;
  status: "PASS" | "BLOCK" | "PENDING";
}

export interface RegistrationResult {
  outcome: "WORKING_TOOL" | "FAILED";
  events: RegistrationEvent[];
  toolName: string;
}

function composedSchema(tool: WebMCPToolDefinition): Record<string, unknown> {
  return {
    type: "object",
    properties: { ...tool.inputSchema.properties },
    required: [...tool.inputSchema.required],
  };
}

function readObservedSchema(value: unknown): Record<string, unknown> | undefined {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value !== "string") return undefined;
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : undefined;
  } catch {
    return undefined;
  }
}

export class FoundryWebMCPRegistrationHost {
  async registerTool(
    tool: WebMCPToolDefinition,
    host: FoundryWebMCPHost,
    execute: (input: unknown) => Promise<unknown>,
    onEvent?: (event: RegistrationEvent) => void,
  ): Promise<RegistrationResult> {
    const events: RegistrationEvent[] = [];
    const emit = (event: RegistrationEvent) => { events.push(event); onEvent?.(event); };

    // REGISTER
    if (typeof host.registerTool !== "function") {
      emit({ type: "REGISTER", label: "Register", detail: "WebMCP modelContext is unavailable — cannot register.", status: "BLOCK" });
      return { outcome: "FAILED", events, toolName: tool.name };
    }
    try {
      await host.registerTool({
        name: tool.name,
        description: tool.description,
        inputSchema: composedSchema(tool),
        execute,
      });
      emit({ type: "REGISTER", label: "Register", detail: `Registered "${tool.name}" into the WebMCP host.`, status: "PASS" });
    } catch (cause) {
      emit({ type: "REGISTER", label: "Register", detail: cause instanceof Error ? cause.message : "Registration failed.", status: "BLOCK" });
      return { outcome: "FAILED", events, toolName: tool.name };
    }

    // OBSERVE
    const tools = await host.getTools();
    const registered = tools.find((candidate) => candidate.name === tool.name);
    if (!registered) {
      emit({ type: "OBSERVE", label: "Observe", detail: `"${tool.name}" is not available in the host.`, status: "BLOCK" });
      return { outcome: "FAILED", events, toolName: tool.name };
    }
    emit({ type: "OBSERVE", label: "Observe", detail: `"${tool.name}" is available in the WebMCP host.`, status: "PASS" });

    // VERIFY — the registered contract matches the composed artifact.
    const nameMatches = registered.name === tool.name;
    const descriptionMatches = registered.description === tool.description;
    // A host may serialize equivalent object keys in a different order. Verify
    // the complete schema structurally, rather than treating key order as a
    // contract mismatch.
    const observedSchema = readObservedSchema(registered.inputSchema);
    const schemaMatches = observedSchema !== undefined
      && stableFingerprint(observedSchema) === stableFingerprint(composedSchema(tool));
    const verified = nameMatches && descriptionMatches && schemaMatches;
    emit({
      type: "VERIFY",
      label: "Verify",
      detail: verified
        ? "Registered contract matches the composed artifact."
        : `Registered contract does not match the composed artifact (name: ${nameMatches ? "match" : "mismatch"}; description: ${descriptionMatches ? "match" : "mismatch"}; input schema: ${schemaMatches ? "match" : "mismatch"}).`,
      status: verified ? "PASS" : "BLOCK",
    });

    return { outcome: verified ? "WORKING_TOOL" : "FAILED", events, toolName: tool.name };
  }
}
