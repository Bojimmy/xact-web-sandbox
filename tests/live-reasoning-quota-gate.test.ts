import assert from "node:assert/strict";
import test from "node:test";
import { LiveReasoningAllowanceExhaustedError, MissingJudgeIdentityError, invokeWithLiveReasoningAllowance } from "../src/server/live-reasoning-quota-gate";

function storeWith(remaining: number) {
  let releases = 0;
  return {
    store: {
      reserve: async () => ({ maximum: 3, used: 3 - remaining + 1, remaining: Math.max(0, remaining - 1), permitted: remaining > 0 }),
      release: async () => { releases += 1; },
    },
    releases: () => releases,
  };
}

test("an exhausted judge cannot invoke the upstream reasoning gateway", async () => {
  const { store } = storeWith(0);
  let upstreamCalls = 0;
  await assert.rejects(
    () => invokeWithLiveReasoningAllowance("judge-a", store, async () => { upstreamCalls += 1; return "should not run"; }),
    LiveReasoningAllowanceExhaustedError,
  );
  assert.equal(upstreamCalls, 0);
});

test("a gateway failure releases the reserved call", async () => {
  const fixture = storeWith(3);
  await assert.rejects(
    () => invokeWithLiveReasoningAllowance("judge-a", fixture.store, async () => { throw new Error("gateway unavailable"); }),
    /gateway unavailable/,
  );
  assert.equal(fixture.releases(), 1);
});

test("a missing signed-in identity fails before allowance or gateway work", async () => {
  const { store } = storeWith(3);
  await assert.rejects(() => invokeWithLiveReasoningAllowance(null, store, async () => "never"), MissingJudgeIdentityError);
});
