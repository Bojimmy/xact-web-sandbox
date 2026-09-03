import assert from "node:assert/strict";
import test from "node:test";
import { readChatGPTCapability, constructChatGPTCapability } from "../src/chatgpt-app/xact-foundry-tools";
import { resolveCapabilityIntent } from "../src/chatgpt-app/capability-resolution";

test("the runtime read returns real current data with a read-only schema", () => {
  const result = readChatGPTCapability("get_current_operations_snapshot");
  assert.equal(result.kind, "READ_RESULT");
  assert.equal(result.readOnly, true);
  assert.equal(result.data.title, "Current operations snapshot");
  assert.equal(result.data.kind, "OPERATIONS_SNAPSHOT");
  assert.equal(result.data.rows.length, 3);
  assert.ok(result.schema.properties.columns);
  assert.ok(result.schema.properties.rows);
  assert.match(result.boundary, /no mutation, no polling, and no scheduled updates/i);

  // The domains stay distinct — never conflated.
  const domains = result.data.rows.map((row) => row.domain);
  assert.ok(domains.includes("Field operations"));
  assert.ok(domains.includes("Customer support"));
  assert.ok(domains.includes("Customer health"));
});

test("the runtime read result carries no execute or authority surface", () => {
  const result = readChatGPTCapability("get_current_operations_snapshot");
  for (const surface of ["execute", "artifact", "authorize", "commit", "activate"]) {
    assert.equal(surface in result, false, `runtime read must not expose ${surface}`);
  }
});

test("the runtime read refuses MUTATION and unknown capabilities", () => {
  assert.throws(() => readChatGPTCapability("issue_service_credit"), /only READ capabilities/);
  assert.throws(() => readChatGPTCapability("not_a_capability"), /Unknown approved Xact capability/);
});

test("the composed longest-waiting customer view reads the approved public-safe substrate", () => {
  const result = readChatGPTCapability("composed_read_customer_request", {}, () => 123);
  assert.equal(result.data.kind, "CUSTOMER_WAIT_QUEUE");
  assert.deepEqual(result.data.columns, ["customerId", "requestId", "waitDuration"]);
  assert.deepEqual(result.data.rows.map((row) => row.waitDuration), ["4h 11m", "2h 04m", "1h 18m", "42m"]);
  assert.equal(result.readOnly, true);
  assert.match(result.boundary, /No external action/);
});

test("operations exception brief is a read capability, never support-ticket escalation", () => {
  const result = resolveCapabilityIntent("Build me a Operations Exception Brief");
  assert.equal(result.outcome, "EXACT");
  if (result.outcome === "EXACT") assert.equal(result.candidate.id, "get_operations_exception_brief");
  const read = readChatGPTCapability("get_operations_exception_brief");
  assert.equal(read.data.kind, "OPERATIONS_EXCEPTION_BRIEF");
});

test("customer 360 language resolves to a read view, never ticket escalation", () => {
  const result = resolveCapabilityIntent("Given a customer email, show their account, support history, open cases, work orders, and health status.");
  assert.equal(result.outcome, "EXACT");
  if (result.outcome === "EXACT") assert.equal(result.candidate.id, "get_customer_360");
  const read = readChatGPTCapability("get_customer_360", { email: "ada@example.com" });
  assert.equal(read.data.title, "Customer 360: Ada Lovelace");
  assert.ok(read.data.rows[0]?.supportHistory);
});

test("owner workload language resolves to a combined read view, never reassignment", () => {
  const result = resolveCapabilityIntent("Show each owner's assigned work orders and support tickets, ordered by urgency and due time.");
  assert.equal(result.outcome, "EXACT");
  if (result.outcome === "EXACT") assert.equal(result.candidate.id, "get_owner_workload");
  const read = readChatGPTCapability("get_owner_workload");
  assert.equal(read.data.kind, "OWNER_WORKLOAD");
  assert.equal(read.data.rows[0]?.urgency, "URGENT");
});

test("approved work-order and support queues expose runtime reads", () => {
  const workOrders = readChatGPTCapability("get_work_order_queue");
  assert.equal(workOrders.data.kind, "WORK_ORDER_QUEUE");
  assert.equal(workOrders.data.rows.length, 4);
  const support = readChatGPTCapability("get_customer_support_queue");
  assert.equal(support.data.kind, "SUPPORT_QUEUE");
  assert.equal(support.data.rows.length, 4);
});

test("urgent work-order triage stays read-only and includes the governed blocker field", () => {
  const result = resolveCapabilityIntent("Show urgent work orders, their owner, due time, and what is blocking completion.");
  assert.equal(result.outcome, "EXACT");
  if (result.outcome === "EXACT") assert.equal(result.candidate.id, "get_urgent_work_order_triage");
  const read = readChatGPTCapability("get_urgent_work_order_triage");
  assert.equal(read.data.kind, "URGENT_WORK_ORDER_TRIAGE");
  assert.deepEqual(read.data.columns, ["id", "customer", "task", "owner", "due", "blocker"]);
  assert.equal(read.data.rows.length, 1);
  assert.equal(read.data.rows[0]?.priority, undefined);
  assert.match(read.data.rows[0]?.blocker ?? "", /dispatch/i);
});

