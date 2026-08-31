import assert from "node:assert/strict";
import test from "node:test";
import {
  readCampaignDashboard,
  readCustomerHealth,
  readEmployeeDirectory,
  readOperationsReport,
  readSupportQueue,
  readWorkOrderQueue,
} from "../src/flagship/business-workspace";

test("public-safe business workspace exposes deterministic task-shaped read results", () => {
  const results = [readWorkOrderQueue(), readSupportQueue(), readEmployeeDirectory(), readCustomerHealth("1042"), readOperationsReport(), readCampaignDashboard()];
  assert.deepEqual(results.map((result) => result.kind), ["WORK_ORDER_QUEUE", "SUPPORT_QUEUE", "EMPLOYEE_DIRECTORY", "CUSTOMER_HEALTH", "OPERATIONS_REPORT", "CAMPAIGN_DASHBOARD"]);
  for (const result of results) {
    assert.equal(result.source, "FOUNDRY_PUBLIC_SAFE_BUSINESS_WORKSPACE");
    assert.ok(result.summary.length > 0);
    assert.ok(result.rows.length > 0);
  }
  assert.equal(readCustomerHealth("missing").rows[0].health, "UNKNOWN");
  assert.equal(readCampaignDashboard().summary.find((item) => item.label === "Delivery receipts")?.value, "0");
});

test("employee directory is a deterministic fictional 100-person organization", () => {
  const result = readEmployeeDirectory();
  assert.equal(result.rows.length, 100);
  assert.equal(result.summary.find((item) => item.label === "Employees")?.value, "100");
  assert.equal(result.summary.find((item) => item.label === "Divisions")?.value, "9");
  assert.equal(result.summary.find((item) => item.label === "Company leaders")?.value, "9");
  assert.equal(result.rows[0].title, "Chief Executive Officer");
  assert.equal(result.rows.filter((employee) => employee.status === "ON LEAVE").length, 3);
  assert.ok(result.rows.some((employee) => employee.division === "Engineering"));
  assert.ok(result.rows.some((employee) => employee.division === "Customer Success"));
  assert.deepEqual(result.rows.slice(0, 9).map((employee) => employee.division), ["Executive", "Finance", "People", "Product", "Engineering", "Sales", "Marketing", "Customer Success", "Operations"]);
});
