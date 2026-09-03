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

test("every successful build returns the three-part summary: answer, boundary, next step", async () => {
  const read = await constructChatGPTCapability("read_active_users_and_open_requests");
  assert.match(read.summary.builtAndValidated, /read-only `read_active_users_and_open_requests`/);
  assert.match(read.summary.builtAndValidated, /active user count/);
  assert.match(read.summary.currentBoundary, /No data was read/);
  assert.match(read.summary.nextRequiredCapability, /read handler bound to the approved Foundry customer directory/);

  const mutation = await constructChatGPTCapability("reassign_support_ticket");
  assert.match(mutation.summary.builtAndValidated, /governed mutation `reassign_support_ticket`/);
  assert.match(mutation.summary.currentBoundary, /fresh Xact Commit/);

  const draft = await constructChatGPTCapability("prepare_weekly_promotional_email_campaign");
  assert.match(draft.summary.builtAndValidated, /draft-only `prepare_weekly_promotional_email_campaign`/);
  assert.match(draft.summary.currentBoundary, /nothing was sent or scheduled/);
});