test("escalated support review resolves as a read view, never escalation", () => {
  const result = resolveCapabilityIntent("Show escalated support cases, their severity, current owner, customer history, and required next review. This is read-only; do not escalate, reassign, update, or commit anything.");
  assert.equal(result.outcome, "EXACT");
  if (result.outcome === "EXACT") assert.equal(result.candidate.id, "get_escalated_support_case_review");
  const read = readChatGPTCapability("get_escalated_support_case_review");
  assert.equal(read.data.kind, "ESCALATED_SUPPORT_REVIEW");
  assert.equal(read.data.rows.length, 1);
  assert.equal(read.data.rows[0]?.severity, "URGENT");
  assert.ok(read.data.rows[0]?.history);
  assert.ok(read.data.rows[0]?.nextReview);
});

test("owner-unavailable work-order filter stays read-only, never reassignment", () => {
  const result = resolveCapabilityIntent("Show work orders whose assigned owner is unavailable, including priority, due time, and current status. Do not change ownership or create a reassignment.");
  assert.equal(result.outcome, "EXACT");
  if (result.outcome === "EXACT") assert.equal(result.candidate.id, "get_work_orders_owner_unavailable");
  const read = readChatGPTCapability("get_work_orders_owner_unavailable");
  assert.equal(read.data.rows.length, 1);
  assert.equal(read.data.rows[0]?.priority, "HIGH");
});

test("service-credit opportunity evidence stays read-only through natural-language resolution", () => {
  const result = resolveCapabilityIntent("Show customers with an eligible but unissued service-credit opportunity, including the qualifying evidence and prior credits in the last 30 days. Read-only only; do not propose or issue a credit.");
  assert.equal(result.outcome, "EXACT");
  if (result.outcome === "EXACT") assert.equal(result.candidate.id, "get_service_credit_opportunities");
  const read = readChatGPTCapability("get_service_credit_opportunities");
  assert.equal(read.data.kind, "SERVICE_CREDIT_OPPORTUNITIES");
  assert.equal(read.data.rows[0]?.status, "ELIGIBLE · UNISSUED");
});

test("plan-change audit request preserves the dependent history projection", () => {
  const result = resolveCapabilityIntent("Given a customer email, show account-plan changes recorded in the audit history, with date, prior plan, and resulting plan. Do not change the customer’s plan.");
  assert.equal(result.outcome, "EXACT");
  if (result.outcome === "EXACT") assert.equal(result.candidate.id, "get_customer_plan_change_history");
  const read = readChatGPTCapability("get_customer_plan_change_history", { email: "ada@example.com" });
  assert.equal(read.data.kind, "CUSTOMER_PLAN_CHANGE_HISTORY");
  assert.deepEqual(read.data.columns, ["date", "priorPlan", "resultingPlan"]);
});

test("support escalation evidence stays read-only and preserves qualifying conditions", () => {
  const result = resolveCapabilityIntent("Show support tickets that meet the stated conditions for escalation, with the evidence for each. Do not escalate any ticket.");
  assert.equal(result.outcome, "EXACT");
  if (result.outcome === "EXACT") assert.equal(result.candidate.id, "get_support_escalation_evidence");
  const read = readChatGPTCapability("get_support_escalation_evidence");
  assert.equal(read.data.kind, "SUPPORT_ESCALATION_EVIDENCE");
  assert.ok(read.data.rows[0]?.qualifyingEvidence);
});

test("the snapshot also constructs as an inert, read-only definition", async () => {
  const built = await constructChatGPTCapability("get_current_operations_snapshot");
  assert.equal(built.definition.name, "get_current_operations_snapshot");
  assert.equal(built.definition.capabilityKind, "READ");
  assert.equal(built.definition.requiresCommit, false);
  assert.equal("execute" in built.definition, false);
  assert.match(built.summary.builtAndValidated, /read-only `get_current_operations_snapshot`/);
});

test("current operations snapshot resolves exactly, not as a near match", () => {
  const result = resolveCapabilityIntent("Build a tool for a current operations snapshot");
  assert.equal(result.outcome, "EXACT");
  if (result.outcome === "EXACT") assert.equal(result.candidate.id, "get_current_operations_snapshot");
});

test("the bare 'operations snapshot' term resolves to the current-operations capability", () => {
  const result = resolveCapabilityIntent("Build an operations snapshot tool");
  assert.equal(result.outcome, "EXACT");
  if (result.outcome === "EXACT") assert.equal(result.candidate.id, "get_current_operations_snapshot");
});

test("customer order-status language never maps to the operations snapshot", () => {
  const result = resolveCapabilityIntent("Look up the status of customer order ORD-100");
  assert.equal(result.outcome, "UNAVAILABLE");
});
