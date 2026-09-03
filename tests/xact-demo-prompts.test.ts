import assert from "node:assert/strict";
import test from "node:test";
import { listXactDemoPrompts } from "../src/chatgpt-app/xact-demo-prompts";
import { FOUNDRY_CATALOG } from "../src/flagship/foundry-catalog";

test("every demo prompt is mapped to the current governed vocabulary", () => {
  const governedIds = new Set(FOUNDRY_CATALOG.map((entry) => entry.id));
  for (const prompt of listXactDemoPrompts()) {
    assert.ok(prompt.prompt.length > 0);
    assert.ok(prompt.note.length > 0);
    for (const capabilityId of prompt.capabilities) {
      assert.ok(governedIds.has(capabilityId), `"${capabilityId}" is not governed`);
    }
    if (prompt.expectedOutcome === "NOVEL_BOUNDARY" || prompt.expectedOutcome === "UNAUTHORIZED") {
      assert.equal(prompt.capabilities.length, 0, prompt.prompt);
      assert.equal(prompt.runtimeDataAvailable, false, prompt.prompt);
      assert.equal(prompt.resultKind, "contract-only", prompt.prompt);
    }
  }
});

test("the demo pack covers all seven required categories", () => {
  const categories = new Set(listXactDemoPrompts().map((prompt) => prompt.category));
  for (const category of ["normal", "adversarial", "read-only", "mutation", "evidence", "freshness", "cross-queue"] as const) {
    assert.ok(categories.has(category), `missing category ${category}`);
  }
});

test("mutation names as evidence/eligibility/next-action never resolve as mutation intent", () => {
  const prompts = listXactDemoPrompts();
  const mutationMentionedAsEvidence = prompts.filter((prompt) =>
    prompt.vocabulary.some((term) => /\(as (evidence|eligibility|possible next action|review context)/.test(term))
  );

  assert.ok(mutationMentionedAsEvidence.length >= 4);
  for (const prompt of mutationMentionedAsEvidence) {
    for (const capabilityId of prompt.capabilities) {
      const entry = FOUNDRY_CATALOG.find((candidate) => candidate.id === capabilityId);
      assert.equal(entry?.kind, "READ", `${capabilityId} must be READ, not a mutation, for: ${prompt.prompt}`);
    }
    assert.equal(prompt.expectedOutcome, "ALREADY_GOVERNED", prompt.prompt);
    assert.equal(prompt.resultKind, "executable-read", prompt.prompt);
  }
});

test("runtime availability and result kind are computed truthfully from the real wiring", () => {
  const prompts = listXactDemoPrompts();

  const waiting = prompts.find((prompt) => prompt.capabilities.includes("composed_read_customer_request"));
  assert.equal(waiting?.runtimeDataAvailable, true);
  assert.equal(waiting?.resultKind, "executable-read");

  const mutation = prompts.find((prompt) => prompt.capabilities.includes("issue_service_credit"));
  assert.equal(mutation?.runtimeDataAvailable, false);
  assert.equal(mutation?.resultKind, "contract-only");

  // Now wired: the employee directory resolves to an executable read.
  const directory = prompts.find((prompt) => prompt.capabilities.includes("get_employee_directory"));
  assert.equal(directory?.runtimeDataAvailable, true);
  assert.equal(directory?.resultKind, "executable-read");

  // Contract exists but no runtime handler → contract-only, not executable.
  const lookup = prompts.find((prompt) => prompt.capabilities.includes("find_customer_by_email"));
  assert.equal(lookup?.runtimeDataAvailable, false);
  assert.equal(lookup?.resultKind, "contract-only");
});

test("NOVEL_BOUNDARY prompts carry a useful, non-empty explanation", () => {
  const novel = listXactDemoPrompts().filter((prompt) => prompt.expectedOutcome === "NOVEL_BOUNDARY");
  assert.ok(novel.length >= 2);
  for (const prompt of novel) {
    assert.ok(prompt.note.length > 20, prompt.prompt);
    assert.equal(prompt.runtimeDataAvailable, false, prompt.prompt);
  }
});
