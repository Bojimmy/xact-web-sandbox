import "server-only";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import widgetHtml from "./widget.html?raw";

const RESOURCE_URI = "ui://xact-foundry/read-surface-v1.html";

export const runtime = "edge";
const recipes = [
  { id: "inspect_request", title: "Inspect request", description: "Read the reported request envelope and its public-safe fields." },
  { id: "get_customer", title: "Get customer", description: "Read the simulated customer record without exposing private data." },
  { id: "get_order", title: "Get order", description: "Read the simulated order state bound to the request." },
  { id: "get_policy", title: "Get policy", description: "Read the explicit policy constraints relevant to a consequence." },
  { id: "get_xact_state", title: "Get Xact state", description: "Read the current R / U / C and Commit-boundary state." },
  { id: "get_audit_trace", title: "Get audit trace", description: "Read the public-safe trace of resolution, Commit, and verification." },
] as const;
const recipeIds = recipes.map((recipe) => recipe.id) as [string, ...string[]];

type Session = { server: McpServer; transport: WebStandardStreamableHTTPServerTransport };
const sessions = new Map<string, Session>();

function createServer(): McpServer {
  const server = new McpServer(
    { name: "xact-foundry-mcp-bridge", version: "0.1.0" },
    { instructions: "Xact Foundry exposes public-safe READ recipes and inert WebMCP definitions. It never executes effects or grants Commit authority." },
  );

  registerAppResource(server, "Xact Foundry READ surface", RESOURCE_URI, {
    description: "A compact interactive view of approved READ recipes and inert WebMCP definitions.",
    _meta: {
      ui: {
        csp: { connectDomains: [], resourceDomains: [] },
        prefersBorder: true,
      },
      "openai/widgetDescription": "Shows approved Xact Foundry READ recipes and lets the user request inert WebMCP definitions without executing an effect.",
    },
  }, async () => ({
    contents: [{
      uri: RESOURCE_URI,
      mimeType: RESOURCE_MIME_TYPE,
      text: widgetHtml,
      _meta: { ui: { csp: { connectDomains: [], resourceDomains: [] }, prefersBorder: true } },
    }],
  }));

  registerAppTool(server, "list_read_recipes", {
    title: "List Xact READ recipes",
    description: "Use this when the user wants to inspect the approved public-safe Xact Foundry READ surface. This returns definitions only; it does not execute anything.",
    outputSchema: { recipes: z.array(z.object({ id: z.string(), title: z.string(), description: z.string() })) },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false, idempotentHint: true },
    _meta: {
      ui: { resourceUri: RESOURCE_URI },
      "openai/toolInvocation/invoking": "Reading approved Xact recipes…",
      "openai/toolInvocation/invoked": "Xact READ recipes ready.",
    },
  }, async () => ({
    structuredContent: { recipes },
    content: [{ type: "text", text: `Xact Foundry exposes ${recipes.length} approved READ recipes. They are inert definitions; no effect was executed.` }],
  }));

  registerAppTool(server, "request_webmcp_tool", {
    title: "Request an inert WebMCP definition",
    description: "Use this when the user selects one approved Xact Foundry READ recipe and wants its WebMCP tool definition. The returned definition is inert and cannot grant authority or execute an effect.",
    inputSchema: { recipeId: z.enum(recipeIds) },
    outputSchema: { tool: z.object({ name: z.string(), title: z.string(), description: z.string(), inputSchema: z.record(z.string(), z.unknown()), executable: z.literal(false), authority: z.literal("XACT_COMMIT_REQUIRED") }) },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false, idempotentHint: true },
    _meta: {
      ui: { resourceUri: RESOURCE_URI },
      "openai/toolInvocation/invoking": "Constructing an inert WebMCP definition…",
      "openai/toolInvocation/invoked": "Definition returned; no effect executed.",
    },
  }, async ({ recipeId }) => {
    const recipe = recipes.find((candidate) => candidate.id === recipeId);
    if (!recipe) return { isError: true, content: [{ type: "text", text: "Unknown recipe. Choose one returned by list_read_recipes." }] };
    const tool = {
      name: `xact_foundry.${recipe.id}`,
      title: recipe.title,
      description: `${recipe.description} This is a READ-only capability; Xact Commit authority is required for any consequential effect.`,
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      executable: false as const,
      authority: "XACT_COMMIT_REQUIRED" as const,
    };
    return {
      structuredContent: { tool },
      content: [{ type: "text", text: `${recipe.title} definition constructed. It is inert and does not execute an effect.` }],
    };
  });
  return server;
}

function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Headers", "Content-Type, MCP-Protocol-Version, Mcp-Session-Id, Last-Event-ID");
  headers.set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export async function OPTIONS() {
  return withCors(new Response(null, { status: 204 }));
}

export async function POST(request: Request) {
  try {
    const sessionId = request.headers.get("Mcp-Session-Id");
    const body = await request.clone().json().catch(() => null) as { method?: string } | null;
    let session = sessionId ? sessions.get(sessionId) : undefined;
    if (!session && body?.method !== "initialize") {
      return withCors(new Response(JSON.stringify({ jsonrpc: "2.0", error: { code: -32000, message: "A valid MCP session is required. Initialize first." }, id: null }), { status: 400, headers: { "Content-Type": "application/json" } }));
    }
    if (!session) {
      const server = createServer();
      let createdId: string | undefined;
      const transport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: () => crypto.randomUUID(),
        enableJsonResponse: true,
        onsessioninitialized: (id) => { createdId = id; sessions.set(id, { server, transport }); },
        onsessionclosed: (id) => { sessions.delete(id); },
      });
      session = { server, transport };
      await server.connect(transport);
      const response = await transport.handleRequest(request, { parsedBody: body ?? undefined });
      if (createdId && !sessions.has(createdId)) sessions.set(createdId, session);
      return withCors(response);
    }
    return withCors(await session.transport.handleRequest(request, { parsedBody: body ?? undefined }));
  } catch (error) {
    console.error("MCP request failed", error);
    return withCors(new Response(JSON.stringify({ jsonrpc: "2.0", error: { code: -32603, message: "MCP request failed." }, id: null }), { status: 500, headers: { "Content-Type": "application/json" } }));
  }
}

export async function GET(request: Request) {
  const sessionId = request.headers.get("Mcp-Session-Id");
  const session = sessionId ? sessions.get(sessionId) : undefined;
  if (!session) return withCors(new Response("Not Found", { status: 404 }));
  return withCors(await session.transport.handleRequest(request));
}

export async function DELETE(request: Request) {
  const sessionId = request.headers.get("Mcp-Session-Id");
  const session = sessionId ? sessions.get(sessionId) : undefined;
  if (!session) return withCors(new Response("Not Found", { status: 404 }));
  return withCors(await session.transport.handleRequest(request));
}
