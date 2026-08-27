import type { AuthorizedEffect } from "./contracts";
import type { WebMCPExecutionClient } from "./webmcp-execution-adapter";

/** Minimal public shape for Chrome's current document.modelContext API. */
export interface BrowserWebMCPTool {
  name?: string;
}

export interface BrowserWebMCPModelContext {
  getTools(): Promise<BrowserWebMCPTool[]>;
  executeTool(tool: BrowserWebMCPTool, input: string): Promise<unknown>;
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
  ) {}

  isAvailable(): boolean {
    return Boolean(this.documentRef?.modelContext);
  }

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

  async observeAction(receipt: unknown): Promise<unknown> {
    const context = this.requireContext();
    const tool = await this.findTool(context, this.observationToolName);
    // This is a read of the tool's post-execution record. Do not substitute the
    // intended payload for an unavailable or empty observation.
    return context.executeTool(tool, JSON.stringify({ receipt }));
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
}
