# Xact Foundry MCP Bridge

Public-safe ChatGPT MCP bridge for Xact Foundry. ChatGPT acts as the O-Agent reasoning engine for a bounded public case: Xact returns R / U / C, ChatGPT reasons only over U and submits structured evidence, and Xact re-enters and makes the Commit decision. The bridge also exposes the approved READ catalog and inert WebMCP definitions. It never executes effects or grants model reasoning Commit authority.

## Local verification

```bash
npm run build
npm run start -- --port 3003
```

Use an MCP client or the MCP Inspector against `http://localhost:3003/mcp`. The production URL uses the Sites API route:

`https://xact-foundry-mcp.bojimmy.chatgpt.site/api/mcp`

The O-Agent sequence is:

1. `resolve_o_agent_case`
2. ChatGPT reasons only over the returned `U` using the supplied evidence.
3. `submit_o_agent_evidence`
4. Xact returns `AUTHORIZED`, `REJECTED`, `ESCALATED`, or `STALE`; execution remains separate.

## ChatGPT Developer Mode

Enable Developer mode in ChatGPT Settings, open the Apps/Plugins connection page, choose **Add connection**, select a public MCP endpoint, and paste the URL above. Refresh the connection after redeploying so ChatGPT reloads the tool manifest.
