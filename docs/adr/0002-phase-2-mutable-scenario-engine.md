# ADR 0002 — Phase 2 uses a public-safe mutable scenario engine

- Status: Accepted
- Date: 2026-08-27
- Scope: Phase 2 — Mutable Scenario Engine

## Context

Phase 1 proved the architecture visually with presentation-only fixtures.
Phase 2 must produce genuine deterministic state transitions without importing,
inferring, or exposing proprietary Xact or X-Node implementation details.

The runtime must preserve the consequence boundary: reasoning may supply
evidence, but only Commit may authorize an effect. Commit must evaluate current
state, and execution capability must remain separate from authority.

## Decision

Introduce replaceable public contracts for `ScenarioPack`, `DecisionProvider`,
`PolicyProvider`, `EvidenceProvider`, `ExecutionAdapter`, and
`VerificationProvider`.

Commerce V1 supplies explicit demonstration inputs, state, constraints, and
effects. `SimulationDecisionProvider` creates a candidate containing canonical
R / U / C, evidence, a proposed effect, and a binding to the state observed at
Resolve. It is a clean-room simulator and does not represent production Xact
resolution or authorization internals.

Commit receives both the candidate and current state. It checks freshness
first, fails closed on unknown authority, and returns one of the canonical
decisions:

- `AUTHORIZED` permits selection of the scenario's simulated substrate.
- `REJECTED` is a final denial under the current request, policy, and state.
- `ESCALATED` requires additional resolution or authority and may produce a new
  candidate for a new Commit decision.
- `STALE` requires fresh resolution against current state.

Only semantic U invokes the simulated evidence provider. Its structured output
is evidence, never authority. Re-entry constructs a new candidate; it does not
reuse the previous Commit decision.

The simulated execution adapter accepts only an authorized effect released by
the runtime. The runtime rejects state drift after Commit and passes the exact
candidate recorded by that decision, not a mutable replacement. Verification
then compares the receipt and exact state delta with the authorized candidate.
Every non-authorized result selects `NONE`.

## Consequences

- The existing Control Room can render mutable runtime state without owning
  policy or consequence-boundary logic.
- Production providers may replace the simulation behind the same public
  contracts without redesigning the application.
- State mutation between Resolve and Commit produces `STALE`, even when the
  candidate also contains unresolved semantics.
- Unknown authority cannot become authorization by inference.
- Live WebMCP remains deferred; Phase 2 names only a simulated execution route.
- The Phase 1 fixtures remain in the repository as review history, but they no
  longer drive the application surface.
