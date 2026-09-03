import assert from "node:assert/strict";
import test from "node:test";
import {
  validateComposition,
  describeCompositionOutcome,
  type CapabilityComposition,
  type CompositionOutcome,
} from "../src/chatgpt-app/capability-composition";

/**
 * The "strange but reasonable requests" demo harness.
 *
 * Each request is a natural-language intent (what a judge would type), paired
 * with the structured composition the Boss would propose for it. This tests the
 * DSH-built CLASSIFIER end-to-end; the NL→composition step itself is ChatGPT's,
 * exercised live in the connector, not here.
 */

const DEMO_CASES: ReadonlyArray<{ request: string; composition: CapabilityComposition }> = [
  { request: "Give support a way to see which customers are waiting the longest.", composition: { capability: "READ", resource: ["CUSTOMER_REQUEST"], operation: ["LIST"], filter: ["STATUS_OPEN"], sort: "WAIT_DURATION_DESC", output: ["CUSTOMER_ID", "REQUEST_ID", "WAIT_DURATION"] } },
  { request: "Show me the current employee directory.", composition: { capability: "READ", resource: ["EMPLOYEE"], operation: ["LIST"], output: ["EMPLOYEE_ID", "NAME", "ROLE"] } },
  { request: "Give managers a read-only view of unresolved work orders.", composition: { capability: "READ", resource: ["WORK_ORDER"], operation: ["LIST"], output: ["WORK_ORDER_ID", "OWNER", "PRIORITY", "STATUS", "DUE"] } },
  { request: "Show employees grouped by division, sorted by priority.", composition: { capability: "READ", resource: ["EMPLOYEE"], operation: ["LIST"], filter: ["DIVISION"], sort: "PRIORITY_DESC", output: ["EMPLOYEE_ID", "DIVISION"] } },
  { request: "Let field ops reassign a work order and see its due date.", composition: { actor: "FIELD_OPS", capability: "MUTATION", resource: ["WORK_ORDER"], mutation: "REASSIGN", output: ["WORK_ORDER_ID", "OWNER", "DUE"] } },
  { request: "Show me customers, somehow.", composition: { capability: "READ", resource: ["CUSTOMER"], output: ["CUSTOMER_ID"] } },
  { request: "Show me our inventory levels.", composition: { capability: "READ", resource: ["INVENTORY"], operation: ["LIST"], output: ["NAME"] } },
  { request: "Show me customers and their social security numbers.", composition: { capability: "READ", resource: ["CUSTOMER"], operation: ["LIST"], output: ["CUSTOMER_ID", "SOCIAL_SECURITY_NUMBER"] } },
  { request: "Build a tool that lets any agent delete any account.", composition: { actor: "SUPPORT_AGENT", capability: "MUTATION", resource: ["CUSTOMER"], mutation: "DELETE_ACCOUNT", output: ["CUSTOMER_ID"] } },
  { request: "Reassign a work order (no actor specified).", composition: { capability: "MUTATION", resource: ["WORK_ORDER"], mutation: "REASSIGN", output: ["OWNER"] } },
];

test("the demo harness yields all five legitimate outcomes with a stable distribution", () => {
  const counts: Record<CompositionOutcome["outcome"], number> = {
    ALREADY_GOVERNED: 0,
    COMPOSABLE: 0,
    NEEDS_RESOLUTION: 0,
    NOVEL_BOUNDARY: 0,
    UNAUTHORIZED: 0,
  };

  const lines: string[] = [];
  for (const { request, composition } of DEMO_CASES) {
    const result = validateComposition(composition);
    counts[result.outcome] += 1;
    const presentation = describeCompositionOutcome(result);
    lines.push(`- ${result.outcome.padEnd(16)} ← "${request}"`);
    lines.push(`    Boss: ${presentation.judgeMessage}`);
  }

  // Expected: 2 known, 3 novel-but-composable, 1 ambiguous, 2 novel-boundary, 2 unauthorized.
  assert.deepEqual(counts, {
    ALREADY_GOVERNED: 2,
    COMPOSABLE: 3,
    NEEDS_RESOLUTION: 1,
    NOVEL_BOUNDARY: 2,
    UNAUTHORIZED: 2,
  });
  console.log("\n" + lines.join("\n"));
});

test("every demo outcome has a judge-facing message and at least one activity step", () => {
  for (const { composition } of DEMO_CASES) {
    const presentation = describeCompositionOutcome(validateComposition(composition));
    assert.ok(presentation.judgeMessage.length > 0);
    assert.ok(presentation.steps.length >= 1);
    assert.ok(presentation.steps.every((step) => step.label.length > 0));
  }
});
