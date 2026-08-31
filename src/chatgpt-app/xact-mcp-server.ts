import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { constructChatGPTCapability, listChatGPTCapabilities } from "./xact-foundry-tools";

function json(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function structured(value: unknown): Record<string, unknown> {
  return JSON.parse(json(value)) as Record<string, unknown>;
}

/**
 * The public ChatGPT-facing surface of Xact Foundry.
 *
 * These tools intentionally do not invoke an LLM. ChatGPT supplies the Boss
 * reasoning; Xact validates and constructs against the governed vocabulary.
 */
export function createXactMcpServer(): McpServer {
  const server = new McpServer({ name: "xact-foundry", version: "0.1.0" }, {
    instructions: "Use list_xact_capabilities before constructing. Xact can compose the returned governed recipes that do not require semantic review. A composed definition is inert and is never authority to execute.",
  });

  server.registerTool("list_xact_capabilities", {
    title: "List approved Xact Foundry tool recipes",
    description: "List public-safe, governed Xact Foundry recipes that can become inert WebMCP tool definitions. Recipes marked semanticReviewRequired need an attested Boss-to-Xact proposal bridge before construction.",
    inputSchema: { query: z.string().trim().max(120).optional() },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false, idempotentHint: true },
  }, async ({ query }) => {
    const capabilities = listChatGPTCapabilities(query);
    const value = {
      capabilities,
      note: "This bridge constructs only governed, inert tool definitions. It never executes an external action. Mutation definitions remain locked: every future use requires a fresh Xact Commit.",
    };
    return { content: [{ type: "text", text: json(value) }], structuredContent: structured(value) };
  });

  server.registerTool("construct_xact_tool", {
    title: "Construct an approved Xact tool",
    description: "Ask Xact to construct one exact capability ID returned by list_xact_capabilities. Xact validates the governed recipe and returns a real but inert WebMCP tool definition. This never executes an external action; mutation definitions still require a fresh Commit for every future use.",
    inputSchema: {
      capabilityId: z.string().trim().min(1).max(120),
      bounds: z.record(z.string(), z.string().max(120)).optional(),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: true },
  }, async ({ capabilityId, bounds }) => {
    try {
      const value = await constructChatGPTCapability(capabilityId, bounds ?? {});
      return { content: [{ type: "text", text: json(value) }], structuredContent: structured(value) };
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Xact rejected the requested construction.";
      return { content: [{ type: "text", text: message }], isError: true };
    }
  });

  return server;
}
