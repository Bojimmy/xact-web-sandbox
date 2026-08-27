# ADR 0001 — Phase 1 uses deterministic presentation fixtures

- Status: Accepted
- Date: 2026-08-27
- Scope: Phase 1 — Xact Control Room

## Context

Phase 1 must visibly prove the architecture before introducing a mutable
scenario runtime or WebMCP execution. The public repository may expose Xact
concepts, interfaces, traces, simulated policies, and clean-room consequence
boundary mechanics, but it must not reconstruct or imply proprietary
resolution internals.

## Decision

The Control Room renders four typed, deterministic Commerce V1 fixtures behind
a presentation-only scenario model:

- Authorized
- Rejected
- Escalated
- Stale

Each fixture carries explicit request, R/U/C, evidence provenance, O-Agent
involvement, Commit checks, execution routing, trace, and verification data.
The UI does not evaluate policy, infer confidence, resolve semantics, mutate
state, or execute effects.

Fixture invariants are tested at the consequence boundary. Only the Authorized
fixture may contain an execution receipt and verified effect. Rejected,
Escalated, and Stale must expose no executable substrate.

## Consequences

- Reviewers can inspect the complete architecture without backend integration.
- The visual system cannot be mistaken for an authorization engine.
- Phase 2 may replace fixture delivery with `ScenarioPack` and
  `SimulationDecisionProvider` implementations while preserving the Control
  Room's public model and architecture.
- WebMCP remains an execution substrate below Commit and is not simulated as an
  authority source.
