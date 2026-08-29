import assert from "node:assert/strict";
import test from "node:test";
import { FoundryWebMCPRegistrationHost, type FoundryWebMCPHost } from "../src/flagship/webmcp-host-registration";
import { describeCapability } from "../src/flagship/capability-vocabulary";
import { composeWebMCPTool } from "../src/flagship/webmcp-tool-builder";

function creditTool() {
  return composeWebMCPTool(describeCapability({
    id: "issue_service_credit",
    capabilityKind: "MUTATION",
    label: "Issue customer service credit",
    inputs: ["customerId", "amount", "reason"],
    resolves: ["credit-applied"],
    boundaries: [
      { primitive: "ACTOR_BINDING", description: "actor requires SERVICE_RECOVERY", actor: "SERVICE_RECOVERY" },
      { primitive: "COMMIT_BOUNDARY", description: "amount must not exceed $25", limit: { operator: "<=", value: 25 } },
    ],
  }));
}

function recordingHost(): { host: FoundryWebMCPHost; registered: Array<{ name: string; description: string; inputSchema: Record<string, unknown> }> } {
  const registered: Array<{ name: string; description: string; inputSchema: Record<string, unknown> }> = [];
  const host: FoundryWebMCPHost = {
    async registerTool(tool) {
      registered.push({ name: tool.name!, description: tool.description!, inputSchema: tool.inputSchema! });
    },
    async getTools() {
      return registered.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema }));
    },
  };
  return { host, registered };
}

test("registerTool runs REGISTER → OBSERVE → VERIFY and returns WORKING_TOOL when the contract matches", async () => {
  const { host } = recordingHost();
  const registration = new FoundryWebMCPRegistrationHost();
  const events: string[] = [];

  const result = await registration.registerTool(creditTool(), host, async () => ({ ok: true }), (e) => events.push(e.type));

  assert.equal(result.outcome, "WORKING_TOOL");
  assert.deepEqual(events, ["REGISTER", "OBSERVE", "VERIFY"]);
  assert.ok(result.events.every((e) => e.status === "PASS"));
  assert.equal(result.toolName, "issue_service_credit");
});

test("an unavailable host fails at REGISTER", async () => {
  const host: FoundryWebMCPHost = { getTools: async () => [] };
  const result = await new FoundryWebMCPRegistrationHost().registerTool(creditTool(), host, async () => ({ ok: true }));

  assert.equal(result.outcome, "FAILED");
  assert.equal(result.events[0].type, "REGISTER");
  assert.equal(result.events[0].status, "BLOCK");
  assert.equal(result.events.length, 1);
});

test("a host that never exposes the tool fails at OBSERVE", async () => {
  const host: FoundryWebMCPHost = {
    async registerTool() {},
    async getTools() { return []; },
  };
  const result = await new FoundryWebMCPRegistrationHost().registerTool(creditTool(), host, async () => ({ ok: true }));

  assert.equal(result.outcome, "FAILED");
  assert.deepEqual(result.events.map((e) => e.type), ["REGISTER", "OBSERVE"]);
  assert.equal(result.events[1].status, "BLOCK");
});

test("a mismatched registered contract fails at VERIFY", async () => {
  const host: FoundryWebMCPHost = {
    async registerTool() {},
    async getTools() {
      return [{ name: "issue_service_credit", description: "wrong", inputSchema: { type: "object", properties: {}, required: [] } }];
    },
  };
  const result = await new FoundryWebMCPRegistrationHost().registerTool(creditTool(), host, async () => ({ ok: true }));

  assert.equal(result.outcome, "FAILED");
  assert.deepEqual(result.events.map((e) => e.type), ["REGISTER", "OBSERVE", "VERIFY"]);
  assert.equal(result.events[2].status, "BLOCK");
});

test("an equivalent host schema with reordered object keys verifies", async () => {
  const tool = creditTool();
  const host: FoundryWebMCPHost = {
    async registerTool() {},
    async getTools() {
      return [{
        name: tool.name,
        description: tool.description,
        inputSchema: {
          required: [...tool.inputSchema.required],
          properties: { ...tool.inputSchema.properties },
          type: "object",
        },
      }];
    },
  };

  const result = await new FoundryWebMCPRegistrationHost().registerTool(tool, host, async () => ({ ok: true }));

  assert.equal(result.outcome, "WORKING_TOOL");
  assert.equal(result.events.at(-1)?.type, "VERIFY");
  assert.equal(result.events.at(-1)?.status, "PASS");
});

test("an equivalent host schema serialized as JSON text verifies", async () => {
  const tool = creditTool();
  const host: FoundryWebMCPHost = {
    async registerTool() {},
    async getTools() {
      return [{
        name: tool.name,
        description: tool.description,
        inputSchema: JSON.stringify({
          type: "object",
          properties: { ...tool.inputSchema.properties },
          required: [...tool.inputSchema.required],
        }),
      }];
    },
  };

  const result = await new FoundryWebMCPRegistrationHost().registerTool(tool, host, async () => ({ ok: true }));

  assert.equal(result.outcome, "WORKING_TOOL");
  assert.equal(result.events.at(-1)?.status, "PASS");
});
