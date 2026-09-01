# Xact Foundry MCP Bridge

Public-safe ChatGPT MCP bridge for the Xact Foundry READ surface. The bridge exposes `/api/mcp` and an MCP Apps widget; it returns definitions only and never executes effects or grants Commit authority.

## Local verification

```bash
npm run build
npm run start -- --port 3003
```

Use an MCP client or the MCP Inspector against `http://localhost:3003/mcp`. The production URL uses the Sites API route:

`https://xact-foundry-mcp.bojimmy.chatgpt.site/api/mcp`

## ChatGPT Developer Mode

Enable Developer mode in ChatGPT Settings, open the Apps/Plugins connection page, choose **Add connection**, select a public MCP endpoint, and paste the URL above. Refresh the connection after redeploying so ChatGPT reloads the tool manifest.
