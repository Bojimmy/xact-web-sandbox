import assert from "node:assert/strict";
import test from "node:test";
import { scenarios, scenarioById } from "../src/control-room/fixtures";

test("exposes exactly the four canonical commit states", () => {
  assert.deepEqual(
    scenarios.map((scenario) => scenario.status),
    ["AUTHORIZED", "REJECTED", "ESCALATED", "STALE"],
  );
});

test("only the authorized scenario may execute", () => {
  for (const scenario of scenarios) {
    assert.equal(scenario.execution.executed, scenario.status === "AUTHORIZED");
    if (scenario.status !== "AUTHORIZED") {
      assert.equal(scenario.execution.selected, "NONE");
      assert.equal(scenario.execution.receipt, "—");
    }
  }
});

test("authorization requires an explicit verified effect", () => {
  assert.equal(scenarioById.authorized.verification.state, "VERIFIED");
  assert.notEqual(scenarioById.authorized.execution.receipt, "—");
});

test("stale candidates fail the state binding and never execute", () => {
  const stale = scenarioById.stale;
  assert.notEqual(stale.commit.baseHash, stale.commit.currentHash);
  assert.match(stale.commit.stateBinding, /^FAIL/);
  assert.equal(stale.execution.executed, false);
});

test("reasoning is limited to unresolved semantics and does not authorize", () => {
  for (const scenario of scenarios) {
    assert.equal(scenario.reasoning.involved, scenario.resolution.unresolved.length > 0);
  }
  assert.equal(scenarioById.escalated.execution.executed, false);
});
