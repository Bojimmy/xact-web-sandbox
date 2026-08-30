import assert from "node:assert/strict";
import test from "node:test";
import { projectFoundryToolflow } from "../src/flagship/foundry-toolflow";
import type { FoundryActivity } from "../src/flagship/foundry-liaison";

const event = (type: FoundryActivity["type"], status: FoundryActivity["status"]): FoundryActivity => ({ type, status, label: type, detail: `${type} detail` });

test("toolflow lights only lifecycle stages emitted by the actual activity stream", () => {
  const stages = projectFoundryToolflow([event("RESOLVE", "PASS"), event("DOOR", "PASS"), event("LEDGER", "PASS"), event("BUILD", "PASS")]);
  assert.equal(stages.find((stage) => stage.id === "INTENT")?.state, "COMPLETE");
  assert.equal(stages.find((stage) => stage.id === "BOUNDARY")?.state, "COMPLETE");
  assert.equal(stages.find((stage) => stage.id === "BUILD")?.state, "COMPLETE");
  assert.equal(stages.find((stage) => stage.id === "BOUNDARY")?.events.length, 2);
  assert.equal(stages.find((stage) => stage.id === "HOST")?.state, "WAITING");
  assert.equal(stages.find((stage) => stage.id === "RUN")?.state, "WAITING");
});

test("toolflow preserves blocked and unmeasured states instead of fabricating progress", () => {
  const stages = projectFoundryToolflow([event("REASON_STARTED", "PENDING"), event("REASON_FAILED", "BLOCK")], { status: "BLOCKED_NO_AUTHORITY" });
  assert.equal(stages.find((stage) => stage.id === "REASON")?.state, "BLOCKED");
  assert.equal(stages.find((stage) => stage.id === "RUN")?.state, "BLOCKED");
  assert.equal(stages.find((stage) => stage.id === "COMMIT")?.state, "WAITING");
  assert.equal(stages.find((stage) => stage.id === "RUN")?.events.length, 0);
});
