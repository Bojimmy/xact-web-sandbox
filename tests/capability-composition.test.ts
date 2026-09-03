import assert from "node:assert/strict";
import test from "node:test";
import { validateComposition, activateComposition, declaredCompositionCapabilityIds } from "../src/chatgpt-app/capability-composition";
import { FOUNDRY_CATALOG } from "../src/flagship/foundry-catalog";
import { XactFoundryLiaison } from "../src/flagship/foundry-liaison";
import { createXactMcpServer } from "../src/chatgpt-app/xact-mcp-server";

test("the fast path declares a canonical composition for every absorbed catalog recipe", () => {
  const declared = new Set(declaredCompositionCapabilityIds());
  for (const entry of FOUNDRY_CATALOG) {
    assert.ok(declared.has(entry.id), `missing canonical composition for ${entry.id}`);
  }
});

test("the catalog fast path: an exact governed composition resolves ALREADY_GOVERNED", () => {
  const result = validateComposition({
    capability: "READ",
    resource: ["EMPLOYEE"],
    operation: ["LIST"],
    output: ["EMPLOYEE_ID", "NAME", "ROLE"],
  });
  assert.equal(result.outcome, "ALREADY_GOVERNED");
  if (result.outcome === "ALREADY_GOVERNED") assert.equal(result.capabilityId, "get_employee_directory");
});

test("the dispatch coverage-gap composition resolves ALREADY_GOVERNED from its declared atoms", () => {
  const result = validateComposition({
    capability: "READ",
    resource: ["WORK_ORDER"],
    operation: ["LIST"],
    filter: ["PRIORITY_URGENT", "QUALIFIED_OWNER_UNAVAILABLE"],
    sort: "DUE_TIME_ASC",
    output: ["OWNER", "QUALIFIED_OWNER_AVAILABLE", "DUE_TIME", "STATUS"],
  });
  assert.equal(result.outcome, "ALREADY_GOVERNED");
  if (result.outcome === "ALREADY_GOVERNED") assert.equal(result.capabilityId, "get_urgent_work_orders_unqualified_owner");
});

test("test 1: a valid composition with no catalog phrase and no capabilityId is accepted (COMPOSABLE) and crosses Commit", async () => {
  const composition = {
    actor: "SUPPORT_AGENT",
    capability: "READ" as const,
    resource: ["CUSTOMER_REQUEST"],
    operation: ["LIST"],
    filter: ["STATUS_OPEN"],
    sort: "WAIT_DURATION_DESC",
    output: ["CUSTOMER_ID", "REQUEST_ID", "WAIT_DURATION"],
    mutation: "NONE" as const,
  };
  const result = validateComposition(composition);
  assert.equal(result.outcome, "COMPOSABLE");
  if (result.outcome !== "COMPOSABLE") return;

  // Must pass the SAME Door/Ledger → AUTHORIZATION → COMMIT → BUILD boundary.
  const build = await new XactFoundryLiaison().buildFromDescriptor(result.descriptor);
  assert.equal(build.outcome, "COMPOSED_DEFINITION");
  assert.ok(build.tool);
  assert.equal(build.tool.capabilityKind, "READ");
  assert.equal("execute" in build.tool, false);
  assert.ok(build.activity.some((event) => event.type === "COMMIT" && event.status === "PASS"));
  assert.ok(build.activity.some((event) => event.type === "BUILD" && event.status === "PASS"));
});

test("test 2: a coherent composition with an ungoverned primitive is rejected (NOVEL_BOUNDARY)", () => {
  const result = validateComposition({
    capability: "READ",
    resource: ["INVENTORY"],
    operation: ["LIST"],
    output: ["NAME"],
  });
  assert.equal(result.outcome, "NOVEL_BOUNDARY");
  if (result.outcome === "NOVEL_BOUNDARY") assert.ok(result.missing.includes("resource:INVENTORY"));
});

test("test 3: a destructive capability is understood but returns UNAUTHORIZED", () => {
  const result = validateComposition({
    actor: "SUPPORT_AGENT",
    capability: "MUTATION",
    resource: ["CUSTOMER"],
    operation: ["LIST"],
    output: ["CUSTOMER_ID"],
    mutation: "DELETE_ACCOUNT",
  });
  assert.equal(result.outcome, "UNAUTHORIZED");
  if (result.outcome === "UNAUTHORIZED") assert.match(result.reason, /no governed approval path/);
});

test("an ambiguous-but-governed composition returns NEEDS_RESOLUTION", () => {
  const result = validateComposition({
    capability: "READ",
    resource: ["CUSTOMER"],
    output: ["CUSTOMER_ID"],
  });
  assert.equal(result.outcome, "NEEDS_RESOLUTION");
  if (result.outcome === "NEEDS_RESOLUTION") assert.match(result.question, /Which operation/);
});

test("invalid combinations are UNAUTHORIZED with a concrete reason", () => {
  assert.equal(validateComposition({
    capability: "MUTATION",
    resource: ["WORK_ORDER"],
    output: ["OWNER"],
    mutation: "REASSIGN",
  }).outcome, "UNAUTHORIZED"); // no actor

  assert.equal(validateComposition({
    capability: "READ",
    resource: ["CUSTOMER"],
    output: ["CUSTOMER_ID"],
    mutation: "ISSUE_CREDIT",
  }).outcome, "UNAUTHORIZED"); // READ carrying a mutation
});

test("the MCP server exposes the composition proposal surface", () => {
  const server = createXactMcpServer() as unknown as { _registeredTools: Record<string, unknown> };
  const names = Object.keys(server._registeredTools);
  assert.ok(names.includes("propose_capability_composition"), `missing propose_capability_composition; got ${names.join(", ")}`);
});

test("activation loop: a novel COMPOSABLE composition, once activated, resolves ALREADY_GOVERNED", () => {
  const novel = {
    capability: "READ" as const,
    resource: ["AUDIT_RECORD"],
    operation: ["LIST"],
    filter: ["OWNER"],
    output: ["AUDIT_ENTRY", "OWNER"],
  };

  // First proposal: governed but not yet absorbed → COMPOSABLE.
  assert.equal(validateComposition(novel).outcome, "COMPOSABLE");

  // Absorption step (governance approves → activate registers the alias).
  const activation = activateComposition(novel, "composed_audit_by_owner");
  assert.equal(activation.activated, true);

  // Second proposal: now the fast path recognizes it — zero re-composition.
  const second = validateComposition(novel);
  assert.equal(second.outcome, "ALREADY_GOVERNED");
  if (second.outcome === "ALREADY_GOVERNED") assert.equal(second.capabilityId, "composed_audit_by_owner");
});

test("a non-COMPOSABLE composition cannot be activated", () => {
  const blocked = activateComposition({
    actor: "SUPPORT_AGENT",
    capability: "MUTATION",
    resource: ["CUSTOMER"],
    operation: ["LIST"],
    output: ["CUSTOMER_ID"],
    mutation: "DELETE_ACCOUNT",
  }, "anything");
  assert.equal(blocked.activated, false);
});
