import assert from "node:assert/strict";
import test from "node:test";
import { buildAndRegister, commitGatedExecute } from "../src/flagship/foundry-build-register";
import { XactFoundryLiaison } from "../src/flagship/foundry-liaison";
import type { FoundryWebMCPHost } from "../src/flagship/webmcp-host-registration";
import { WebMCPDispatchRegistry } from "../src/execution/webmcp-dispatch";
import type { AuthorizedEffect } from "../src/execution/contracts";
import { SecureEndpointOAgentProvider } from "../src/telemetry/o-agent-provider";
import type { AuthorizationArtifact } from "../src/xact/contracts";

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

function liaison(): XactFoundryLiaison {
  return new XactFoundryLiaison(liveProvider());
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

test("a READ capability composes, registers, observes, and verifies", async () => {
  const { host } = recordingHost();
  const result = await buildAndRegister("Find customers by email", {
    liaison: liaison(),
    host,
    executeFor: () => async () => ({ result: "customer" }),
  });

  assert.equal(result.outcome, "WORKING_TOOL");
  assert.ok(result.tool);
  assert.equal(result.tool.capabilityKind, "READ");

  const types = result.activity.map((a) => a.type);
  // No REASON for a read; the build events then the registration events.
  assert.ok(!types.includes("REASON_STARTED"));
  for (const expected of ["RESOLVE", "BUILD", "REGISTER", "OBSERVE", "VERIFY"] as const) {
    assert.ok(types.includes(expected), `missing ${expected}`);
  }
  assert.ok(types.indexOf("BUILD") < types.indexOf("REGISTER"));
  assert.ok(types.indexOf("REGISTER") < types.indexOf("OBSERVE"));
  assert.ok(types.indexOf("OBSERVE") < types.indexOf("VERIFY"));
});

function freshEffect(): AuthorizedEffect {
  const artifact: AuthorizationArtifact = {
    commitId: "commit:fresh",
    effectFingerprint: "fp",
    baseStateFingerprint: "bs",
    actor: "support.agent",
    capability: "issue_service_credit",
    nonce: "nonce:fresh",
    issuedAtEpochMs: 1,
    expiresAtEpochMs: 9_000_000_000_000,
  };
  return { artifact, substrate: "WEBMCP", payload: { customerId: "1042", amount: 25 } };
}

test("a MUTATION registers but direct invocation without fresh Commit fails closed", async () => {
  const { host, registered } = recordingHost();
  const registry = new WebMCPDispatchRegistry();
  const result = await buildAndRegister("Build a tool that issues a service credit up to $25", {
    liaison: liaison(),
    host,
    executeFor: () => commitGatedExecute((input) => registry.claim(input)), // nothing prepared
  });

  assert.equal(result.outcome, "WORKING_TOOL");
  assert.equal(registered.length, 1);

  // The registered handler is Commit-gated: no prepared dispatch → fail closed.
  await assert.rejects(
    () => registered[0].execute({ customerId: "1042", amount: 25 }),
    /No fresh Commit authorization/,
  );
});

test("a MUTATION with a prepared exact dispatch is authorized, not executed", async () => {
  const { host, registered } = recordingHost();
  const registry = new WebMCPDispatchRegistry();
  const effect = freshEffect();
  registry.prepare(effect);

  await buildAndRegister("Build a tool that issues a service credit up to $25", {
    liaison: liaison(),
    host,
    executeFor: () => commitGatedExecute((input) => registry.claim(input)),
  });

  const out = await registered[0].execute({ authorizationArtifact: effect.artifact, effect: effect.payload });
  assert.deepEqual(out, { authorized: true, artifact: effect.artifact });
});

test("a tampered artifact/effect input fails before authorization", async () => {
  const { host, registered } = recordingHost();
  const registry = new WebMCPDispatchRegistry();
  const effect = freshEffect();
  registry.prepare(effect);

  await buildAndRegister("Build a tool that issues a service credit up to $25", {
    liaison: liaison(),
    host,
    executeFor: () => commitGatedExecute((input) => registry.claim(input)),
  });

  // Tampered effect (wrong amount) fails the exact match → fail closed.
  await assert.rejects(
    () => registered[0].execute({ authorizationArtifact: effect.artifact, effect: { customerId: "1042", amount: 999 } }),
    /No fresh Commit authorization/,
  );
});

test("a pending-governance request never registers", async () => {
  const { host, registered } = recordingHost();
  const result = await buildAndRegister("Keep me updated on user stats and requests", {
    liaison: liaison(),
    host,
  });

  assert.equal(result.outcome, "PENDING_GOVERNANCE");
  assert.equal(result.registration, undefined);
  assert.equal(registered.length, 0);
});

test("a refusal never registers", async () => {
  const { host, registered } = recordingHost();
  const result = await buildAndRegister("Build a WebMCP tool that lets any agent delete any customer", {
    liaison: liaison(),
    host,
  });

  assert.equal(result.outcome, "BLOCKED");
  assert.equal(registered.length, 0);
});

test("a verification mismatch produces REGISTRATION_FAILED, not a working-tool claim", async () => {
  const host: FoundryWebMCPHost = {
    async registerTool() {},
    async getTools() {
      return [{ name: "find_customer_by_email", description: "wrong", inputSchema: { type: "object", properties: {}, required: [] } }];
    },
  };
  const result = await buildAndRegister("Find customers by email", {
    liaison: liaison(),
    host,
    executeFor: () => async () => ({ result: "customer" }),
  });

  assert.equal(result.outcome, "REGISTRATION_FAILED");
  assert.ok(result.activity.some((a) => a.type === "VERIFY" && a.status === "BLOCK"));
});
