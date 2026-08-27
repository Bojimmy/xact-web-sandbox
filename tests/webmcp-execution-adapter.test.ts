import assert from "node:assert/strict";
import test from "node:test";
import {
  AuthorizationArtifactIssuer,
  InMemoryAuthorizationArtifactStore,
  stableFingerprint,
} from "../src/xact/authorization-artifact";
import { DeterministicExecutionRouter } from "../src/execution/execution-router";
import {
  WebMCPExecutionAdapter,
  type WebMCPExecutionClient,
} from "../src/execution/webmcp-execution-adapter";
import type { AuthorizedEffect } from "../src/execution/contracts";
import { BrowserWebMCPExecutionClient } from "../src/execution/browser-webmcp-client";
import { createCommerceSimulationEngine } from "../src/runtime/commerce-engine";

class FakeWebMCPClient implements WebMCPExecutionClient {
  requestCalls = 0;
  observeCalls = 0;

  constructor(
    private readonly available: boolean,
    private readonly failRequest = false,
  ) {}

  isAvailable(): boolean {
    return this.available;
  }

  async requestAction(): Promise<{ receipt: string }> {
    this.requestCalls += 1;
    if (this.failRequest) throw new Error("WebMCP transport offline");
    return { receipt: "webmcp-receipt-1" };
  }

  async observeAction(receipt: string) {
    this.observeCalls += 1;
    return {
      substrate: "WEBMCP" as const,
      receipt,
      target: "order:XC-MUTABLE/refund",
      effectFingerprint: stableFingerprint({ type: "REFUND", amount: 42, rail: "ORIGINAL", target: "order:XC-MUTABLE/refund" }),
      observedAtEpochMs: 1_788_000_000_000,
    };
  }
}

function setupEffect(client: WebMCPExecutionClient) {
  const store = new InMemoryAuthorizationArtifactStore();
  const issuer = new AuthorizationArtifactIssuer(store);
  const payload = { type: "REFUND", amount: 42, rail: "ORIGINAL", target: "order:XC-MUTABLE/refund" };
  const artifact = issuer.issue({
    commitId: "commit:webmcp:1",
    effectFingerprint: stableFingerprint(payload),
    baseStateFingerprint: "state:1",
    actor: "support.agent",
    capability: "refund:create",
  });
  const effect: AuthorizedEffect = { artifact, substrate: "WEBMCP", payload };
  return { adapter: new WebMCPExecutionAdapter(client, store), artifact, effect };
}

test("WebMCP adapter executes a valid authorized effect and observes the actual tool record", async () => {
  const client = new FakeWebMCPClient(true);
  const { adapter, artifact, effect } = setupEffect(client);

  const validation = await adapter.validate(artifact, effect.payload, "state:1");
  assert.equal(validation.valid, true);

  const execution = await adapter.execute(effect);
  assert.equal(execution.executed, true);
  assert.equal(execution.substrate, "WEBMCP");
  assert.equal(execution.receipt, "webmcp-receipt-1");
  assert.equal(client.requestCalls, 1);

  const observed = await adapter.observe(effect, execution);
  assert.deepEqual(observed, {
    substrate: "WEBMCP",
    receipt: "webmcp-receipt-1",
    target: "order:XC-MUTABLE/refund",
    effectFingerprint: stableFingerprint(effect.payload),
    observedAtEpochMs: 1_788_000_000_000,
  });
  assert.equal(client.observeCalls, 1);
});

test("WebMCP unavailable fails closed at routing and does not invoke reasoning or another adapter", async () => {
  const client = new FakeWebMCPClient(false);
  const { adapter, effect } = setupEffect(client);
  const router = new DeterministicExecutionRouter();

  assert.equal(adapter.canHandle(effect), false);
  const selection = await router.select(effect, [adapter]);

  assert.equal(selection.adapter, null);
  assert.match(selection.reason, /no capable adapter|fail closed/i);
  assert.equal(client.requestCalls, 0);
});

test("a WebMCP transport failure never fabricates execution success", async () => {
  const client = new FakeWebMCPClient(true, true);
  const { adapter, artifact, effect } = setupEffect(client);

  const validation = await adapter.validate(artifact, effect.payload, "state:1");
  assert.equal(validation.valid, true);
  const execution = await adapter.execute(effect);

  assert.equal(execution.executed, false);
  assert.equal(execution.receipt, undefined);
  assert.match(execution.error ?? "", /offline/i);
  assert.equal(client.requestCalls, 1);
});

