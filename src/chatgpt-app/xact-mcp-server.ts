import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { constructChatGPTReadCapability, listChatGPTCapabilities } from "./xact-foundry-tools";

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
    instructions: "Use list_xact_capabilities before constructing. Xact can construct only the returned public-safe READ recipes here. A composed definition is inert and is never authority to execute.",
  });

  server.registerTool("list_xact_capabilities", {
    title: "List approved Xact Foundry capabilities",
    description: "List public-safe, deterministic READ recipes that Xact Foundry can construct into inert WebMCP tool definitions. Use this before asking Xact to construct a tool.",
    inputSchema: { query: z.string().trim().max(120).optional() },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false, idempotentHint: true },
  }, async ({ query }) => {
    const capabilities = listChatGPTCapabilities(query);
    const value = {
      capabilities,
      note: "This bridge exposes only public-safe READ recipes. It does not expose execution, external systems, mutation tools, or Commit authority.",
    };
    return { content: [{ type: "text", text: json(value) }], structuredContent: structured(value) };
  });

  server.registerTool("construct_xact_read_tool", {
    title: "Construct an approved Xact read tool",
    description: "Ask Xact to construct one exact capability ID returned by list_xact_capabilities. Xact validates the governed recipe and returns a real but inert WebMCP READ-tool definition. This never executes an external action.",
    inputSchema: {
      capabilityId: z.string().trim().min(1).max(120),
      bounds: z.record(z.string(), z.string().max(120)).optional(),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: true },
  }, async ({ capabilityId, bounds }) => {
    try {
      const value = await constructChatGPTReadCapability(capabilityId, bounds ?? {});
      return { content: [{ type: "text", text: json(value) }], structuredContent: structured(value) };
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Xact rejected the requested construction.";
      return { content: [{ type: "text", text: message }], isError: true };
    }
  });

  return server;
}
