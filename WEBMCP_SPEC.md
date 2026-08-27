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

## Execution routing

Prefer the most deterministic available substrate after Commit authorization:

`structured/local → WebMCP → DOM/accessibility → Vision → future adapter`

Changing substrate does not itself justify invoking an O-Agent.