test("a replay is blocked before a second WebMCP request is sent", async () => {
  const client = new FakeWebMCPClient(true);
  const { adapter, artifact, effect } = setupEffect(client);

  assert.equal((await adapter.validate(artifact, effect.payload, "state:1")).valid, true);
  assert.equal((await adapter.execute(effect)).executed, true);
  assert.equal((await adapter.execute(effect)).executed, false);
  assert.equal(client.requestCalls, 1);
});

test("browser WebMCP client feature-detects the standard document API and reads tool observations", async () => {
  const calls: Array<{ tool: string | undefined; input: unknown }> = [];
  const client = new BrowserWebMCPExecutionClient({
    modelContext: {
      async getTools() {
        return [{ name: "request_action" }, { name: "get_execution_observation" }];
      },
      async executeTool(tool, input) {
        calls.push({ tool: tool.name, input: JSON.parse(input) });
        return tool.name === "request_action"
          ? { receipt: "browser-webmcp-receipt-1" }
          : {
              substrate: "WEBMCP",
              receipt: "browser-webmcp-receipt-1",
              target: "order:XC-MUTABLE/refund",
              effectFingerprint: stableFingerprint(effect.payload),
              observedAtEpochMs: 1_788_000_000_000,
            };
      },
    },
  });
  const { effect } = setupEffect(client);

  assert.equal(client.isAvailable(), true);
  const requested = await client.requestAction(effect);
  const observed = await client.observeAction(requested.receipt);

  assert.equal(requested.receipt, "browser-webmcp-receipt-1");
  assert.deepEqual(observed, {
    substrate: "WEBMCP",
    receipt: "browser-webmcp-receipt-1",
    target: "order:XC-MUTABLE/refund",
    effectFingerprint: stableFingerprint(effect.payload),
    observedAtEpochMs: 1_788_000_000_000,
  });
  assert.deepEqual(calls, [
    {
      tool: "request_action",
      input: { authorizationArtifact: effect.artifact, effect: effect.payload },
    },
    {
      tool: "get_execution_observation",
      input: { receipt: "browser-webmcp-receipt-1" },
    },
  ]);
});

test("browser WebMCP client does not pretend an absent modelContext is available", () => {
  const client = new BrowserWebMCPExecutionClient({});
  assert.equal(client.isAvailable(), false);
});

test("unavailable WebMCP records a failed-closed runtime outcome without applying an effect", async () => {
  const store = new InMemoryAuthorizationArtifactStore();
  const engine = createCommerceSimulationEngine({
    store,
    executionAdapter: new WebMCPExecutionAdapter(new FakeWebMCPClient(false), store),
  });
  let session = await engine.resolve(engine.createSession());
  session = await engine.commit(session);
  const balanceBefore = session.currentState.refundableBalance;

  session = await engine.executeAndVerify(session);

  assert.equal(session.decision?.status, "AUTHORIZED");
  assert.equal(session.phase, "EXECUTION_FAILED");
  assert.equal(session.execution?.executed, false);
  assert.equal(session.verification, undefined);
  assert.equal(session.currentState.refundableBalance, balanceBefore);
  assert.match(session.trace.at(-1)?.detail ?? "", /fail closed/i);
});

test("a WebMCP transport failure is visible as no effect, not verified success", async () => {
  const store = new InMemoryAuthorizationArtifactStore();
  const engine = createCommerceSimulationEngine({
    store,
    executionAdapter: new WebMCPExecutionAdapter(new FakeWebMCPClient(true, true), store),
  });
  let session = await engine.resolve(engine.createSession());
  session = await engine.commit(session);
  const refundedBefore = session.currentState.refundedAmount;

  session = await engine.executeAndVerify(session);

  assert.equal(session.phase, "EXECUTION_FAILED");
  assert.equal(session.execution?.executed, false);
  assert.equal(session.verification, undefined);
  assert.equal(session.currentState.refundedAmount, refundedBefore);
  assert.match(session.execution?.error ?? "", /offline/i);
});
