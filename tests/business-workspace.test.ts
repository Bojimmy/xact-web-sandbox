import assert from "node:assert/strict";
import test from "node:test";
import {
  readCampaignDashboard,
  readCustomerHealth,
  readOperationsReport,
  readSupportQueue,
  readWorkOrderQueue,
} from "../src/flagship/business-workspace";

test("public-safe business workspace exposes deterministic task-shaped read results", () => {
  const results = [readWorkOrderQueue(), readSupportQueue(), readCustomerHealth("1042"), readOperationsReport(), readCampaignDashboard()];
  assert.deepEqual(results.map((result) => result.kind), ["WORK_ORDER_QUEUE", "SUPPORT_QUEUE", "CUSTOMER_HEALTH", "OPERATIONS_REPORT", "CAMPAIGN_DASHBOARD"]);
  for (const result of results) {
    assert.equal(result.source, "FOUNDRY_PUBLIC_SAFE_BUSINESS_WORKSPACE");
    assert.ok(result.summary.length > 0);
    assert.ok(result.rows.length > 0);
  }
  assert.equal(readCustomerHealth("missing").rows[0].health, "UNKNOWN");
  assert.equal(readCampaignDashboard().summary.find((item) => item.label === "Delivery receipts")?.value, "0");
});
