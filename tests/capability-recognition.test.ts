import assert from "node:assert/strict";
import test from "node:test";
import {
  describeCapability,
  recognizeGovernedCapability,
  type GovernedCapabilityDescriptor,
} from "../src/flagship/capability-vocabulary";
import { ConstructionBenchmarkEngine } from "../src/construction/engine";

test("a construction Node recognizes a valid READ descriptor without composing", () => {
  const descriptor = describeCapability({
    id: "candidate:get_audit_history",
    capabilityKind: "READ",
    label: "Read customer audit history",
    resolves: ["service-history"],
  });

  const engine = new ConstructionBenchmarkEngine();
  const result = engine.recognizeCapability(descriptor);

  assert.equal(result.kind, "CAPABILITY_RECOGNITION");
  assert.equal(result.recognized, true);
  assert.equal(result.descriptorId, "candidate:get_audit_history");
  assert.equal(result.capabilityKind, "READ");
  assert.deepEqual(result.checks, []);
  assert.equal(result.composed, false);
});

test("a construction Node recognizes a governed MUTATION descriptor and its boundaries", () => {
  const creditTool = describeCapability({
    id: "issue_service_credit",
    capabilityKind: "MUTATION",
    label: "Issue customer service credit",
    resolves: ["customer-id", "amount", "reason"],
    boundaries: [
      { primitive: "ACTOR_BINDING", description: "actor requires SERVICE_RECOVERY", actor: "SERVICE_RECOVERY" },
      { primitive: "COMMIT_BOUNDARY", description: "amount must not exceed $25", limit: { operator: "<=", value: 25 } },
      { primitive: "AUDIT_EVENT", description: "audit event required", auditRequired: true },
    ],
  });

  const result = recognizeGovernedCapability(creditTool);
  assert.equal(result.recognized, true);
  assert.equal(result.capabilityKind, "MUTATION");
  assert.equal(result.composed, false);
});

test("recognition rejects malformed descriptors and reports checks", () => {
  const unknownPrimitive = {
    kind: "GOVERNED_CAPABILITY_DESCRIPTOR",
    id: "x",
    capabilityKind: "READ",
    label: "x",
    resolves: ["y"],
    boundaries: [{ primitive: "FREE_FORM_CODE", description: "not in vocabulary" }],
  } as unknown as GovernedCapabilityDescriptor;
  const r1 = recognizeGovernedCapability(unknownPrimitive);
  assert.equal(r1.recognized, false);
  assert.ok(r1.checks.some((check) => check.includes("unknown primitive")));

  const emptyId = { kind: "GOVERNED_CAPABILITY_DESCRIPTOR", id: "  ", capabilityKind: "READ", label: "x", resolves: ["y"], boundaries: [] } as GovernedCapabilityDescriptor;
  const r2 = recognizeGovernedCapability(emptyId);
  assert.equal(r2.recognized, false);
  assert.ok(r2.checks.some((check) => check.includes("empty")));

  const emptyResolve = { kind: "GOVERNED_CAPABILITY_DESCRIPTOR", id: "x", capabilityKind: "READ", label: "x", resolves: [""], boundaries: [] } as GovernedCapabilityDescriptor;
  const r3 = recognizeGovernedCapability(emptyResolve);
  assert.equal(r3.recognized, false);
  assert.ok(r3.checks.some((check) => check.includes("resolves[0]")));
});

test("recognition is type-level and structurally inert — it never composes", () => {
  const descriptor = describeCapability({ id: "get_audit_history", capabilityKind: "READ", label: "Read audit", resolves: ["service-history"] });
  const result = new ConstructionBenchmarkEngine().recognizeCapability(descriptor);

  // Structurally inert: no tool, effect, artifact, execute, or authority surface.
  assert.equal("tool" in result, false);
  assert.equal("effect" in result, false);
  assert.equal("artifact" in result, false);
  assert.equal("execute" in result, false);
  assert.equal("authorize" in result, false);

  // Type-level inert: `composed` is a literal `false`, never `true`.
  const composed: false = result.composed;
  assert.equal(composed, false);
  // @ts-expect-error recognition is typed inert — composed cannot be true.
  const neverTrue: true = result.composed;
  void neverTrue;
});

test("recognition is a pure read and leaves the engine's construction behavior unchanged", async () => {
  const engine = new ConstructionBenchmarkEngine();
  const descriptor = describeCapability({ id: "get_audit_history", capabilityKind: "READ", label: "Read audit", resolves: ["service-history"] });

  engine.recognizeCapability(descriptor);

  // The engine still runs its normal construction benchmark unchanged.
  const run = await engine.run({ request: "Build a Service Operations Console that shows customer, account status, available actions, service-credit requests, plan changes, and audit history.", concurrency: 10 });
  assert.equal(run.metrics.finalResult, "WORKING_APP");
});
