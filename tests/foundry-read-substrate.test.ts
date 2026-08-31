import assert from "node:assert/strict";
import test from "node:test";
import { readAbsorbedFoundryTool } from "../src/flagship/foundry-read-substrate";

test("each absorbed READ tool maps to its declared public-safe substrate", () => {
  const cases = [
    ["find_employees_by_role", { role: "Account Executive" }, "Employees by role: Account Executive", 3],
    ["get_division_roster", { division: "Engineering" }, "Division roster: Engineering", 24],
    ["get_department_headcount", { department: "Engineering" }, "Department headcount: Engineering", 24],
    ["get_employees_by_location", { location: "Austin" }, "Employees by location: Austin", 26],
    ["get_employees_on_leave", {}, "Employees on leave", 3],
    ["get_direct_reports", { manager: "Jordan Kim" }, "Direct reports: Jordan Kim", 23],
    ["get_customers_at_risk", {}, "At-risk customers", 1],
    ["get_customers_by_plan", { plan: "Growth" }, "Customers by plan: Growth", 1],
    ["get_work_orders_by_owner", { owner: "M. Rivera" }, "Work orders by owner: M. Rivera", 1],
    ["get_support_tickets_by_owner", { owner: "BILLING" }, "Support tickets by owner: BILLING", 1],
  ] as const;

  for (const [name, input, title, rows] of cases) {
    const result = readAbsorbedFoundryTool(name, input);
    assert.equal(result?.title, title, name);
    assert.equal(result?.rows.length, rows, name);
  }
  assert.equal(readAbsorbedFoundryTool("not-governed", {}), undefined);
});
