# Implementation Brief — Phase 0 → Phase 1

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
