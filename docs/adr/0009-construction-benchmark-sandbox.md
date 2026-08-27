# ADR 0009 — Bounded Xact Construction Benchmark

**Status:** Experimental proof branch

**Depends on:** Existing public-safe Resolution, Commit, telemetry, and
governed-evolution interfaces. It does not alter the Phase 5 authorization or
execution-substrate boundaries.

## Decision

Phase 6A introduces `XACT CONSTRUCTION LAB`, an isolated, declarative
construction sandbox for exactly two fixed requests: inventory dashboard and
related order dashboard. It assembles local application artifacts only from an
approved primitive registry; it is not a general code generator.

Construction operations are immutable dependency-graph nodes. Nodes with
complete primitive/input/dependency authority are deterministically authorized
and run through a bounded scheduler. Only a classified U may call an injected,
schema-bound `ConstructionProposalProvider`; its proposal is evidence and must
pass primitive validation and Xact re-entry before workers can execute it.

## Concurrency and telemetry

The scheduler dispatches only dependency-ready, authorized nodes in bounded
batches for configurations 1, 10, 25, 50, and 100. It measures actual:

- total operations and dependency stages;
- configured, peak, and average active X-Nodes;
- sequential-equivalent operation time, critical-path time, scheduler time,
  total time-to-working-app, and resulting speedup;
- deterministic/U operation counts, O-Agent calls/tokens, validation failures,
  unauthorized operations, and final result.

These values are local live-construction measurements. They are never combined
with or extrapolated from the Reference Xact Benchmark.

## Boundary

No operation may emit source code, call a shell, install packages, create an
arbitrary route, or write arbitrary files. The only mutable artifact is a
deterministic local dashboard store. Existing AuthorizationArtifact, WebMCP,
DOM, Vision, observation, verification, and Commit contracts are unchanged.
