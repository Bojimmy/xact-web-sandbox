import assert from "node:assert/strict";
import test from "node:test";
import { prepareFoundryRunExplanation } from "../src/flagship/foundry-run-explainer";
import { prepareFoundryRunExplainer, renderEffectPayload } from "../src/explainer";
import type { FoundryActivity } from "../src/flagship/foundry-liaison";
import type { WebMCPToolDefinition } from "../src/flagship/webmcp-tool-builder";

const event = (type: FoundryActivity["type"], status: FoundryActivity["status"] = "PASS"): FoundryActivity => ({ type, status, label: type, detail: `${type} actually occurred` });
const tool: WebMCPToolDefinition = {
  kind: "WEBMCP_TOOL_DEFINITION",
  name: "read_active_users",
  description: "Read active users.",
  capabilityKind: "READ",
  inputSchema: { type: "object", required: [], properties: {} },
  outputSchema: { type: "object", required: [], properties: {} },
  boundaries: [],
  errorContract: { kind: "TOOL_ERROR_CONTRACT", errors: { UNAVAILABLE: "The read capability is unavailable.", UNAUTHORIZED: "The read capability requires a valid session." } },
  requiresCommit: false,
};

test("Foundry explanation projects only emitted construction, host, and read evidence", () => {
  const explanation = prepareFoundryRunExplanation({
    prompt: "Show active users",
    tool,
    activity: [event("RESOLVE"), event("BUILD"), event("REGISTER"), event("OBSERVE"), event("VERIFY")],
    invocation: { toolName: tool.name, status: "READ_RESULT", result: { activeUsers: 2 }, audit: ["READ read_active_users: deterministic substrate returned a result."] },
  });
  assert.deepEqual(explanation?.cards.map((card) => card.title), ["WHAT YOU ASKED", "WHAT XACT CONSTRUCTED", "WHAT THE HOST VERIFIED", "WHAT THE TOOL DID"]);
  assert.match(explanation?.cards.at(-1)?.primary ?? "", /ran read_active_users/);
  assert.ok(explanation?.cards.every((card) => card.truth === "LIVE"));
});

test("Foundry explanation says a blocked mutation did not run", () => {
  const explanation = prepareFoundryRunExplanation({
    tool: { ...tool, name: "issue_credit", capabilityKind: "MUTATION", requiresCommit: true },
    activity: [event("BUILD")],
    invocation: { toolName: "issue_credit", status: "BLOCKED_NO_AUTHORITY", audit: ["MUTATION issue_credit: no fresh Commit authorization."] },
  });
  const run = explanation?.cards.find((card) => card.id === "run");
  assert.match(run?.primary ?? "", /did not run the consequence/);
  assert.doesNotMatch(run?.primary ?? "", /applied/);
});

test("Foundry explanation does not fabricate a construction card when BUILD never emitted", () => {
  const explanation = prepareFoundryRunExplanation({ tool, activity: [event("RESOLVE")] });
  assert.ok(!explanation?.cards.some((card) => card.id === "constructed"));
});

test("Foundry evidence prepares the same Commit-gated explainer shape without a simulated session", () => {
  const prepared = prepareFoundryRunExplainer({
    prompt: "Show active users",
    tool,
    activity: [event("RESOLVE"), event("BUILD")],
    invocation: { toolName: tool.name, status: "READ_RESULT", result: { activeUsers: 2 }, audit: ["READ read_active_users: deterministic substrate returned a result."] },
  });
  assert.equal(prepared?.manifest.kind, "FOUNDRY_EXPLAINER_MANIFEST");
  assert.equal(renderEffectPayload(prepared!).type, "RENDER_EXPLAINER");
  assert.ok(prepared?.manifest.stateFingerprint.value);
});
