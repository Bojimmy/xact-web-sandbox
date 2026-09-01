# ADR 0004: Public ChatGPT MCP bridge for Xact Foundry READ definitions

## Status

Accepted — 2026-08-31

## Decision

Deploy a dedicated `mcp-bridge/` app to the public Xact Foundry MCP Site project. The app exposes a Streamable HTTP MCP endpoint at `/api/mcp` and an MCP Apps widget resource. It provides only two read-only tools:

- `list_read_recipes` returns the approved public-safe recipe catalog.
- `request_webmcp_tool` constructs an inert WebMCP definition for one approved recipe.

Every returned definition is marked `executable: false` and `authority: XACT_COMMIT_REQUIRED`. The bridge never performs a consequential action and never grants Commit authority.

## Boundary and failure modes

The public bridge is an adapter layer, not the private Xact execution core. Unknown recipes, malformed requests, and unsupported MCP methods fail closed at the HTTP/MCP boundary. CORS is limited to the headers required by the public MCP client.

## Consequences

ChatGPT Developer Mode can connect directly to the public `/api/mcp` URL, and compatible MCP Apps clients can render the bundled widget. The transport is stateless because Sites may route consecutive requests to different edge isolates; no discovery request may depend on in-memory session state. Changes to the tool surface must update the contract test and remain public-safe.
