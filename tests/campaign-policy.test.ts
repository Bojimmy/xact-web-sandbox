import assert from "node:assert/strict";
import test from "node:test";

import {
  canAdvanceAuthorizedExecution,
  executionDisposition,
  levelCompletionLabel,
} from "../app/_lib/campaign-policy";
import { assessResolutionRequest } from "../app/_lib/resolution-policy";

test("only an authorized Commit outcome may enter execution", () => {
  assert.equal(executionDisposition("AUTHORIZED"), "EXECUTE");
  assert.equal(executionDisposition("REJECTED_EXCESS"), "BLOCKED_NO_AUTHORITY");
  assert.equal(executionDisposition("REJECTED_SOCIAL"), "BLOCKED_NO_AUTHORITY");
});

test("a completed local decoy challenge unlocks authorized execution progression", () => {
  assert.equal(canAdvanceAuthorizedExecution(1, "AUTHORIZED", "DONE"), true);
  assert.equal(canAdvanceAuthorizedExecution(1, "DECOY", "DONE"), true);
  assert.equal(canAdvanceAuthorizedExecution(1, "DECOY", "RUNNING"), false);
  assert.equal(canAdvanceAuthorizedExecution(0, "DECOY", "DONE"), false);
});

test("ladder labels report the consequence outcome instead of generic activity", () => {
  assert.equal(levelCompletionLabel(3, "AUTHORIZED"), "AUTHORIZED");
  assert.equal(levelCompletionLabel(3, "REJECTED_EXCESS"), "REFUSED");
  assert.equal(levelCompletionLabel(4, "REJECTED_EXCESS"), "NOT EXECUTED");
  assert.equal(levelCompletionLabel(4, "AUTHORIZED"), "EXECUTED");
});

test("a failed Resolve policy is the exact candidate Commit receives", () => {
  const assessment = assessResolutionRequest("Refund $420 to order #4402 for late delivery.");

  assert.equal(assessment.constraints[0]?.satisfied, false);
  assert.equal(assessment.commitOutcome, "REJECTED_EXCESS");
  assert.match(assessment.commitReason, /\$100 policy ceiling/);
});

test("an ambiguous Resolve constraint is preserved into a Commit refusal", () => {
  const assessment = assessResolutionRequest("Refund $42 to order #4402 and make it right.");

  assert.equal(assessment.constraints.at(-1)?.satisfied, false);
  assert.equal(assessment.commitOutcome, "REJECTED_CONSTRAINT");
});
