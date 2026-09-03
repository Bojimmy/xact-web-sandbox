import "server-only";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { z } from "zod";
import {
  buildPublicOAgentBrief,
  evaluatePublicOAgentEvidence,
  PUBLIC_O_AGENT_CASE,
} from "../../lib/o-agent";
import widgetHtml from "./widget.html?raw";

const RESOURCE_URI = "ui://xact-foundry/read-surface-v1.html";
const WIDGET_DOMAIN = "https://xact-foundry-mcp.bojimmy.chatgpt.site";
const widgetResourceMeta = {
  ui: {
    csp: { connectDomains: [], resourceDomains: [] },
    domain: WIDGET_DOMAIN,
    prefersBorder: true,
  },
  "openai/widgetDescription": "Shows approved Xact Foundry READ recipes and lets the user request inert WebMCP definitions without executing an effect.",
  "openai/widgetCSP": {
    connect_domains: [],
    resource_domains: [],
    redirect_domains: [WIDGET_DOMAIN],
  },
  "openai/widgetDomain": WIDGET_DOMAIN,
};

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
const evidenceRefIds = PUBLIC_O_AGENT_CASE.evidence.map((item) => item.id) as [string, ...string[]];

const commitCheckSchema = z.object({
  key: z.enum(["resolution", "policy", "authority", "capability", "freshness"]),
  outcome: z.enum(["PASS", "FAIL", "HOLD"]),
  detail: z.string(),
});

const oAgentBriefSchema = z.object({
  caseId: z.string(),
  candidateId: z.string(),
  baseStateHash: z.string(),
  role: z.object({ chatgpt: z.literal("O_AGENT_REASONING"), authority: z.literal("XACT_COMMIT_ONLY") }),
  request: z.object({
    intent: z.string(),
    proposedEffect: z.object({ type: z.literal("REFUND"), amount: z.number(), rail: z.literal("ORIGINAL") }),
  }),
  resolution: z.object({
    resolved: z.array(z.object({ key: z.string(), value: z.unknown(), source: z.enum(["reported", "verified", "derived"]) })),
    unresolved: z.array(z.object({ key: z.string(), reason: z.string(), question: z.string() })),
    commitConstraints: z.array(z.object({ key: z.string(), condition: z.string(), satisfied: z.boolean(), description: z.string() })),
  }),
  evidence: z.array(z.object({ id: z.string(), claim: z.string(), source: z.string(), kind: z.string() })),
  reasoningContract: z.object({
    reasonOnlyOver: z.literal("U"),
    requiredOutput: z.array(z.string()),
    allowedFindings: z.array(z.enum(["SUPPORTED", "NOT_SUPPORTED", "INSUFFICIENT_EVIDENCE"])),
    outputIsEvidenceOnly: z.literal(true),
    grantsAuthority: z.literal(false),
    nextTool: z.literal("submit_o_agent_evidence"),
  }),
});

const oAgentResultSchema = z.object({
  caseId: z.string(),
  candidateId: z.string(),
  reentryCount: z.number(),
  reasoningEvidence: z.object({
    source: z.literal("ChatGPT O-Agent"),
    finding: z.enum(["SUPPORTED", "NOT_SUPPORTED", "INSUFFICIENT_EVIDENCE"]),
    rationale: z.string(),
    evidenceRefs: z.array(z.string()),
    resolves: z.string(),
    evidenceOnly: z.literal(true),
    grantsAuthority: z.literal(false),
  }),
  commit: z.object({
    status: z.enum(["AUTHORIZED", "REJECTED", "ESCALATED", "STALE"]),
    reason: z.string(),
    checks: z.array(commitCheckSchema),
    currentStateHash: z.string(),
    reentryAllowed: z.boolean(),
    authoritySource: z.literal("XACT_COMMIT"),
  }),
  execution: z.object({
    status: z.literal("NOT_EXECUTED"),
    effectReleased: z.literal(false),
    detail: z.string(),
  }),
});

