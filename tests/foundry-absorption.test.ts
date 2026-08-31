import assert from "node:assert/strict";
import test from "node:test";
import { XactFoundryLiaison } from "../src/flagship/foundry-liaison";
import type { OAgentProvider, ReasoningResult } from "../src/telemetry/o-agent-provider";
import {
  readEmployeesByDivision,
  readEmployeesOnLeave,
  readDirectReports,
  readCustomersAtRisk,
  readCustomersByPlan,
  readSupportTicketsByOwner,
} from "../src/flagship/business-workspace";

/**
 * A provider that throws on any call. Absorbed capabilities (genuineU: [])
 * must build with zero O-Agent calls, so a single reason() invocation fails.
 */
function throwingProvider(): OAgentProvider {
  return {
    telemetryKind: "LIVE_SANDBOX_MEASUREMENT",
    providerName: "throwing (must never be called)",
    reason: async (): Promise<ReasoningResult> => {
      throw new Error("O-Agent must not be called for an absorbed capability.");
    },
  };
}

const READ_CASES = [
  ["Build a WebMCP tool to find employees by role", "find_employees_by_role"],
  ["Build a WebMCP tool to read a division roster", "get_division_roster"],
  ["Build a WebMCP tool to read department headcount", "get_department_headcount"],
  ["Build a WebMCP tool to read employees by location", "get_employees_by_location"],
  ["Build a WebMCP tool to read employees on leave", "get_employees_on_leave"],
  ["Build a WebMCP tool to read direct reports", "get_direct_reports"],
  ["Build a WebMCP tool to read at-risk customers", "get_customers_at_risk"],
  ["Build a WebMCP tool to read customers by plan", "get_customers_by_plan"],
  ["Build a WebMCP tool to read work orders by owner", "get_work_orders_by_owner"],
  ["Build a WebMCP tool to read support tickets by owner", "get_support_tickets_by_owner"],
  ["Build a WebMCP tool for the sales pipeline and forecast", "get_sales_pipeline_forecast"],
  ["Build a WebMCP tool for marketing performance", "get_marketing_performance"],
] as const;

const MUTATION_CASES = [
  ["Build a WebMCP tool that lets service recovery reassign a support ticket", "reassign_support_ticket", "SERVICE_RECOVERY"],
  ["Build a WebMCP tool that lets field ops reassign a work order", "reassign_work_order", "FIELD OPS"],
  ["Build a WebMCP tool that lets service recovery escalate a support ticket", "escalate_support_ticket", "SERVICE_RECOVERY"],
  ["Build a WebMCP tool that lets customer success set a customer next action", "set_customer_next_action", "CUSTOMER SUCCESS"],
  ["Build a WebMCP tool that lets people ops update an employee status", "update_employee_status", "PEOPLE"],
] as const;

test("every absorbed READ capability builds deterministically with zero O-Agent calls", async () => {
  const liaison = new XactFoundryLiaison(throwingProvider());

  for (const [intent, id] of READ_CASES) {
    const result = await liaison.buildCapability(intent);
    assert.equal(result.outcome, "COMPOSED_DEFINITION", intent);
    assert.equal(result.tool?.name, id, intent);
    assert.equal(result.tool?.capabilityKind, "READ", intent);
    assert.equal(result.tool?.requiresCommit, false, intent);
    assert.ok(!result.activity.some((event) => event.type === "REASON_STARTED"), `${id} must not reason`);
    assert.ok(!result.activity.some((event) => event.type === "REASON_EVIDENCE"), `${id} must not reason`);
  }
});

test("every absorbed MUTATION capability builds with the bound actor and zero O-Agent calls", async () => {
  const liaison = new XactFoundryLiaison(throwingProvider());

  for (const [intent, id, actor] of MUTATION_CASES) {
    const result = await liaison.buildCapability(intent);
    assert.equal(result.outcome, "COMPOSED_DEFINITION", intent);
    assert.equal(result.tool?.name, id, intent);
    assert.equal(result.tool?.capabilityKind, "MUTATION", intent);
    assert.equal(result.tool?.requiresCommit, true, intent);
    assert.ok(!result.activity.some((event) => event.type === "REASON_STARTED"), `${id} must not reason`);

    const binding = result.tool?.boundaries.find((boundary) => boundary.primitive === "ACTOR_BINDING");
    assert.equal(binding?.actor, actor, `${id} must bind actor ${actor}`);
  }
});

test("the absorbed filters resolve against the public-safe substrates, not claims", () => {
  assert.equal(readEmployeesByDivision("Engineering").rows.length, 24);
  assert.equal(readEmployeesOnLeave().rows.length, 3);
  assert.equal(readDirectReports("Jordan Kim").rows.length, 23);
  assert.equal(readCustomersAtRisk().rows.length, 1);
  assert.equal(readCustomersAtRisk().rows[0].customer, "Northstar Cafe");
  assert.equal(readCustomersByPlan("Growth").rows.length, 1);
  assert.equal(readCustomersByPlan("Growth").rows[0].customer, "Ada Lovelace");
  assert.equal(readSupportTicketsByOwner("BILLING").rows.length, 1);
  assert.equal(readSupportTicketsByOwner("BILLING").rows[0].id, "SUP-917");
});

test("an unabsorbed request still needs the O-Agent — it is not silently absorbed", async () => {
  // Compensation is outside the closed ontology. It must reach the O-Agent,
  // so a throwing provider surfaces the call instead of silently composing it.
  await assert.rejects(
    () => new XactFoundryLiaison(throwingProvider()).buildCapability("Build a WebMCP tool to approve payroll compensation changes"),
    /O-Agent must not be called/,
  );
});
