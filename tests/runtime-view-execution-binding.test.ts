import assert from "node:assert/strict";
import test from "node:test";
import { toControlRoomScenario } from "../src/control-room/runtime-view";
import { createCommerceSimulationEngine } from "../src/runtime/commerce-engine";

test("the runtime view exposes an activation target only from an AUTHORIZED artifact", async () => {
  const engine = createCommerceSimulationEngine();
  const resolved = await engine.resolve(engine.createSession());
  const beforeCommit = toControlRoomScenario(resolved);

  assert.equal(beforeCommit.execution.authorization, undefined);

  const committed = await engine.commit(resolved);
  const afterCommit = toControlRoomScenario(committed);

  assert.deepEqual(afterCommit.execution.authorization, {
    commitId: committed.decision?.artifact?.commitId,
    effectFingerprint: committed.decision?.artifact?.effectFingerprint,
    target: "order:XC-MUTABLE/refund",
  });
});
