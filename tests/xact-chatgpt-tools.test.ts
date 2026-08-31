import assert from "node:assert/strict";
import test from "node:test";
import { constructChatGPTCapability, listChatGPTCapabilities } from "../src/chatgpt-app/xact-foundry-tools";

test("ChatGPT bridge lists governed Foundry recipes and labels semantic review", () => {
  const capabilities = listChatGPTCapabilities();
  assert.ok(capabilities.length > 25);
  assert.ok(capabilities.some((capability) => capability.id === "get_employee_directory"));
  assert.ok(capabilities.some((capability) => capability.id === "reassign_support_ticket" && capability.kind === "MUTATION"));
  assert.ok(capabilities.some((capability) => capability.id === "issue_service_credit" && capability.semanticReviewRequired));
});

test("ChatGPT bridge invokes real deterministic Foundry construction for an approved tool", async () => {
  const result = await constructChatGPTCapability("get_employee_directory");
  assert.equal(result.status, "COMPOSED_DEFINITION");
  assert.equal(result.definition.name, "get_employee_directory");
  assert.equal(result.definition.capabilityKind, "READ");
  assert.equal(result.definition.requiresCommit, false);
  assert.equal("execute" in result.definition, false);
  assert.ok(result.activity.some((event) => event.type === "COMMIT" && event.status === "PASS"));
  assert.ok(result.activity.some((event) => event.type === "BUILD" && event.status === "PASS"));
});

test("ChatGPT bridge composes bounded mutation definitions but never an execute surface", async () => {
  const result = await constructChatGPTCapability("reassign_support_ticket");
  assert.equal(result.definition.capabilityKind, "MUTATION");
  assert.equal(result.definition.requiresCommit, true);
  assert.equal("execute" in result.definition, false);
  assert.match(result.guarantee, /fresh Commit/);
});

test("ChatGPT bridge rejects unknown capabilities and requires semantic review honestly", async () => {
  await assert.rejects(() => constructChatGPTCapability("invent_customer_score"), /Unknown approved Xact capability/);
  await assert.rejects(() => constructChatGPTCapability("issue_service_credit"), /needs semantic review/);
});

test("ChatGPT bridge permits only declared bounded fields", async () => {
  const result = await constructChatGPTCapability("get_division_roster", { division: "Engineering" });
  assert.equal(result.definition.name, "get_division_roster");
  await assert.rejects(() => constructChatGPTCapability("get_division_roster", { role: "CEO" }), /Unknown bound/);
});
