# ADR 0017 — Governed Campaign Interface

**Status:** Accepted

**Depends on:** ADR 0004 (Authorization Artifact), ADR 0005/0007/0008
(execution routing and substrate independence), ADR 0012 (flagship), ADR 0013
(Service Operations Console), ADR 0015 (Run Explainer). It changes none of
their authority semantics.

## Context

The public sandbox needs an engaging path through the Xact proof without
turning governance into a score or suggesting that progress grants authority.
The existing control room is an evidence-rich runtime interface, while the new
level campaign is a guided, browser-local teaching surface. They have different
jobs and must not be presented as the same evidence source.

## Decision

The root route is a ten-level **governance campaign**. The Stage 3 runtime is
preserved at `/control-room` and remains the place to inspect real public-safe
Resolve, Commit, execution-routing, observation, and verification evidence.

The campaign is a presentation-layer projection with browser-local run state.
Its execution loadout is explicitly labeled a **public-safe simulation**. It
must not claim a live receipt, live state mutation, or live substrate result.
Every evidence row identifies its provenance as verified, reported, derived, or
simulated.

### Consequence boundary

Level 03 stores the exact Commit outcome. Level 04 derives its path from that
outcome and fails closed:

- `AUTHORIZED` may enter the simulated substrate-selection exercise.
- `REJECTED_EXCESS`, `REJECTED_SOCIAL`, or a missing outcome records
  `BLOCKED_NO_AUTHORITY`, selects no substrate, and attempts no effect.

A refusal is valid campaign progress because it proves the boundary held. The
ladder therefore reports `REFUSED` and `NOT EXECUTED`, not the generic
`COMMITTED` and `EXECUTED` labels.

### Learning language

The campaign may accept a bounded **capability proposal** for governance. It
does not say that the judge directly teaches, activates, authorizes, or deploys
a capability. `ACTIVATED` continues to mean participation in deterministic
resolution only; future consequences still require Commit.

## Public/private boundary

The campaign contains only public-safe scenario data and does not expose or
invent proprietary Xact internals. The O-Agent remains limited to genuine U;
neither the campaign nor its run explainer exposes chain-of-thought. The real
control room retains the canonical authority and execution machinery.

## Consequences

- The campaign can be optimized for engagement without weakening Commit.
- Rejected paths remain playable and truthful instead of becoming dead ends.
- Browser-local campaign receipts are visibly simulated and cannot be confused
  with control-room runtime evidence.
- Responsive layouts expose the active mission before secondary run details;
  the level ladder becomes a compact horizontal rail on narrow viewports.
