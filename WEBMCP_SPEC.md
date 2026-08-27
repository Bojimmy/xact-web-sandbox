# WebMCP Integration Specification

## Principle

> WebMCP provides structured capability. Xact governs whether a requested consequence may occur.

WebMCP is an execution substrate beneath Commit, not an authority system.

## Candidate public tools

- `inspect_request`
- `get_customer`
- `get_order`
- `get_policy`
- `get_xact_state`
- `request_action`
- `get_execution_options`
- `get_audit_trace`

Use `request_action`, not `force_action`.

## Contract rule

A WebMCP invocation may:

- observe state
- request a consequence
- provide structured evidence
- execute an already-authorized effect

A WebMCP invocation must never self-authorize a consequential effect.

## Phase 3 transport contract

`WebMCPExecutionAdapter` is a public, replaceable `ExecutionAdapter`. Before
calling a browser tool it independently validates the exact
`AuthorizationArtifact`; it atomically consumes that artifact's nonce directly
before the transport request. WebMCP availability is capability information,
not authority information.

The browser client uses feature-detected `document.modelContext` and two
page-provided tools:

- `request_action({ authorizationArtifact, effect })` returns an execution receipt.
- `get_execution_observation({ receipt })` returns the page's actual execution record.

Both tools are beneath Commit. A page must not implement either tool as a
self-authorizing escape hatch. Missing `modelContext`, missing tools, a missing
receipt, or a transport exception means **no execution**. The runtime records
the failure, applies no effect, and cannot report verification success.

The default Control Room remains simulated. A live WebMCP demonstration needs
a WebMCP-enabled, origin-isolated browser plus a page that registers these
tools; the sandbox never treats an unavailable browser as a successful effect.

## Execution routing

Prefer the most deterministic available substrate after Commit authorization:

`structured/local → WebMCP → DOM/accessibility → Vision → future adapter`

Changing substrate does not itself justify invoking an O-Agent.

## Cross-substrate invariant

The execution router may route one already-authorized payload from WebMCP to
DOM or Vision when availability changes. It preserves the same
`AuthorizationArtifact`, effect fingerprint, target, actor, capability, and
state binding; only the `substrate` on the execution envelope changes. See
ADR 0007 for the typed observation and fallback contract.

For the Vision route, ADR 0008 adds a non-consequential visual preflight and
an immediate exact-target re-check before nonce consumption. Vision can locate
the target bound in the effect; it cannot redefine one.
