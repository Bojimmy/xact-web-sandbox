import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createXactMcpServer } from "../../src/chatgpt-app/xact-mcp-server";

/**
 * Streamable HTTP endpoint for the ChatGPT App bridge.
 *
 * It is stateless by design: every request receives a fresh MCP server backed
 * only by public-safe deterministic Foundry recipes. No model credential or
 * user consequence is available on this route.
 */
async function handleMcp(request: Request): Promise<Response> {
  const server = createXactMcpServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  try {
    return await transport.handleRequest(request);
  } finally {
    await server.close();
  }
}

export const POST = handleMcp;
export const GET = handleMcp;
export const DELETE = handleMcp;
