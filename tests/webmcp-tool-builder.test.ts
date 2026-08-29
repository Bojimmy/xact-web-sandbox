import assert from "node:assert/strict";
import test from "node:test";
import {
  composeWebMCPTool,
  type WebMCPToolDefinition,
} from "../src/flagship/webmcp-tool-builder";
import {
  describeCapability,
  type GovernedCapabilityDescriptor,
} from "../src/flagship/capability-vocabulary";
import type { ActivatedResolutionAuthority, CommitAuthorization } from "../src/flagship/authority-contracts";

function readDescriptor(): GovernedCapabilityDescriptor {
  return describeCapability({
    id: "get_audit_history",
    capabilityKind: "READ",
    label: "Read customer audit history",
    inputs: ["customerId"],
    resolves: ["service-history"],
  });
}

function mutationDescriptor(): GovernedCapabilityDescriptor {
  return describeCapability({
    id: "issue_service_credit",
    capabilityKind: "MUTATION",
    label: "Issue customer service credit",
    inputs: ["customerId", "amount", "reason"],
    resolves: ["credit-applied"],
    boundaries: [
      { primitive: "ACTOR_BINDING", description: "actor requires SERVICE_RECOVERY", actor: "SERVICE_RECOVERY" },
      { primitive: "COMMIT_BOUNDARY", description: "amount must not exceed $25", limit: { operator: "<=", value: 25 } },
      { primitive: "AUDIT_EVENT", description: "audit event required", auditRequired: true },
      { primitive: "SESSION_REQUIREMENT", description: "account freshness required", freshnessRequired: true },
    ],
  });
}

test("the composer builds a READ tool with an input/output schema and no execute", () => {
  const tool = composeWebMCPTool(readDescriptor());

  assert.equal(tool.kind, "WEBMCP_TOOL_DEFINITION");
  assert.equal(tool.name, "get_audit_history");
  assert.equal(tool.description, "Read customer audit history");
  assert.equal(tool.capabilityKind, "READ");
  assert.equal(tool.requiresCommit, false);

  assert.deepEqual(tool.inputSchema.required, ["customerId"]);
  assert.equal(tool.inputSchema.properties.customerId.type, "string");
  assert.deepEqual(tool.outputSchema.required, ["service-history"]);

  assert.equal("execute" in tool, false);
  assert.equal("authorize" in tool, false);
  assert.equal("artifact" in tool, false);
});

test("the composer builds a MUTATION tool carrying its governed boundaries", () => {
  const tool = composeWebMCPTool(mutationDescriptor());

  assert.equal(tool.capabilityKind, "MUTATION");
  assert.equal(tool.requiresCommit, true);
  assert.deepEqual(tool.inputSchema.required, ["customerId", "amount", "reason"]);

  // MUTATION output includes the commit evidence fields.
  assert.deepEqual(tool.outputSchema.required, ["receipt", "effectFingerprint", "credit-applied"]);

  // The governed boundaries are carried into the tool, not stripped.
  assert.equal(tool.boundaries.length, 4);
  assert.equal(tool.boundaries.find((b) => b.primitive === "ACTOR_BINDING")?.actor, "SERVICE_RECOVERY");
  assert.deepEqual(tool.boundaries.find((b) => b.primitive === "COMMIT_BOUNDARY")?.limit, { operator: "<=", value: 25 });

  // requiresCommit is a boundary flag, not an execute grant.
  assert.equal("execute" in tool, false);
});

test("the composed tool definition is descriptive only — never authority", () => {
  const tool = composeWebMCPTool(mutationDescriptor());

  // @ts-expect-error a WebMCP tool definition is never Commit authority.
  const notCommit: CommitAuthorization = tool;
  void notCommit;

  // @ts-expect-error a WebMCP tool definition is never resolution authority.
  const notResolution: ActivatedResolutionAuthority = tool;
  void notResolution;

  assert.ok(Object.values(tool).every((value) => typeof value !== "function"));
});

test("the composer rejects an unrecognized descriptor", () => {
  const invalid = {
    kind: "GOVERNED_CAPABILITY_DESCRIPTOR",
    id: "x",
    capabilityKind: "READ",
    label: "x",
    inputs: ["a"],
    resolves: ["b"],
    boundaries: [{ primitive: "FREE_FORM_CODE", description: "not in vocabulary" }],
  } as unknown as GovernedCapabilityDescriptor;

  assert.throws(() => composeWebMCPTool(invalid), /unrecognized descriptor/);
});

test("constructing a tool does not authorize it: the descriptor is the seed, not the grant", () => {
  const descriptor = mutationDescriptor();
  const tool = composeWebMCPTool(descriptor);

  // The tool knows its name, schema, and boundaries — but it cannot act.
  assert.equal(tool.name, "issue_service_credit");
  assert.equal(tool.requiresCommit, true);
  assert.equal(typeof (tool as unknown as { execute?: unknown }).execute, "undefined");

  // The source descriptor remains descriptive-only too.
  const definition: WebMCPToolDefinition = tool;
  assert.equal(definition.kind, "WEBMCP_TOOL_DEFINITION");
});
