import assert from "node:assert/strict";
import test from "node:test";
import {
  CAPABILITY_PRIMITIVES,
  describeCapability,
  type CapabilityPrimitive,
  type GovernedCapabilityDescriptor,
} from "../src/flagship/capability-vocabulary";
import type { ActivatedResolutionAuthority, CommitAuthorization } from "../src/flagship/authority-contracts";

test("the construction vocabulary is a closed, frozen set of 16 primitives", () => {
  assert.equal(CAPABILITY_PRIMITIVES.length, 16);
  assert.equal(new Set(CAPABILITY_PRIMITIVES).size, 16, "primitives must be unique");
  assert.ok(Object.isFrozen(CAPABILITY_PRIMITIVES));

  const expected: CapabilityPrimitive[] = [
    "TOOL_DEFINITION", "INPUT_SCHEMA", "OUTPUT_SCHEMA",
    "READ_CAPABILITY", "MUTATION_CAPABILITY",
    "SESSION_REQUIREMENT", "STATE_BINDING", "ACTOR_BINDING", "CONFIRMATION_REQUIREMENT",
    "EFFECT_FINGERPRINT", "OBSERVATION", "VERIFICATION", "AUDIT_EVENT",
    "ERROR_CONTRACT", "ROLLBACK_CAPABILITY", "COMMIT_BOUNDARY",
  ];
  assert.deepEqual([...CAPABILITY_PRIMITIVES], expected);
});

test("a descriptor is descriptive only — no execution or authority surface", () => {
  const descriptor = describeCapability({
    id: "get_audit_history",
    capabilityKind: "READ",
    label: "Read customer audit history",
    resolves: ["service-history"],
  });

  assert.equal(descriptor.kind, "GOVERNED_CAPABILITY_DESCRIPTOR");
  assert.equal("execute" in descriptor, false);
  assert.equal("artifact" in descriptor, false);
  assert.equal("authorize" in descriptor, false);
  assert.equal("commit" in descriptor, false);
  assert.equal("activate" in descriptor, false);
  assert.ok(Object.values(descriptor).every((value) => typeof value !== "function"));

  // @ts-expect-error A governed capability descriptor is never Commit authority.
  const notCommit: CommitAuthorization = descriptor;
  void notCommit;

  // @ts-expect-error A governed capability descriptor is never resolution authority.
  const notResolution: ActivatedResolutionAuthority = descriptor;
  void notResolution;
});

test("the current absorption seed is a READ capability with an empty boundary set", () => {
  const descriptor = describeCapability({
    id: "candidate:get_audit_history",
    capabilityKind: "READ",
    label: "Read customer audit history",
    resolves: ["service-history"],
  });

  assert.equal(descriptor.capabilityKind, "READ");
  assert.equal(descriptor.boundaries.length, 0);
});

test("a governed mutation capability expresses its boundaries from the vocabulary", () => {
  const creditTool = describeCapability({
    id: "issue_service_credit",
    capabilityKind: "MUTATION",
    label: "Issue customer service credit",
    resolves: ["customer-id", "amount", "reason"],
    boundaries: [
      { primitive: "ACTOR_BINDING", description: "actor requires SERVICE_RECOVERY", actor: "SERVICE_RECOVERY" },
      { primitive: "COMMIT_BOUNDARY", description: "amount must not exceed $25", limit: { operator: "<=", value: 25 } },
      { primitive: "SESSION_REQUIREMENT", description: "account freshness required", freshnessRequired: true },
      { primitive: "AUDIT_EVENT", description: "audit event required", auditRequired: true },
      { primitive: "VERIFICATION", description: "observation + verification required" },
    ],
  });

  assert.equal(creditTool.capabilityKind, "MUTATION");
  assert.equal(creditTool.boundaries.length, 5);
  const actor = creditTool.boundaries.find((boundary) => boundary.primitive === "ACTOR_BINDING");
  assert.equal(actor?.actor, "SERVICE_RECOVERY");
  const limit = creditTool.boundaries.find((boundary) => boundary.primitive === "COMMIT_BOUNDARY");
  assert.deepEqual(limit?.limit, { operator: "<=", value: 25 });
  // Boundaries constrain future consequences; they do not pre-authorize any.
  assert.equal("execute" in creditTool, false);
});

test("unknown primitives are rejected — the vocabulary stays closed", () => {
  assert.throws(
    () => describeCapability({
      id: "x",
      capabilityKind: "READ",
      label: "x",
      resolves: [],
      boundaries: [{ primitive: "FREE_FORM_CODE" as never, description: "not allowed" }],
    }),
    /Unknown construction primitive/,
  );
});

test("an empty id is rejected", () => {
  assert.throws(() => describeCapability({ id: "  ", capabilityKind: "READ", label: "x", resolves: [] }), /requires an id/);
});
