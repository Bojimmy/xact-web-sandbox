import type { WebMCPToolDefinition } from "./webmcp-tool-builder";
import { WebMCPDispatchRegistry } from "../execution/webmcp-dispatch";
import type { AuthorizedEffect } from "../execution/contracts";
import type { AuthorizationArtifact } from "../xact/contracts";

/**
 * The Foundry tool runtime (ADR 0019).
 *
 * The Foundry is the host: a composed, verified tool is added to an internal
 * shelf and invoked through Xact, which applies the correct boundary at
 * invocation time.
 *
 *   READ     → deterministic read substrate → real result (no consequence).
 *   MUTATION → fresh Resolve → Commit → exact dispatch, then the effect. Without
 *              a fresh Commit authorization it blocks with no effect.
 *
 * Browser WebMCP registration (webmcp-host-registration) remains an optional
 * *exposure* of a Foundry-hosted tool — it is not the definition of "working".
 */

export class FoundryToolRegistry {
  private tools = new Map<string, WebMCPToolDefinition>();

  add(tool: WebMCPToolDefinition): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): WebMCPToolDefinition | undefined {
    return this.tools.get(name);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  list(): WebMCPToolDefinition[] {
    return [...this.tools.values()];
  }
}

export type InvocationStatus = "READ_RESULT" | "AUTHORIZED_EFFECT" | "BLOCKED_NO_AUTHORITY";

export interface FoundryInvocationResult {
  toolName: string;
  status: InvocationStatus;
  result?: unknown;
  effectFingerprint?: string;
  audit: string[];
}

export interface FreshCommitResult {
  authorized: boolean;
  effect?: AuthorizedEffect;
  reason?: string;
}

/**
 * A composed tool's schema is part of its governed contract. Validate it at
 * the host boundary so a blank form value can never turn a scoped READ into a
 * broad query (or reach a mutation's Commit path).
 */
function requireDeclaredInputs(tool: WebMCPToolDefinition, input: unknown): void {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error(`Tool ${tool.name} requires an object input.`);
  }

  const values = input as Record<string, unknown>;
  for (const field of tool.inputSchema.required) {
    const value = values[field];
    const missing = value === undefined
      || value === null
      || (typeof value === "string" && value.trim().length === 0);
    if (missing) {
      throw new Error(`Missing required input: ${field}.`);
    }
  }
}

export class FoundryRuntime {
  constructor(
    private readonly registry: FoundryToolRegistry,
    /** Deterministic read substrate (approved data source) for READ tools. */
    private readonly readSubstrate: (tool: WebMCPToolDefinition, input: unknown) => unknown,
    /** Fresh Resolve → Commit for the exact mutation consequence. */
    private readonly commitEngine: (tool: WebMCPToolDefinition, input: unknown) => FreshCommitResult | Promise<FreshCommitResult>,
    /** Execution substrate: applies the authorized effect. */
    private readonly applyEffect: (tool: WebMCPToolDefinition, input: unknown, artifact: AuthorizationArtifact) => unknown,
    private readonly dispatches: WebMCPDispatchRegistry = new WebMCPDispatchRegistry(),
  ) {}

  async invoke(name: string, input: unknown): Promise<FoundryInvocationResult> {
    const tool = this.registry.get(name);
    if (!tool) {
      throw new Error(`Tool "${name}" is not on the Foundry shelf.`);
    }
    requireDeclaredInputs(tool, input);
    const audit: string[] = [];

    // READ — deterministic substrate, no consequence, no Commit.
    if (tool.capabilityKind === "READ") {
      const result = this.readSubstrate(tool, input);
      audit.push(`READ ${tool.name}: deterministic substrate returned a result.`);
      return { toolName: name, status: "READ_RESULT", result, audit };
    }

    // MUTATION — fresh Resolve → Commit, then exact dispatch, then effect.
    const commit = await this.commitEngine(tool, input);
    if (!commit.authorized || !commit.effect) {
      audit.push(`MUTATION ${tool.name}: no fresh Commit authorization${commit.reason ? ` — ${commit.reason}` : ""}.`);
      return { toolName: name, status: "BLOCKED_NO_AUTHORITY", audit };
    }

    this.dispatches.prepare(commit.effect);
    const claimed = this.dispatches.claim({ authorizationArtifact: commit.effect.artifact, effect: commit.effect.payload });
    if (!claimed) {
      audit.push(`MUTATION ${tool.name}: exact dispatch did not match the authorized effect.`);
      return { toolName: name, status: "BLOCKED_NO_AUTHORITY", audit };
    }

    const result = this.applyEffect(tool, input, commit.effect.artifact);
    audit.push(`MUTATION ${tool.name}: exact dispatch authorized; effect applied.`);
    return {
      toolName: name,
      status: "AUTHORIZED_EFFECT",
      result,
      effectFingerprint: commit.effect.artifact.effectFingerprint,
      audit,
    };
  }
}
