import assert from "node:assert/strict";
import test from "node:test";
import { constructChatGPTReadCapability, listChatGPTCapabilities } from "../src/chatgpt-app/xact-foundry-tools";

test("ChatGPT bridge lists only public-safe READ recipes", () => {
  const capabilities = listChatGPTCapabilities();
  assert.ok(capabilities.length > 10);
  assert.ok(capabilities.some((capability) => capability.id === "get_employee_directory"));
  assert.equal(capabilities.some((capability) => capability.id === "issue_service_credit"), false);
});

test("ChatGPT bridge invokes real deterministic Foundry construction for a known read capability", async () => {
  const result = await constructChatGPTReadCapability("get_employee_directory");
  assert.equal(result.status, "COMPOSED_DEFINITION");
  assert.equal(result.definition.name, "get_employee_directory");
  assert.equal(result.definition.capabilityKind, "READ");
  assert.equal(result.definition.requiresCommit, false);
  assert.equal("execute" in result.definition, false);
  assert.ok(result.activity.some((event) => event.type === "COMMIT" && event.status === "PASS"));
  assert.ok(result.activity.some((event) => event.type === "BUILD" && event.status === "PASS"));
});

test("ChatGPT bridge rejects unknown and consequential recipes", async () => {
  await assert.rejects(() => constructChatGPTReadCapability("invent_customer_score"), /Unknown approved Xact capability/);
  await assert.rejects(() => constructChatGPTReadCapability("issue_service_credit"), /not available through the public ChatGPT bridge/);
});

test("ChatGPT bridge permits only declared bounded fields", async () => {
  const result = await constructChatGPTReadCapability("get_division_roster", { division: "Engineering" });
  assert.equal(result.definition.name, "get_division_roster");
  await assert.rejects(() => constructChatGPTReadCapability("get_division_roster", { role: "CEO" }), /Unknown bound/);
});
