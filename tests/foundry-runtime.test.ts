import assert from "node:assert/strict";
import test from "node:test";
import { FoundryRuntime, FoundryToolRegistry } from "../src/flagship/foundry-runtime";
import { createMutationCommitEngine } from "../src/flagship/foundry-mutation-commit";
import { composeWebMCPTool } from "../src/flagship/webmcp-tool-builder";
import { describeCapability } from "../src/flagship/capability-vocabulary";
import { WebMCPDispatchRegistry } from "../src/execution/webmcp-dispatch";
import type { AuthorizedEffect } from "../src/execution/contracts";
import type { AuthorizationArtifact } from "../src/xact/contracts";

function readTool() {
  return composeWebMCPTool(describeCapability({
    id: "find_customer_by_email",
    capabilityKind: "READ",
    label: "Find a customer by email",
    inputs: ["email"],
    resolves: ["customerId", "name"],
  }));
}

function mutationTool() {
  return composeWebMCPTool(describeCapability({
    id: "issue_service_credit",
    capabilityKind: "MUTATION",
    label: "Issue a service credit up to $25",
    inputs: ["customerId", "amount"],
    resolves: ["receipt"],
  }));
}

function governedMutationTool() {
  return composeWebMCPTool(describeCapability({
    id: "issue_service_credit",
    capabilityKind: "MUTATION",
    label: "Issue a service credit up to $25",
    inputs: ["customerId", "amount"],
    resolves: ["receipt"],
    boundaries: [
      { primitive: "ACTOR_BINDING", description: "Only the bound support agent may issue.", actor: "support.agent" },
      { primitive: "COMMIT_BOUNDARY", description: "Amount must not exceed $25.", limit: { operator: "<=", value: 25 } },
      { primitive: "CONFIRMATION_REQUIREMENT", description: "Explicit confirmation required." },
    ],
  }));
}

function freshEffect(payload: unknown = { customerId: "1042", amount: 25 }): AuthorizedEffect {
  const artifact: AuthorizationArtifact = {
    commitId: "commit:runtime",
    effectFingerprint: "fp:runtime",
    baseStateFingerprint: "bs:runtime",
    actor: "support.agent",
    capability: "issue_service_credit",
    nonce: "nonce:runtime",
    issuedAtEpochMs: 1,
    expiresAtEpochMs: 9_000_000_000_000,
  };
  return { artifact, substrate: "WEBMCP", payload };
}

test("a READ tool on the shelf resolves through the deterministic substrate", async () => {
  const registry = new FoundryToolRegistry();
  registry.add(readTool());

  const runtime = new FoundryRuntime(
    registry,
    () => ({ customerId: "1042", name: "Ada" }),
    () => ({ authorized: false }),
    () => {
      throw new Error("applyEffect must not run for a READ");
    },
  );

  const result = await runtime.invoke("find_customer_by_email", { email: "ada@example.com" });
  assert.equal(result.status, "READ_RESULT");
  assert.deepEqual(result.result, { customerId: "1042", name: "Ada" });
  assert.equal(result.effectFingerprint, undefined);
  assert.ok(result.audit.length >= 1);
});

test("a MUTATION without a fresh Commit blocks with no effect", async () => {
  const registry = new FoundryToolRegistry();
  registry.add(mutationTool());

  let applied = false;
  const runtime = new FoundryRuntime(
    registry,
    () => undefined,
    () => ({ authorized: false, reason: "no Commit decision" }),
    () => {
      applied = true;
      return { receipt: "applied" };
    },
  );

  const result = await runtime.invoke("issue_service_credit", { customerId: "1042", amount: 25 });
  assert.equal(result.status, "BLOCKED_NO_AUTHORITY");
  assert.equal(result.result, undefined);
  assert.equal(applied, false);
  assert.ok(result.audit[0].includes("no fresh Commit authorization"));
});

test("a MUTATION with a fresh Commit runs exact dispatch then the effect", async () => {
  const registry = new FoundryToolRegistry();
  registry.add(mutationTool());

  const effect = freshEffect();
  const runtime = new FoundryRuntime(
    registry,
    () => undefined,
    () => ({ authorized: true, effect }),
    (_tool, _input, artifact) => ({ receipt: `credit-issued:${artifact.nonce}` }),
    new WebMCPDispatchRegistry(),
  );

  const result = await runtime.invoke("issue_service_credit", { customerId: "1042", amount: 25 });
  assert.equal(result.status, "AUTHORIZED_EFFECT");
  assert.deepEqual(result.result, { receipt: "credit-issued:nonce:runtime" });
  assert.equal(result.effectFingerprint, "fp:runtime");
  assert.ok(result.audit.some((line) => line.includes("exact dispatch authorized")));
});

test("every MUTATION invocation requests a fresh Commit decision", async () => {
  const registry = new FoundryToolRegistry();
  registry.add(mutationTool());

  let commits = 0;
  const runtime = new FoundryRuntime(
    registry,
    () => undefined,
    () => {
      commits += 1;
      return { authorized: true, effect: freshEffect({ customerId: "1042", amount: commits }) };
    },
    () => ({ receipt: "applied" }),
  );

  await runtime.invoke("issue_service_credit", { customerId: "1042", amount: 1 });
  await runtime.invoke("issue_service_credit", { customerId: "1042", amount: 2 });
  assert.equal(commits, 2);
});

test("an unknown tool name fails closed with no effect", async () => {
  const registry = new FoundryToolRegistry();
  const runtime = new FoundryRuntime(
    registry,
    () => undefined,
    () => ({ authorized: true, effect: freshEffect() }),
    () => ({ receipt: "applied" }),
  );

  await assert.rejects(() => runtime.invoke("not_on_the_shelf", {}), /not on the Foundry shelf/);
});

test("the real Commit engine enforces actor, ceiling, and confirmation per invocation", async () => {
  const registry = new FoundryToolRegistry();
  registry.add(governedMutationTool());

  const runtime = new FoundryRuntime(
    registry,
    () => undefined,
    createMutationCommitEngine(),
    (_tool, input, artifact) => ({ receipt: `applied:${artifact.nonce}`, amount: (input as { amount: number }).amount }),
  );

  const ok = await runtime.invoke("issue_service_credit", { customerId: "1042", amount: 25, actor: "support.agent", confirmation: true });
  assert.equal(ok.status, "AUTHORIZED_EFFECT");
  assert.ok(ok.effectFingerprint);
  assert.ok((ok.result as { receipt: string }).receipt.startsWith("applied:nonce:"));

  const overCeiling = await runtime.invoke("issue_service_credit", { customerId: "1042", amount: 999, actor: "support.agent", confirmation: true });
  assert.equal(overCeiling.status, "BLOCKED_NO_AUTHORITY");
  assert.ok(overCeiling.audit[0].includes("exceeds ceiling"));

  const wrongActor = await runtime.invoke("issue_service_credit", { customerId: "1042", amount: 10, actor: "intruder", confirmation: true });
  assert.equal(wrongActor.status, "BLOCKED_NO_AUTHORITY");
  assert.ok(wrongActor.audit[0].includes("not the bound actor"));

  const noConfirmation = await runtime.invoke("issue_service_credit", { customerId: "1042", amount: 10, actor: "support.agent", confirmation: false });
  assert.equal(noConfirmation.status, "BLOCKED_NO_AUTHORITY");
  assert.ok(noConfirmation.audit[0].includes("Explicit confirmation required"));
});
