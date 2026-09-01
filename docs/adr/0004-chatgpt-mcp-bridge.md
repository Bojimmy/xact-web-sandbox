# ADR 0004: Public ChatGPT MCP bridge and O-Agent reasoning loop

## Status

Accepted — 2026-08-31

## Decision

Deploy a dedicated `mcp-bridge/` app to the public Xact Foundry MCP Site project. The app exposes a Streamable HTTP MCP endpoint at `/api/mcp` and an MCP Apps widget resource. It provides four read-only tools:

- `list_read_recipes` returns the approved public-safe recipe catalog.
- `request_webmcp_tool` constructs an inert WebMCP definition for one approved recipe.
- `resolve_o_agent_case` returns the state-bound R / U / C brief for one public-safe ambiguous-refund case.
- `submit_o_agent_evidence` accepts ChatGPT-authored structured evidence, revalidates the candidate binding, and returns a new Xact Commit decision.

Server instructions require ChatGPT to act as the O-Agent: call Resolve first, reason only over U using returned R, C, and evidence, then submit the structured finding for Xact re-entry. ChatGPT's output is evidence and explicitly grants no authority. Every returned WebMCP definition remains `executable: false` with `authority: XACT_COMMIT_REQUIRED`. The bridge never performs a consequential action.

## Boundary and failure modes

The public bridge is an adapter layer, not the private Xact execution core. The O-Agent case is a fixed, labeled, clean-room simulation and exposes no production resolution, policy, scoring, or authorization internals. A stale candidate binding returns `STALE`; insufficient evidence returns `ESCALATED`; a resolved but unsupported rationale returns `REJECTED`. Even `AUTHORIZED` returns `NOT_EXECUTED` with `effectReleased: false`. Unknown recipes, malformed requests, and unsupported MCP methods fail closed at the HTTP/MCP boundary. CORS is limited to the headers required by the public MCP client.

## Consequences

ChatGPT Developer Mode can connect directly to the public `/api/mcp` URL, use ChatGPT as the O-Agent reasoning engine, and render the bundled widget for READ catalog results. The transport is stateless because Sites may route consecutive requests to different edge isolates; the second O-Agent tool therefore revalidates the identifiers and state binding returned by the first. Changes to the tool surface must update the contract and consequence-boundary tests and remain public-safe.
