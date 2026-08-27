# Xact Web Sandbox

**Xact — The Commit Layer for Agentic Web**

> Reason when necessary. Execute Xactly.

Xact Web Sandbox is a public-safe demonstration of a deterministic consequence boundary for agentic web execution.

## Core principle

> **Reasoning may propose a consequence. Only Xact may commit one.**

WebMCP, DOM/browser control, Vision, native APIs, and future adapters provide execution capability. They do not provide authority.

## Canonical flow

`Request → Resolve → Reason only if unresolved → Re-entry → Validate → Authorize → Commit → Select execution substrate → Execute → Verify → Audit`

## Demonstrations

- Authorized action
- Policy rejection
- Semantic escalation
- Stale-state rejection

See `PROJECT.md`, `ARCHITECTURE.md`, and `PUBLIC_BOUNDARY.md` before implementation.

## Phase 2 — Mutable Scenario Engine

The Control Room now runs a deterministic, public-safe Commerce V1 runtime.
Change the request or simulated authority state, resolve a state-bound
candidate, mutate current state, re-enter with structured evidence when U
requires interpretation, and request a new Commit decision.

The happy path selects a simulated WebMCP substrate only after `AUTHORIZED`,
applies a simulated effect, and verifies the observed result. Every
non-authorized decision selects `NONE` and cannot execute.

The runtime contains explicit demonstration rules only. It does not implement,
imitate, or expose production Xact resolution or authorization internals.

### Xact telemetry

The telemetry panel reports actual timings from the running public sandbox for
Resolve, Policy, Commit, optional reasoning/re-entry, and Verification. A
separate reference card shows supplied historical Xact benchmark evidence and
explicitly states that it is not a browser-sandbox measurement.

### Xact evolution

The Evolution panel demonstrates a public-safe governed lifecycle:

`OBSERVED → CANDIDATE → VALIDATED → APPROVED → ACTIVE`

Complete an ambiguous first encounter, promote the resulting candidate through
each explicit state, then replay the equivalent request. ACTIVE evidence moves
the semantic field into R and leaves U empty, but Commit remains independently
required before execution.

```bash
npm install
npm run dev
```

Before review:

```bash
npm test
npm run lint
npm run build
```
