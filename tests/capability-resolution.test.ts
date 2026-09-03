import assert from "node:assert/strict";
import test from "node:test";
import { FOUNDRY_CATALOG } from "../src/flagship/foundry-catalog";
import {
  declaredDiscoveryIds,
  resolveCapabilityIntent,
} from "../src/chatgpt-app/capability-resolution";

test("every governed catalog recipe has public discovery vocabulary", () => {
  assert.deepEqual(new Set(declaredDiscoveryIds()), new Set(FOUNDRY_CATALOG.map((entry) => entry.id)));
});

test("declared equivalent language resolves to the exact governed recipe", () => {
  const result = resolveCapabilityIntent("Build a tool for user stats and user requests");
  assert.equal(result.outcome, "EXACT");
  if (result.outcome === "EXACT") assert.equal(result.candidate.id, "read_active_users_and_open_requests");
});

test("a broad but plausible request produces at most three governed choices", () => {
  const result = resolveCapabilityIntent("Build a customer operations tool");
  assert.equal(result.outcome, "CLARIFY");
  if (result.outcome === "CLARIFY") {
    assert.ok(result.candidates.length >= 2);
    assert.ok(result.candidates.length <= 3);
    assert.ok(result.candidates.every((candidate) => FOUNDRY_CATALOG.some((entry) => entry.id === candidate.id)));
  }
});

test("order-status language is never silently mapped to the field work-order recipes", () => {
  const result = resolveCapabilityIntent("Look up the status of customer order ORD-100");
  assert.equal(result.outcome, "UNAVAILABLE");
  if (result.outcome === "UNAVAILABLE") {
    assert.match(result.reason, /will not substitute/i);
    assert.equal(result.candidateBuildBrief.nextStep, "GOVERNANCE_REVIEW_REQUIRED");
  }
});
