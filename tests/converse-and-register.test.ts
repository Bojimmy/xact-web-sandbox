import assert from "node:assert/strict";
import test from "node:test";
import { XactAgentLiaison } from "../src/flagship/xact-agent-liaison";
import { XactFoundryLiaison } from "../src/flagship/foundry-liaison";
import { commitGatedExecute } from "../src/flagship/foundry-build-register";
import { WebMCPDispatchRegistry } from "../src/execution/webmcp-dispatch";
import type { FoundryWebMCPHost } from "../src/flagship/webmcp-host-registration";
import { SecureEndpointOAgentProvider } from "../src/telemetry/o-agent-provider";

function liveProvider(): SecureEndpointOAgentProvider {
  return new SecureEndpointOAgentProvider(
    "/api/o-agent",
    async () => new Response(JSON.stringify({
      kind: "LIVE_SANDBOX_MEASUREMENT",
      provider: "ollama",
      result: {
        evidence: [{ claim: "Eligibility evidence", resolves: ["credit eligibility"] }],
        inputTokens: 3,
        outputTokens: 2,
        latencyMs: 1,
      },
    }), { status: 200 }),
  );
}

function countingProvider(): { provider: SecureEndpointOAgentProvider; count: () => number } {
  let calls = 0;
  const provider = new SecureEndpointOAgentProvider(
    "/api/o-agent",
    async () => {
      calls += 1;
      return new Response(JSON.stringify({
        kind: "LIVE_SANDBOX_MEASUREMENT",
        provider: "ollama",
        result: {
          evidence: [{ claim: "Eligibility evidence", resolves: ["credit eligibility"] }],
          inputTokens: 3,
          outputTokens: 2,
          latencyMs: 1,
        },
      }), { status: 200 });
    },
  );
  return { provider, count: () => calls };
}

function agent(provider = liveProvider()): XactAgentLiaison {
  return new XactAgentLiaison(new XactFoundryLiaison(provider));
}

interface RecordedTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (input: unknown) => Promise<unknown>;
}

function recordingHost(): { host: FoundryWebMCPHost; registered: RecordedTool[] } {
  const registered: RecordedTool[] = [];
  const host: FoundryWebMCPHost = {
    async registerTool(tool) {
      registered.push({ name: tool.name!, description: tool.description!, inputSchema: tool.inputSchema!, execute: tool.execute });
    },
    async getTools() {
      return registered.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema }));
    },
  };
  return { host, registered };
}

test("converseAndRegister builds once — no duplicate reasoning", async () => {
  const { provider, count } = countingProvider();
  const { host } = recordingHost();
  const result = await agent(provider).converseAndRegister(
    "Build a tool that lets support agents issue a service credit up to $25",
    { host, executeFor: () => commitGatedExecute((input) => new WebMCPDispatchRegistry().claim(input)) },
  );

  assert.equal(count(), 1); // one build, one reasoning call
  assert.equal(result.outcome, "WORKING_TOOL");
});

test("a host without WebMCP shows a real REGISTER block, not a working tool", async () => {
  const noWebMcp: FoundryWebMCPHost = { getTools: async () => [] }; // no registerTool
  const result = await agent().converseAndRegister("Find customers by email", { host: noWebMcp });

  assert.equal(result.outcome, "REGISTRATION_FAILED");
  assert.ok(result.activity.some((a) => a.type === "REGISTER" && a.status === "BLOCK"));
  assert.ok(!result.activity.some((a) => a.type === "VERIFY" && a.status === "PASS"));
});

test("with a real host, a READ registers, observes, and verifies", async () => {
  const { host } = recordingHost();
  const result = await agent().converseAndRegister("Find customers by email", {
    host,
    executeFor: () => async () => ({ result: "customer" }),
  });

  assert.equal(result.outcome, "WORKING_TOOL");
  const types = result.activity.map((a) => a.type);
  for (const expected of ["BUILD", "REGISTER", "OBSERVE", "VERIFY"] as const) {
    assert.ok(types.includes(expected), `missing ${expected}`);
  }
});

test("a clarification request needs input and never registers", async () => {
  const { host, registered } = recordingHost();
  const result = await agent().converseAndRegister("Build a tool that issues a service credit", { host });

  assert.equal(result.outcome, "NEEDS_INPUT");
  assert.equal(registered.length, 0);
});

test("a pending-governance request never registers", async () => {
  const { host, registered } = recordingHost();
  const result = await agent().converseAndRegister("Keep me updated on user stats and requests", { host });

  assert.equal(result.outcome, "PENDING_GOVERNANCE");
  assert.equal(registered.length, 0);
});

test("without a host the tool stays a composed definition", async () => {
  const result = await agent().converseAndRegister("Find customers by email", {});

  assert.equal(result.outcome, "COMPOSED_DEFINITION");
  assert.equal(result.registration, undefined);
  assert.ok(result.tool);
});
