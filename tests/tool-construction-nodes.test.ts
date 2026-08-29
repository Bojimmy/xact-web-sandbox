import assert from "node:assert/strict";
import test from "node:test";
import { describeCapability } from "../src/flagship/capability-vocabulary";
import { constructWebMCPToolWithNodes } from "../src/flagship/tool-construction-nodes";

test("X-Nodes run real deterministic tool construction and preserve inertness", () => {
  const result = constructWebMCPToolWithNodes(describeCapability({ id: "read_demo", capabilityKind: "READ", label: "Read demo", resolves: ["demo"] }));
  assert.equal(result.tool.name, "read_demo");
  assert.equal(result.nodes.length, 5);
  assert.equal("execute" in result.tool, false);
  assert.ok(result.nodes.every((node) => node.status === "COMPLETE"));
});
