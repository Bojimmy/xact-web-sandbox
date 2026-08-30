import assert from "node:assert/strict";
import test from "node:test";
import { hasLiveReasoningAllowance, liveReasoningBudget } from "../src/flagship/judge-live-reasoning-budget";

test("a judge receives three live reasoning calls and no more", () => {
  assert.deepEqual(liveReasoningBudget(0), { maximum: 3, used: 0, remaining: 3 });
  assert.deepEqual(liveReasoningBudget(2), { maximum: 3, used: 2, remaining: 1 });
  assert.equal(hasLiveReasoningAllowance(2), true);
  assert.equal(hasLiveReasoningAllowance(3), false);
});

test("the displayed allowance fails closed for invalid or over-limit counts", () => {
  assert.deepEqual(liveReasoningBudget(-5), { maximum: 3, used: 0, remaining: 3 });
  assert.deepEqual(liveReasoningBudget(99), { maximum: 3, used: 3, remaining: 0 });
});
