import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { env } from "cloudflare:workers";
import { DurableBossSessionStore, type BossSessionDatabase } from "../../src/durable-boss-session-store";
import { createXactMcpServer } from "../../src/mcp-server";

async function handleMcp(request: Request): Promise<Response> {
  const db = (env as unknown as { DB?: BossSessionDatabase }).DB;
  if (!db) {
    return Response.json({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32603, message: "Boss run storage is unavailable." },
    }, { status: 503, headers: { "cache-control": "no-store" } });
  }

  const server = createXactMcpServer({ bossSessionStore: new DurableBossSessionStore(db) });
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