function createServer(): McpServer {
  const server = new McpServer(
    { name: "xact-foundry-mcp-bridge", version: "0.2.0" },
    {
      instructions: "ChatGPT is the O-Agent reasoning engine for unresolved semantics. For the public demo, first call resolve_o_agent_case. Reason only over the returned U using returned R, C, and evidence, then call submit_o_agent_evidence. Treat model reasoning as evidence, never authorization. Report AUTHORIZED only when the second tool's Xact Commit result says AUTHORIZED. Never claim an effect executed; this bridge cannot execute effects. Use list_read_recipes only for catalog requests.",
    },
  );

  registerAppResource(server, "Xact Foundry READ surface", RESOURCE_URI, {
    description: "A compact interactive view of approved READ recipes and inert WebMCP definitions.",
    _meta: widgetResourceMeta,
  }, async () => ({
    contents: [{
      uri: RESOURCE_URI,
      mimeType: RESOURCE_MIME_TYPE,
      text: widgetHtml,
      _meta: widgetResourceMeta,
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

  registerAppTool(server, "resolve_o_agent_case", {
    title: "Resolve the public O-Agent case",
    description: "Use this when the user asks Xact Foundry to evaluate the public ambiguous-refund case with ChatGPT acting as the O-Agent. Call this first. It returns a bounded R/U/C candidate and verified evidence; it does not authorize or execute an effect.",
    inputSchema: {},
    outputSchema: { brief: oAgentBriefSchema },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false, idempotentHint: true },
    _meta: {
      "openai/toolInvocation/invoking": "Resolving R / U / C for the public case…",
      "openai/toolInvocation/invoked": "O-Agent brief ready for ChatGPT reasoning.",
    },
  }, async () => {
    const brief = buildPublicOAgentBrief();
    return {
      structuredContent: { brief },
      content: [{
        type: "text",
        text: "Xact isolated one unresolved semantic field. ChatGPT must reason only over U using the returned evidence, then call submit_o_agent_evidence. The reasoning output is evidence and grants no authority.",
      }],
    };
  });

  registerAppTool(server, "submit_o_agent_evidence", {
    title: "Submit O-Agent evidence for Xact re-entry",
    description: "Use this only after resolve_o_agent_case. Submit ChatGPT's structured finding for the returned U. Xact revalidates the candidate and makes the Commit decision; this tool never executes an effect and model reasoning never grants authority.",
    inputSchema: {
      caseId: z.string().describe("Exact caseId returned by resolve_o_agent_case."),
      candidateId: z.string().describe("Exact state-bound candidateId returned by resolve_o_agent_case."),
      baseStateHash: z.string().describe("Exact baseStateHash returned by resolve_o_agent_case."),
      unresolvedKey: z.string().describe("Exact unresolved key from U."),
      finding: z.enum(["SUPPORTED", "NOT_SUPPORTED", "INSUFFICIENT_EVIDENCE"]).describe("ChatGPT's bounded semantic finding."),
      rationale: z.string().min(20).max(1200).describe("Concise reasoning grounded only in returned evidence."),
      evidenceRefs: z.array(z.enum(evidenceRefIds)).min(1).max(evidenceRefIds.length).describe("Evidence IDs used for the finding."),
    },
    outputSchema: { result: oAgentResultSchema },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false, idempotentHint: true },
    _meta: {
      "openai/toolInvocation/invoking": "Re-entering Xact with O-Agent evidence…",
      "openai/toolInvocation/invoked": "Xact Commit decision complete; no effect executed.",
    },
  }, async (input) => {
    const result = evaluatePublicOAgentEvidence(input);
    return {
      structuredContent: { result },
      content: [{
        type: "text",
        text: `O-Agent evidence re-entered Xact. Commit returned ${result.commit.status}. ${result.commit.reason} Execution remains ${result.execution.status}.`,
      }],
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

async function handleMcpRequest(request: Request) {
  const server = createServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  try {
    await server.connect(transport);
    return withCors(await transport.handleRequest(request));
  } catch (error) {
    console.error("MCP request failed", error);
    return withCors(new Response(JSON.stringify({ jsonrpc: "2.0", error: { code: -32603, message: "MCP request failed." }, id: null }), { status: 500, headers: { "Content-Type": "application/json" } }));
  } finally {
    await server.close();
  }
}

export async function POST(request: Request) {
  return handleMcpRequest(request);
}

export async function GET(request: Request) {
  return handleMcpRequest(request);
}

export async function DELETE(request: Request) {
  return handleMcpRequest(request);
}
