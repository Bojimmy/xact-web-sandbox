# ADR 0006 — WebMCP Transport Is Capability, Not Authority

**Status:** Accepted

**Depends on:** ADR 0004 (authorization artifacts) and ADR 0005 (the
substrate-neutral execution router).

## Context

Phase 3 needs a browser-facing WebMCP execution path without making browser
tool availability, tool output, or a transport retry an authorization decision.
The sandbox must also remain honest when a browser does not expose WebMCP.

## Decision

1. `WebMCPExecutionAdapter` is a second `ExecutionAdapter`, using the same
   public artifact validation and atomic nonce-consumption boundary as the
   simulated adapter.
2. `BrowserWebMCPExecutionClient` feature-detects `document.modelContext` and
   uses only two named, page-provided tools: `request_action` and
   `get_execution_observation`.
3. The client sends an already-issued `AuthorizationArtifact` and exact effect
   to `request_action`. It cannot issue an artifact, alter the effect, choose an
   actor/capability, or turn a tool into an authority source.
4. A receipt is accepted only when the page's `request_action` returns one;
   observation is a separate read of the page's execution record. Intended
   payload is never substituted for an observation.
5. Missing `modelContext`, missing tools, a missing receipt, or a transport
   exception is a non-execution outcome. The runtime records
   `EXECUTION_FAILED`, applies no scenario effect, withholds verification
   success, and requires a new Commit decision before another attempt.
6. A guard rejection (expired/tampered/replayed/effect-mismatched/stale)
   remains a hard consequence-boundary block, not an execution attempt.

## Consequences

- The default Control Room remains public-safe and simulated; passing a
  `WebMCPExecutionAdapter` to `CommerceSimulationEngine` is an explicit,
  replaceable integration choice.
- DOM and Vision remain unimplemented placeholders. No fallback automatically
  occurs merely because WebMCP is unavailable.
- A live demonstration requires a WebMCP-enabled, origin-isolated browser and
  a page that registers the two tools. This repository does not claim that an
  unavailable browser has executed an effect.

## Verification

The test suite covers successful structured transport/observation, feature
detection, missing WebMCP, transport failure, replay suppression, no state
mutation on failure, and verification that includes the independent observed
receipt.
