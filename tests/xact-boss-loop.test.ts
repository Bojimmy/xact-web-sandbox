import assert from "node:assert/strict";
import test from "node:test";
import { startCapabilityBuild, getBossRequest, submitBossResolution } from "../src/chatgpt-app/xact-boss-loop";
import { createXactMcpServer } from "../src/chatgpt-app/xact-mcp-server";

test("the MCP server exposes the Boss tools plus construction and runtime-read surfaces", () => {
  const server = createXactMcpServer() as unknown as { _registeredTools: Record<string, unknown> };
  const names = Object.keys(server._registeredTools);
  for (const name of ["start_capability_build", "get_boss_request", "submit_boss_resolution"]) {
    assert.ok(names.includes(name), `missing tool ${name}; got ${names.join(", ")}`);
  }
  for (const name of ["list_xact_capabilities", "construct_xact_tool", "read_xact_capability"]) {
    assert.ok(names.includes(name), `tool ${name} must remain; got ${names.join(", ")}`);
  }
});

test("a declared equivalent builds immediately without a Boss round-trip", async () => {
  const started = await startCapabilityBuild("Build a WebMCP tool that keeps me updated on user stats and user requests");
  assert.equal(started.status, "BUILT");
  assert.equal((started.result as { capabilityId: string }).capabilityId, "read_active_users_and_open_requests");
});

test("a deterministic intent starts BUILT and constructs without the Boss", async () => {
  const started = await startCapabilityBuild("Build a WebMCP tool to read the employee organization directory");
  assert.equal(started.status, "BUILT");
  assert.equal(started.unresolved, undefined);
});

test("a refused capability starts BLOCKED", async () => {
  const started = await startCapabilityBuild("Build a WebMCP tool that lets any agent delete any customer");
  assert.equal(started.status, "BLOCKED");
});

test("a close request returns a concise governed shortlist instead of the whole catalog", async () => {
  const started = await startCapabilityBuild("Build a customer operations overview");
  assert.equal(started.status, "CLARIFICATION_REQUIRED");
  assert.equal(started.unresolved?.[0].id, "select-capability");
  assert.ok((started.clarification?.candidates.length ?? 0) >= 2);
  assert.ok((started.clarification?.candidates.length ?? 0) <= 3);

  const context = await getBossRequest(started.runId);
  assert.equal(context.userIntent, "Build a customer operations overview");
  assert.equal(context.unresolved.length, 1);
  assert.equal(context.selectionCandidates?.length, started.clarification?.candidates.length);
  assert.ok((context.selectionCandidates?.length ?? 0) <= 3);
});

test("a shortlist selection re-enters Xact and rejects choices outside the shortlist", async () => {
  const started = await startCapabilityBuild("Build a customer operations overview");
  assert.equal(started.status, "CLARIFICATION_REQUIRED");
  const context = await getBossRequest(started.runId);
  const rejected = await submitBossResolution(started.runId, [{
    unresolvedId: context.unresolved[0].id,
    resolution: { capabilityId: "get_employee_directory" },
  }]);
  assert.equal(rejected.status, "BLOCKED");

  const submitted = await submitBossResolution(started.runId, [{
    unresolvedId: context.unresolved[0].id,
    resolution: { capabilityId: context.selectionCandidates![0].id },
  }]);

  assert.equal(submitted.status, "BUILT");
  const result = submitted.result as {
    capabilityId: string;
    definition: { name: string; capabilityKind: string; requiresCommit: boolean };
    activity: { type: string }[];
  };
  assert.equal(result.capabilityId, context.selectionCandidates![0].id);
  assert.equal(result.definition.name, context.selectionCandidates![0].id);
  assert.equal(result.definition.capabilityKind, "READ");
  assert.equal(result.definition.requiresCommit, false);
  assert.ok(!result.activity.some((event) => event.type === "REASON_STARTED"));
});

test("an unsupported order-status request blocks immediately with a productive candidate build brief", async () => {
  const started = await startCapabilityBuild("Build a WebMCP tool that looks up a customer order status by order ID");
  assert.equal(started.status, "BLOCKED");
  assert.match(started.reason ?? "", /will not substitute/i);
  assert.equal(started.candidateBuildBrief?.status, "CANDIDATE_BUILD_BRIEF");
  assert.equal(started.candidateBuildBrief?.publicSafeScope, "READ_ONLY");
  assert.equal(started.unresolved, undefined);
});

test("a genuine-U capability re-enters with the Boss interpretation and never fires the internal LLM", async () => {
  const started = await startCapabilityBuild("Build a WebMCP tool that lets support agents issue a service credit up to $25");
  assert.equal(started.status, "WAITING_FOR_BOSS");
  assert.ok((started.unresolved?.length ?? 0) >= 1);

  const context = await getBossRequest(started.runId);
  const resolutions = context.unresolved.map((u) => ({
    unresolvedId: u.id,
    resolution: { interpretation: `Attested: ${u.question}` },
  }));
  const submitted = await submitBossResolution(started.runId, resolutions);

  assert.equal(submitted.status, "BUILT");
  const result = submitted.result as {
    capabilityId: string;
    definition: { capabilityKind: string; requiresCommit: boolean };
    activity: { type: string; label: string }[];
  };
  assert.equal(result.capabilityId, "issue_service_credit");
  assert.equal(result.definition.capabilityKind, "MUTATION");
  assert.equal(result.definition.requiresCommit, true);
  // REASON_STARTED is the internal-LLM marker; it must never appear.
  assert.ok(!result.activity.some((event) => event.type === "REASON_STARTED"));
  assert.ok(result.activity.some((event) => event.type === "REASON_EVIDENCE" && event.label === "Boss"));
  assert.ok(result.activity.some((event) => event.type === "RE_ENTRY"));
});

test("an incomplete resolution returns MORE_REASONING_REQUIRED", async () => {
  const started = await startCapabilityBuild("Build a WebMCP tool that lets support agents issue a service credit up to $25");
  const submitted = await submitBossResolution(started.runId, []);
  assert.equal(submitted.status, "MORE_REASONING_REQUIRED");
  assert.ok((submitted.unresolved?.length ?? 0) >= 1);
});
