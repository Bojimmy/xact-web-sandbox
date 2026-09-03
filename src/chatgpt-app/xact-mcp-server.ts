import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { constructChatGPTCapability, listChatGPTCapabilities, readChatGPTCapability } from "./xact-foundry-tools";
import {
  getBossRequest,
  startCapabilityBuild,
  submitBossResolution,
  type BossSessionStore,
} from "./xact-boss-loop";
import { describeCompositionOutcome, validateComposition, summarizeComposedTool, type CapabilityComposition } from "./capability-composition";
import { XactFoundryLiaison } from "../flagship/foundry-liaison";
import { listXactDemoPrompts } from "./xact-demo-prompts";

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
export function createXactMcpServer(options: { bossSessionStore?: BossSessionStore } = {}): McpServer {
  const { bossSessionStore } = options;
  const server = new McpServer({ name: "xact-foundry", version: "0.1.0" }, {
    instructions: "Xact Foundry is a governed compiler from human intent to agent capability. Reasoning may propose; only Xact commits; constructing a tool never authorizes using it. Three surfaces: (1) CONSTRUCTION — list_xact_capabilities, construct_xact_tool, start_capability_build, get_boss_request, submit_boss_resolution — returns inert contract-only definitions with a three-part summary (builtAndValidated / currentBoundary / nextRequiredCapability). (2) RUNTIME READ — read_xact_capability — returns actual current read-only data on demand from the public-safe workspace (never a mutation, never scheduled). (3) COMPOSITION — propose_capability_composition — you propose a structured composition (actor, capability, resource, operation, filter, sort, output, mutation) and Xact validates it against the closed governed vocabulary, returning COMPOSABLE (built), NOVEL_BOUNDARY (governance candidate), or UNAUTHORIZED (blocked). When a user asks for demo prompts, examples to try, or 'what can I build', call list_xact_demo_prompts and present the governed prompt pack — never invent your own prompts or claim a prompt works unless its runtime availability says so. Build flow: start_capability_build first; BUILT means stop and report the summary; CLARIFICATION_REQUIRED shows at most three governed choices and you submit the chosen ID; WAITING_FOR_BOSS means call get_boss_request for genuine semantic U; BLOCKED means explain the candidate build brief and never substitute a similar capability. Never map customer order-status to field work-order, never invent a capability, and never claim execution or Commit authority. Scope: this Challenge build is chat-scoped — governed capabilities live in this conversation's history, so reopen the Xact Foundry conversation from the ChatGPT sidebar to reuse them. A dashboard is future productization, not part of this build.",
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

  server.registerTool("list_xact_demo_prompts", {
    title: "List governed demo prompts to try",
    description: "Return a governed, balanced set of demo prompts (normal, adversarial, read-only, mutation, evidence, freshness, cross-queue). Every prompt states its expected Xact outcome, the capabilities and vocabulary it exercises, whether runtime data is available, and whether its result is an executable read or a contract-only definition. Unsupported prompts are marked NOVEL_BOUNDARY with a truthful explanation.",
    inputSchema: { category: z.string().trim().max(60).optional() },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false, idempotentHint: true },
  }, async ({ category }) => {
    const prompts = listXactDemoPrompts();
    const filtered = category ? prompts.filter((prompt) => prompt.category === category) : prompts;
    const value = {
      prompts: filtered,
      note: "These prompts are truthful and mapped to the current governed vocabulary. Runtime availability and result kind are computed from the real wiring, never assumed. Chat-scoped: governed capabilities live in this conversation; reopen the Xact Foundry conversation from the sidebar to reuse them.",
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

  server.registerTool("start_capability_build", {
    title: "Start a capability build as the Boss",
    description: "Use this when the user asks Xact Foundry to build a capability in natural language. Xact resolves declared governed equivalents first: BUILT finishes immediately; CLARIFICATION_REQUIRED contains at most three safe choices; WAITING_FOR_BOSS is reserved for genuine semantic U; BLOCKED includes a candidate build brief when no governed capability exists.",
    inputSchema: {
      intent: z.string().trim().min(1).max(500),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true, idempotentHint: false },
  }, async ({ intent }) => {
    const value = await startCapabilityBuild(intent, bossSessionStore);
    return { content: [{ type: "text", text: json(value) }], structuredContent: structured(value) };
  });

  server.registerTool("get_boss_request", {
    title: "Get the exact unresolved information for a Boss run",
    description: "Use this only after start_capability_build returns WAITING_FOR_BOSS. It returns the exact genuine semantic U that needs a Boss interpretation. It does not dump the full capability catalog.",
    inputSchema: {
      runId: z.string().trim().min(1).max(120),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false, idempotentHint: true },
  }, async ({ runId }) => {
    try {
      const value = await getBossRequest(runId, bossSessionStore);
      return { content: [{ type: "text", text: json(value) }], structuredContent: structured(value) };
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Unknown run.";
      return { content: [{ type: "text", text: message }], isError: true };
    }
  });

  server.registerTool("submit_boss_resolution", {
    title: "Submit a Boss resolution to re-enter Xact",
    description: "Submit either the user's selected ID from CLARIFICATION_REQUIRED, ChatGPT's concise interpretation for genuine semantic U, or a structured capability composition. Xact—not the Boss—classifies the result, re-enters normal construction, and returns MORE_REASONING_REQUIRED, BLOCKED, or BUILT. Never submit an ID outside the choices supplied by Xact.",
    inputSchema: {
      runId: z.string().trim().min(1).max(120),
      resolutions: z.array(z.object({
        unresolvedId: z.string().trim().min(1).max(120),
        resolution: z.object({
          capabilityId: z.string().trim().min(1).max(120).optional(),
          bounds: z.record(z.string(), z.string().max(120)).optional(),
          interpretation: z.string().trim().max(500).optional(),
          composition: z.object({
            actor: z.string().trim().max(120).optional(),
            capability: z.enum(["READ", "MUTATION"]),
            resource: z.array(z.string().trim().min(1).max(60)),
            operation: z.array(z.string().trim().min(1).max(60)).optional(),
            filter: z.array(z.string().trim().min(1).max(60)).optional(),
            sort: z.string().trim().max(120).optional(),
            output: z.array(z.string().trim().min(1).max(60)),
            mutation: z.string().trim().max(60).optional(),
          }).optional(),
        }),
      })),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true, idempotentHint: false },
  }, async ({ runId, resolutions }) => {
    try {
      const value = await submitBossResolution(runId, resolutions, bossSessionStore);
      return { content: [{ type: "text", text: json(value) }], structuredContent: structured(value) };
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Xact rejected the resolution.";
      return { content: [{ type: "text", text: message }], isError: true };
    }
  });

  server.registerTool("read_xact_capability", {
    title: "Read current data from a governed READ capability",
    description: "Retrieve actual current data on demand from the public-safe business workspace for a governed READ capability. This is the runtime read surface, separate from construction: it returns real structured data with an explicit schema (kind/title/source/summary/columns/rows) and never constructs, mutates, or commits.",
    inputSchema: {
      capabilityId: z.string().trim().min(1).max(120),
      input: z.record(z.string(), z.string().max(120)).optional(),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false, idempotentHint: true },
  }, async ({ capabilityId, input }) => {
    try {
      const value = readChatGPTCapability(capabilityId, input ?? {});
      return { content: [{ type: "text", text: json(value) }], structuredContent: structured(value) };
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Xact rejected the runtime read.";
      return { content: [{ type: "text", text: message }], isError: true };
    }
  });

  server.registerTool("propose_capability_composition", {
    title: "Propose a governed capability composition",
    description: "Propose a STRUCTURED capability composition for Xact to validate against the closed governed vocabulary. Xact returns COMPOSABLE (and builds the inert definition through the X-Nodes), NOVEL_BOUNDARY (a governance candidate), or UNAUTHORIZED (blocked). Proposing a composition never executes and never grants Commit authority.",
    inputSchema: {
      actor: z.string().trim().max(120).optional(),
      capability: z.enum(["READ", "MUTATION"]),
      resource: z.array(z.string().trim().min(1).max(60)),
      operation: z.array(z.string().trim().min(1).max(60)).optional(),
      filter: z.array(z.string().trim().min(1).max(60)).optional(),
      sort: z.string().trim().max(120).optional(),
      output: z.array(z.string().trim().min(1).max(60)),
      mutation: z.string().trim().max(60).optional(),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true, idempotentHint: false },
  }, async (args) => {
    const composition: CapabilityComposition = {
      actor: args.actor,
      capability: args.capability,
      resource: args.resource,
      operation: args.operation,
      filter: args.filter,
      sort: args.sort,
      output: args.output,
      mutation: args.mutation ?? "NONE",
    };
    const result = validateComposition(composition);
    if (result.outcome === "UNAUTHORIZED") {
      const value = { outcome: "UNAUTHORIZED", reason: result.reason, presentation: describeCompositionOutcome(result) };
      return { content: [{ type: "text", text: json(value) }], structuredContent: structured(value) };
    }
    if (result.outcome === "NEEDS_RESOLUTION") {
      const value = { outcome: "NEEDS_RESOLUTION", question: result.question, presentation: describeCompositionOutcome(result) };
      return { content: [{ type: "text", text: json(value) }], structuredContent: structured(value) };
    }
    if (result.outcome === "NOVEL_BOUNDARY") {
      const value = {
        outcome: "NOVEL_BOUNDARY",
        missing: result.missing,
        presentation: describeCompositionOutcome(result),
        candidateBuildBrief: {
          status: "CANDIDATE_BUILD_BRIEF",
          requestedOutcome: `${composition.capability} over ${composition.resource.join(" + ")}`,
          missingGovernedCapability: result.missing.join(", "),
          publicSafeScope: "READ_ONLY",
          nextStep: "GOVERNANCE_REVIEW_REQUIRED",
        },
      };
      return { content: [{ type: "text", text: json(value) }], structuredContent: structured(value) };
    }
    if (result.outcome === "ALREADY_GOVERNED") {
      const built = await constructChatGPTCapability(result.capabilityId, {});
      const value = { outcome: "ALREADY_GOVERNED", presentation: describeCompositionOutcome(result), result: built };
      return { content: [{ type: "text", text: json(value) }], structuredContent: structured(value) };
    }
    // COMPOSABLE — build through Door/Ledger → AUTHORIZATION → COMMIT → BUILD.
    const liaison = new XactFoundryLiaison();
    const build = await liaison.buildFromDescriptor(result.descriptor);
    if (build.outcome !== "COMPOSED_DEFINITION" || !build.tool) {
      const value = { outcome: "UNAUTHORIZED", reason: "Xact did not authorize the composed capability." };
      return { content: [{ type: "text", text: json(value) }], structuredContent: structured(value) };
    }
    const tool = build.tool;
    const value = {
      outcome: "COMPOSABLE",
      presentation: describeCompositionOutcome(result),
      capabilityId: tool.name,
      definition: {
        name: tool.name,
        description: tool.description,
        capabilityKind: tool.capabilityKind,
        inputSchema: tool.inputSchema,
        outputSchema: tool.outputSchema,
        boundaries: tool.boundaries,
        requiresCommit: tool.requiresCommit,
      },
      activity: build.activity,
      summary: summarizeComposedTool(tool),
    };
    return { content: [{ type: "text", text: json(value) }], structuredContent: structured(value) };
  });

  return server;
}
