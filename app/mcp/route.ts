import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createXactMcpServer } from "../../src/mcp-server";

async function handleMcp(request: Request): Promise<Response> {
  const server = createXactMcpServer();
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
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
