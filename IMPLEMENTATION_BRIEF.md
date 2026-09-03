# Implementation Brief — Phase 0 → Phase 2

## Objective

Create the smallest working shell that visibly proves the architecture before adding real WebMCP execution.

## Phase 0 — Foundation

- Establish repository
- Add canonical docs
- Define interfaces
- Define scenario schema
- Define audit-event schema
- Add architecture-boundary tests

## Phase 1 — Static control room

Build a single-page control-room UI using deterministic fixture data.

Required panels:

- request
- R / U / C
- evidence + provenance
- O-Agent involvement
- authorization state
- selected execution substrate
- trace timeline
- verification result

Required scenario switcher:

- Authorized
- Rejected
- Escalated
- Stale

## Phase 1 exit criteria

A reviewer can click through four scenarios and understand the architecture without backend integration.

No production Xact internals are required or permitted.

## Phase 2 target

Replace fixtures with a mutable `ScenarioPack` runtime and public-safe `SimulationDecisionProvider`.

## Phase 2 implementation

- Replaceable scenario, decision, policy, evidence, execution, and verification contracts
- Mutable Commerce V1 inputs and relevant state
- State-bound Resolve and current-state Commit
- Semantic escalation, structured evidence, and governed re-entry
- Simulated execution only after `AUTHORIZED`
- Exact post-effect verification and inspectable runtime trace
- First-class negative-path tests for rejection, escalation, stale state,
  unknown authority, pre-authorization execution, substrate selection, and
  verification failure

WebMCP remains a named simulated execution substrate. Live WebMCP integration
is deliberately deferred until this boundary is reviewed and stable.

## Phase 2 modular demonstrations

- Live telemetry from the public runtime, separated from historical reference
  benchmark evidence
- Deterministic and semantic-path timing with reasoning reported independently
- Public-safe evolution lifecycle from `OBSERVED` through `ACTIVE`
- Explicit governed transitions with no pre-ACTIVE behavior changes
- Equivalent-request replay proving U reduction without weakening Commit

These demonstrations are observer and resolution-evidence modules. They do not
replace or redesign the approved mutable runtime.
