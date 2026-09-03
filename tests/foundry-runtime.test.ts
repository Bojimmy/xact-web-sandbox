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

function governedReassignmentTool() {
  return composeWebMCPTool(describeCapability({
    id: "reassign_support_ticket",
    capabilityKind: "MUTATION",
    label: "Reassign support ticket when policy permits",
    inputs: ["ticketId", "newOwner", "ownerUnavailable", "requiredSkillMismatch"],
    resolves: ["ticket-reassigned"],
    boundaries: [
      { primitive: "ACTOR_BINDING", description: "Only service recovery may reassign.", actor: "SERVICE_RECOVERY" },
      { primitive: "STATE_BINDING", description: "Owner unavailable or required skill mismatch." },
      { primitive: "CONFIRMATION_REQUIREMENT", description: "Explicit confirmation required." },
      { primitive: "AUDIT_EVENT", description: "Audit required." },
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

test("a required READ input cannot silently broaden a query", async () => {
  const registry = new FoundryToolRegistry();
  registry.add(readTool());
  let reads = 0;
  const runtime = new FoundryRuntime(
    registry,
    () => { reads += 1; return { customerId: "1042" }; },
    () => ({ authorized: false }),
    () => undefined,
  );

  await assert.rejects(() => runtime.invoke("find_customer_by_email", { email: "" }), /Missing required input: email/);
  assert.equal(reads, 0);
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

test("support-ticket reassignment requires owner-unavailable or skill-mismatch evidence", async () => {
  const tool = governedReassignmentTool();
  const commit = createMutationCommitEngine();
  const base = { actor: "SERVICE_RECOVERY", ticketId: "SUP-918", newOwner: "FIELD OPS", confirmation: true };
  const denied = await commit(tool, base);
  assert.equal(denied.authorized, false);
  assert.match(denied.reason ?? "", /owner unavailable or required skill mismatch/i);
  const allowed = await commit(tool, { ...base, ownerUnavailable: true });
  assert.equal(allowed.authorized, true);
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
