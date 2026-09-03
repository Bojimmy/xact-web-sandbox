import assert from "node:assert/strict";
import test from "node:test";
import { decomposeIntent } from "../src/flagship/foundry-liaison";
import { constructChatGPTCapability, readChatGPTCapability } from "../src/chatgpt-app/xact-foundry-tools";
import { validateComposition } from "../src/chatgpt-app/capability-composition";
import { readEmployeeDirectory, readSalesLeaderboard } from "../src/flagship/business-workspace";

test("sales-leaderboard requests resolve to get_sales_leaderboard, never get_employee_directory", () => {
  for (const intent of [
    "Show me the sales leaderboard ranked by revenue.",
    "Rank the top sales reps by revenue.",
    "Give me the sales leaderboard.",
  ]) {
    const id = decomposeIntent(intent).pattern?.id;
    assert.equal(id, "get_sales_leaderboard", intent);
    assert.notEqual(id, "get_employee_directory", intent);
  }
});

test("get_sales_leaderboard is a read-only contract with no execute surface", async () => {
  const built = await constructChatGPTCapability("get_sales_leaderboard");
  assert.equal(built.definition.capabilityKind, "READ");
  assert.equal(built.definition.requiresCommit, false);
  assert.equal("execute" in built.definition, false);
  for (const field of ["representative", "team", "closed-deals", "revenue", "quota-attainment", "rank"]) {
    assert.ok(built.definition.outputSchema.required.includes(field), `missing ${field}`);
  }
});

test("get_sales_leaderboard returns the fictional leaderboard as an executable read", () => {
  const result = readChatGPTCapability("get_sales_leaderboard");
  assert.equal(result.readOnly, true);
  assert.equal(result.data.title, "Sales leaderboard");
  assert.equal(result.data.rows.length, 5);
  assert.equal(result.data.rows[0].rank, "1");
  assert.ok(result.data.rows[0].representative.length > 0);
  assert.ok(result.data.rows[0].revenue.length > 0);
});

test("the sales-leaderboard composition is governed and read-only", () => {
  const result = validateComposition({
    capability: "READ",
    resource: ["SALES_OPPORTUNITY"],
    operation: ["LIST"],
    output: ["REPRESENTATIVE", "TEAM", "CLOSED_DEALS", "REVENUE", "QUOTA_ATTAINMENT", "RANK"],
  });
  assert.equal(result.outcome, "ALREADY_GOVERNED");
  if (result.outcome === "ALREADY_GOVERNED") assert.equal(result.capabilityId, "get_sales_leaderboard");
});

test("sales leaderboard representatives are actual Sales division employees", () => {
  const salesEmployees = new Set(
    readEmployeeDirectory().rows
      .filter((row) => row.division === "Sales")
      .map((row) => row.name),
  );
  const leaderboard = readSalesLeaderboard().rows;
  assert.ok(leaderboard.length > 0);
  for (const row of leaderboard) {
    assert.ok(salesEmployees.has(row.representative), `${row.representative} is not a Sales division employee`);
  }
});
