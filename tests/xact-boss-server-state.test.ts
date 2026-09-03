import assert from "node:assert/strict";
import test from "node:test";
import {
  createInMemoryBossSessionStore,
  type BossSessionStore,
} from "../src/chatgpt-app/xact-boss-loop";
import { createXactMcpServer } from "../src/chatgpt-app/xact-mcp-server";

type RegisteredTool = {
  handler: (input: Record<string, unknown>) => Promise<{
    structuredContent?: Record<string, unknown>;
    isError?: boolean;
  }>;
};

function tool(server: ReturnType<typeof createXactMcpServer>, name: string): RegisteredTool {
  const registered = server as unknown as { _registeredTools: Record<string, RegisteredTool> };
  return registered._registeredTools[name];
}

function serverWith(store: BossSessionStore) {
  return createXactMcpServer({ bossSessionStore: store });
}

test("Boss run state survives a new MCP server instance for every tool call", async () => {
  const store = createInMemoryBossSessionStore();

  const started = await tool(serverWith(store), "start_capability_build").handler({
    intent: "Build a WebMCP tool that lets support agents issue a service credit up to $25",
  });
  assert.equal(started.isError, undefined);
  assert.equal(started.structuredContent?.status, "WAITING_FOR_BOSS");
  const runId = String(started.structuredContent?.runId);

  const context = await tool(serverWith(store), "get_boss_request").handler({ runId });
  assert.equal(context.isError, undefined);
  const unresolved = context.structuredContent?.unresolved as Array<{ id: string }>;
  assert.ok(unresolved[0].id.startsWith("u-"));

  const submitted = await tool(serverWith(store), "submit_boss_resolution").handler({
    runId,
    resolutions: unresolved.map(({ id }) => ({
      unresolvedId: id,
      resolution: {
        interpretation: "A support agent may propose the bounded $25 credit for a verified service-recovery case.",
      },
    })),
  });
  assert.equal(submitted.isError, undefined);
  assert.equal(submitted.structuredContent?.status, "BUILT");
});
