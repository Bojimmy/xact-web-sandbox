import assert from "node:assert/strict";
import test from "node:test";
import { decomposeIntent } from "../src/flagship/foundry-liaison";
import { validateComposition } from "../src/chatgpt-app/capability-composition";
import { constructChatGPTCapability } from "../src/chatgpt-app/xact-foundry-tools";

// Part 1 — urgent work orders with no qualified owner.

test("urgent + qualified-owner request resolves to the unqualified-owner composition, not generic triage", () => {
  const d = decomposeIntent(
    "Show urgent work orders that have no available qualified owner, ordered by due time. This is a staffing and dispatch evidence view only; do not assign or reassign work.",
  );
  assert.equal(d.pattern?.id, "get_urgent_work_orders_unqualified_owner");
  assert.equal(d.pattern?.capabilityKind, "READ");
});

test("the qualification filter and DUE_TIME_ASC sort survive into the governed composition", () => {
  const result = validateComposition({
    capability: "READ",
    resource: ["WORK_ORDER"],
    operation: ["LIST"],
    filter: ["PRIORITY_URGENT", "QUALIFIED_OWNER_UNAVAILABLE"],
    sort: "DUE_TIME_ASC",
    output: ["OWNER", "QUALIFIED_OWNER_AVAILABLE", "DUE_TIME", "STATUS"],
  });
  assert.equal(result.outcome, "ALREADY_GOVERNED");
  if (result.outcome === "ALREADY_GOVERNED") assert.equal(result.capabilityId, "get_urgent_work_orders_unqualified_owner");
});

test("the unqualified-owner contract preserves qualified-owner-available and due-time in its output", async () => {
  const built = await constructChatGPTCapability("get_urgent_work_orders_unqualified_owner");
  assert.equal(built.definition.capabilityKind, "READ");
  assert.ok(built.definition.outputSchema.required.includes("qualified-owner-available"));
  assert.ok(built.definition.outputSchema.required.includes("due-time"));
});

// Part 2 — Support Lead Decision Queue (READ, never a mutation).

test("support-lead decision queue request resolves READ, never a mutation", () => {
  const d = decomposeIntent(
    "Show tickets awaiting support-lead review, grouped by possible next action: reassignment, escalation, service credit, or no action. Do not perform or propose any of those actions.",
  );
  assert.equal(d.pattern?.id, "get_support_lead_decision_queue");
  assert.equal(d.pattern?.capabilityKind, "READ");
});

test("the decision queue composition is READ with no mutation effect", () => {
  const result = validateComposition({
    capability: "READ",
    resource: ["REQUEST"],
    operation: ["LIST"],
    filter: ["AWAITING_REVIEW"],
    output: ["REQUEST_ID", "DECISION_CATEGORY", "POSSIBLE_NEXT_ACTION"],
  });
  assert.equal(result.outcome, "ALREADY_GOVERNED");
  if (result.outcome === "ALREADY_GOVERNED") assert.equal(result.capabilityId, "get_support_lead_decision_queue");
});

test("mutation names as possible-next-action never resolve to the mutations", () => {
  const prompts = [
    "Show tickets awaiting review, grouped by possible next action: reassignment, escalation, service credit, or no action. Do not perform any of those actions.",
    "Which tickets might need escalation or reassignment? Do not act on them.",
    "Show me eligible-but-unissued service credit opportunities. Do not issue any credit.",
  ];
  for (const prompt of prompts) {
    const id = decomposeIntent(prompt).pattern?.id;
    assert.notEqual(id, "issue_service_credit", prompt);
    assert.notEqual(id, "reassign_support_ticket", prompt);
    assert.notEqual(id, "escalate_support_ticket", prompt);
  }
});

// Positive controls — real mutation intent still resolves to the mutations.

test("real mutation intents still resolve to their Commit-gated mutations", () => {
  assert.equal(decomposeIntent("Let a support agent issue a service credit up to $25.").pattern?.id, "issue_service_credit");
  assert.equal(decomposeIntent("Reassign a support ticket to another owner.").pattern?.id, "reassign_support_ticket");
  assert.equal(decomposeIntent("Escalate this support ticket now.").pattern?.id, "escalate_support_ticket");
});
