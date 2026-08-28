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
import type { AuthorizedEffect, ExecutionObservation } from "../src/execution/contracts";
import { BrowserDOMExecutionClient } from "../src/execution/browser-dom-client";
import { BrowserWebMCPExecutionClient, BrowserWebMCPToolHost } from "../src/execution/browser-webmcp-client";
import { WebMCPDispatchRegistry } from "../src/execution/webmcp-dispatch";
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

class ObservationFailingWebMCPClient implements WebMCPExecutionClient {
  isAvailable() { return true; }
  async requestAction() { return { receipt: "ambiguous-webmcp-receipt" }; }
  async observeAction(): Promise<ExecutionObservation> { throw new Error("Post-effect tool observation timed out"); }
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

test("a present WebMCP substrate with an absent action tool fails distinctly from substrate unavailability", async () => {
  const store = new InMemoryAuthorizationArtifactStore();
  const client = new BrowserWebMCPExecutionClient({
    modelContext: {
      async getTools() { return []; },
      async executeTool() { throw new Error("must not execute without a discovered tool"); },
    },
  });
  const engine = createCommerceSimulationEngine({
    store,
    executionAdapter: new WebMCPExecutionAdapter(client, store),
  });
  let session = await engine.resolve(engine.createSession());
  session = await engine.commit(session);
  session = await engine.executeAndVerify(session);

  assert.equal(session.phase, "EXECUTION_FAILED");
  assert.equal(session.execution?.executed, false);
  assert.equal(session.execution?.receipt, undefined);
  assert.match(session.execution?.error ?? "", /Required WebMCP tool is unavailable/i);
  assert.match(session.trace.at(-1)?.detail ?? "", /tool is unavailable/i);
});

test("registered WebMCP action rejects direct input and claims only an adapter-prepared dispatch", async () => {
  const { effect } = setupEffect(new FakeWebMCPClient(true));
  const tools = new Map<string, { execute(input: unknown): Promise<unknown> }>();
  const attributes = new Map<string, string>();
  const element = {
    click() {
      attributes.set("data-xact-receipt", "registered-webmcp-receipt");
      attributes.set("data-xact-effect-fingerprint", stableFingerprint(effect.payload));
    },
    getAttribute(name: string) { return attributes.get(name) ?? null; },
  };
  const modelContext = {
    async getTools() { return []; },
    async executeTool() { return null; },
    async registerTool(tool: { name?: string; execute(input: unknown): Promise<unknown> }) {
      tools.set(tool.name ?? "", tool);
    },
  };
  const registry = new WebMCPDispatchRegistry();
  const host = new BrowserWebMCPToolHost(
    registry,
    new BrowserDOMExecutionClient({ querySelector: () => element }),
    { modelContext },
  );
  const dispose = await host.register();
  const action = tools.get("request_action")!;
  const observe = tools.get("get_execution_observation")!;
  const input = { authorizationArtifact: effect.artifact, effect: effect.payload };

  await assert.rejects(() => action.execute(input), /no matching Xact-prepared dispatch/i);
  assert.equal(attributes.size, 0);
  registry.prepare(effect);
  const result = await action.execute(input) as { receipt: string };
  const observation = await observe.execute({ receipt: result.receipt });

  assert.equal(result.receipt, "registered-webmcp-receipt");
  assert.deepEqual(observation, {
    substrate: "WEBMCP",
    receipt: "registered-webmcp-receipt",
    target: "order:XC-MUTABLE/refund",
    effectFingerprint: stableFingerprint(effect.payload),
    observedAtEpochMs: (observation as { observedAtEpochMs: number }).observedAtEpochMs,
  });
  dispose();
});

test("failed WebMCP observation with a receipt is ambiguous, not a no-effect failure", async () => {
  const store = new InMemoryAuthorizationArtifactStore();
  const engine = createCommerceSimulationEngine({
    store,
    executionAdapter: new WebMCPExecutionAdapter(new ObservationFailingWebMCPClient(), store),
  });
  let session = await engine.resolve(engine.createSession());
  session = await engine.commit(session);
  const balanceBefore = session.currentState.refundableBalance;
  const nonce = session.decision?.artifact?.nonce;
  session = await engine.executeAndVerify(session);

  assert.equal(session.phase, "OBSERVATION_FAILED");
  assert.equal(session.execution?.executed, true);
  assert.equal(session.execution?.receipt, "ambiguous-webmcp-receipt");
  assert.equal(session.verification, undefined);
  assert.equal(session.currentState.refundableBalance, balanceBefore);
  assert.equal(store.nonceConsumed(nonce ?? ""), true);
  assert.equal(session.trace.at(-1)?.outcome, "OBSERVATION_FAILED");
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
