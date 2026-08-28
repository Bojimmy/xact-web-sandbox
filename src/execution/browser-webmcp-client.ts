import type { AuthorizedEffect, ExecutionObservation } from "./contracts";
import type { WebMCPExecutionClient } from "./webmcp-execution-adapter";
import { BrowserDOMExecutionClient } from "./browser-dom-client";
import { WebMCPDispatchRegistry } from "./webmcp-dispatch";

/** Minimal public shape for Chrome's current document.modelContext API. */
export interface BrowserWebMCPTool {
  name?: string;
}

interface BrowserWebMCPToolDefinition extends BrowserWebMCPTool {
  description: string;
  inputSchema: Record<string, unknown>;
  execute(input: unknown): Promise<unknown>;
}

export interface BrowserWebMCPModelContext {
  getTools(): Promise<BrowserWebMCPTool[]>;
  executeTool(tool: BrowserWebMCPTool, input: string): Promise<unknown>;
  registerTool?(tool: BrowserWebMCPToolDefinition, options?: { signal?: AbortSignal }): Promise<unknown>;
}

export interface BrowserWebMCPDocument {
  modelContext?: BrowserWebMCPModelContext;
}

/**
 * Standards-facing WebMCP transport. It deliberately feature-detects the
 * browser API: missing modelContext or either required tool is unavailable,
 * not a cue to fall back around Commit or claim a successful effect.
 *
 * The remote page owns tool registration and its own audit record. This client
 * only serializes an already-authorized request and reads the observation it
 * returns; it cannot issue an AuthorizationArtifact.
 */
export class BrowserWebMCPExecutionClient implements WebMCPExecutionClient {
  constructor(
    private readonly documentRef: BrowserWebMCPDocument | undefined =
      typeof document === "undefined" ? undefined : (document as unknown as BrowserWebMCPDocument),
    private readonly requestToolName = "request_action",
    private readonly observationToolName = "get_execution_observation",
    private readonly dispatches?: WebMCPDispatchRegistry,
  ) {}

  isAvailable(): boolean {
    return Boolean(this.documentRef?.modelContext);
  }

  prepareDispatch(effect: AuthorizedEffect): void { this.dispatches?.prepare(effect); }

  cancelDispatch(effect: AuthorizedEffect): void { this.dispatches?.cancel(effect); }

  async requestAction(effect: AuthorizedEffect): Promise<{ receipt: unknown }> {
    const context = this.requireContext();
    const tool = await this.findTool(context, this.requestToolName);
    const response = await context.executeTool(tool, JSON.stringify({
      authorizationArtifact: effect.artifact,
      effect: effect.payload,
    }));
    const receipt = this.readReceipt(response);
    if (receipt === undefined || receipt === null || receipt === "") {
      throw new Error("WebMCP request_action returned no execution receipt.");
    }
    return { receipt };
  }

  async observeAction(receipt: unknown): Promise<ExecutionObservation> {
    const context = this.requireContext();
    const tool = await this.findTool(context, this.observationToolName);
    // This is a read of the tool's post-execution record. Do not substitute the
    // intended payload for an unavailable or empty observation.
    const observation = await context.executeTool(tool, JSON.stringify({ receipt }));
    return this.readObservation(observation);
  }

  private requireContext(): BrowserWebMCPModelContext {
    const context = this.documentRef?.modelContext;
    if (!context) throw new Error("WebMCP modelContext is unavailable in this browser.");
    return context;
  }

  private async findTool(context: BrowserWebMCPModelContext, name: string): Promise<BrowserWebMCPTool> {
    const tool = (await context.getTools()).find((candidate) => candidate.name === name);
    if (!tool) throw new Error(`Required WebMCP tool is unavailable: ${name}.`);
    return tool;
  }

  private readReceipt(response: unknown): unknown {
    if (!response || typeof response !== "object") return undefined;
    return (response as { receipt?: unknown }).receipt;
  }

  private readObservation(response: unknown): ExecutionObservation {
    if (!response || typeof response !== "object") {
      throw new Error("WebMCP observation returned no structured execution record.");
    }
    const candidate = response as Partial<ExecutionObservation>;
    if (
      !candidate.substrate || !candidate.target || !candidate.effectFingerprint
      || candidate.receipt === undefined || typeof candidate.observedAtEpochMs !== "number"
    ) {
      throw new Error("WebMCP observation is missing required execution evidence.");
    }
    return {
      substrate: candidate.substrate,
      receipt: candidate.receipt,
      target: candidate.target,
      effectFingerprint: candidate.effectFingerprint,
      observedAtEpochMs: candidate.observedAtEpochMs,
    };
  }
}

/**
 * Registers the sandbox's two consequential WebMCP tools on a browser that
 * supports the imperative API. Registration exposes capability only: the
 * action tool rejects every request not prepared by the artifact-guarded
 * WebMCPExecutionAdapter.
 */
export class BrowserWebMCPToolHost {
  private readonly observations = new Map<string, ExecutionObservation>();

  constructor(
    private readonly dispatches: WebMCPDispatchRegistry,
    private readonly domClient = new BrowserDOMExecutionClient(),
    private readonly documentRef: BrowserWebMCPDocument | undefined =
      typeof document === "undefined" ? undefined : (document as unknown as BrowserWebMCPDocument),
  ) {}

  async register(): Promise<() => void> {
    const context = this.documentRef?.modelContext;
    if (!context?.registerTool) return () => undefined;
    const controller = new AbortController();
    await context.registerTool({
      name: "request_action",
      description: "Cause one exact action only when Xact has prepared a matching AuthorizationArtifact dispatch.",
      inputSchema: actionSchema,
      execute: async (input) => this.requestAction(input),
    }, { signal: controller.signal });
    await context.registerTool({
      name: "get_execution_observation",
      description: "Read the post-execution observation for a receipt issued by request_action.",
      inputSchema: receiptSchema,
      execute: async (input) => this.observationFor(input),
    }, { signal: controller.signal });
    return () => controller.abort();
  }

  private async requestAction(input: unknown): Promise<{ receipt: unknown }> {
    const effect = this.dispatches.claim(input);
    if (!effect) throw new Error("WebMCP action blocked: no matching Xact-prepared dispatch.");
    const execution = await this.domClient.activate(effect);
    const observation = await this.domClient.observeAction(effect, execution.receipt);
    this.observations.set(String(execution.receipt), { ...observation, substrate: "WEBMCP" });
    return { receipt: execution.receipt };
  }

  private observationFor(input: unknown): ExecutionObservation {
    const receipt = input && typeof input === "object" ? (input as { receipt?: unknown }).receipt : undefined;
    const observation = this.observations.get(String(receipt));
    if (!observation) throw new Error("WebMCP observation is unavailable for this receipt.");
    return observation;
  }
}

const actionSchema = {
  type: "object",
  properties: { authorizationArtifact: { type: "object" }, effect: { type: "object" } },
  required: ["authorizationArtifact", "effect"],
};

const receiptSchema = {
  type: "object",
  properties: { receipt: { type: "string" } },
  required: ["receipt"],
};
