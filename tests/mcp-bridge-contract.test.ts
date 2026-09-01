import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";

const root = join(process.cwd(), "mcp-bridge");

test("MCP route is a connected, stateless Streamable HTTP endpoint", async () => {
  const source = await readFile(join(root, "app/mcp/route.ts"), "utf8");
  assert.match(source, /WebStandardStreamableHTTPServerTransport/);
  assert.match(source, /await server\.connect\(transport\)/);
  assert.match(source, /sessionIdGenerator:\s*undefined/);
  assert.match(source, /await server\.close\(\)/);
  assert.doesNotMatch(source, /const sessions/);
  assert.match(source, /export async function POST/);
  assert.match(source, /XACT_COMMIT_REQUIRED/);
  assert.doesNotMatch(source, /force_action|commit_action|executeEffect/);
});

test("MCP instructions make ChatGPT the bounded O-Agent reasoning engine", async () => {
  const source = await readFile(join(root, "app/mcp/route.ts"), "utf8");
  assert.match(source, /ChatGPT is the O-Agent reasoning engine/);
  assert.match(source, /Reason only over the returned U/);
  assert.match(source, /evidence, never authorization/);
  assert.match(source, /resolve_o_agent_case/);
  assert.match(source, /submit_o_agent_evidence/);
});

test("O-Agent tools expose reasoning and re-entry without execution authority", async () => {
  const source = await readFile(join(root, "app/mcp/route.ts"), "utf8");
  assert.match(source, /registerAppTool\(server, "resolve_o_agent_case"/);
  assert.match(source, /registerAppTool\(server, "submit_o_agent_evidence"/);
  assert.match(source, /grantsAuthority: z\.literal\(false\)/);
  assert.match(source, /effectReleased: z\.literal\(false\)/);
  assert.doesNotMatch(source, /executeEffect|executeAndVerify/);
});

test("widget declares its submission domain on the resource metadata", async () => {
  const source = await readFile(join(root, "app/mcp/route.ts"), "utf8");
  assert.match(source, /const WIDGET_DOMAIN = "https:\/\/xact-foundry-mcp\.bojimmy\.chatgpt\.site"/);
  assert.match(source, /domain: WIDGET_DOMAIN/);
  assert.match(source, /"openai\/widgetDomain": WIDGET_DOMAIN/);
});

test("widget uses the MCP Apps bridge and portable tools/call fallback", async () => {
  const source = await readFile(join(root, "app/mcp/widget.html"), "utf8");
  assert.match(source, /ui\/initialize/);
  assert.match(source, /ui\/notifications\/tool-result/);
  assert.match(source, /tools\/call/);
  assert.match(source, /request_webmcp_tool/);
});

test("widget exposes a full-app destination in ChatGPT", async () => {
  const source = await readFile(join(root, "app/mcp/widget.html"), "utf8");
  assert.match(source, /setOpenInAppUrl/);
  assert.match(source, /openExternal/);
  assert.match(source, /https:\/\/xact-foundry-mcp\.bojimmy\.chatgpt\.site/);
});

test("public root is a linked, tool-backed Xact launch surface", async () => {
  const source = await readFile(join(root, "app/page.tsx"), "utf8");
  assert.doesNotMatch(source, /Foundry MCP Bridge/);
  assert.match(source, /request_webmcp_tool/);
  assert.match(source, /ChatGPT is the O-Agent brain/);
  assert.match(source, /Reason over U/);
  assert.match(source, /Xact makes the Commit decision/);
  assert.match(source, /https:\/\/chatgpt\.com\/plugins/);
  assert.match(source, /https:\/\/xact-web-sandbox\.bojimmy\.chatgpt\.site/);
});
