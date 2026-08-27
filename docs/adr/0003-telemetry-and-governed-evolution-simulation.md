# ADR 0003 — Telemetry and governed evolution remain evidence-only modules

- Status: Accepted
- Date: 2026-08-27
- Scope: Phase 2 modular demonstrations

## Context

The sandbox must demonstrate deterministic processing speed and the principle
that reasoning can reduce future reasoning. Neither demonstration may alter the
approved consequence boundary, misrepresent historical evidence as live
measurement, or reconstruct production learning internals.

## Decision

### Telemetry

Use a replaceable `TelemetryProvider` around public runtime operations. Each
sample carries the kind `LIVE_SANDBOX_MEASUREMENT`, its stage, an observed
duration from the runtime performance clock, and a timestamp.

Historical benchmark figures live in a separate immutable
`BenchmarkReference` with the kind `REFERENCE_BENCHMARK` and scope
`REFERENCE_IMPLEMENTATION_NOT_SANDBOX`. The Control Room renders live and
reference evidence in visually distinct panels. Reference values are never
used to populate live fields.

Commit duration includes Policy. Policy is shown as a breakout measurement but
is not added again to the deterministic total. Simulated reasoning duration is
reported separately. No model is called, so token usage is truthfully zero.

### Governed evolution

Use a generic in-memory `LearningSimulationProvider<TInputs>` behind the
`ResolutionEvidenceProvider<TInputs>` port. Scenario composition supplies one
explicit equivalent-case key and a list of semantic fields the demonstration
evidence may resolve.

The lifecycle is strictly sequential:

`OBSERVED → CANDIDATE → VALIDATED → APPROVED → ACTIVE`

Observation stores evidence but cannot affect Resolution. Only an explicit
transition from `APPROVED` to `ACTIVE` makes governed resolution evidence
available for an equivalent request. The provider cannot supply authority,
select an execution substrate, execute an effect, or alter verification.

The second encounter therefore resolves the learned semantic field
deterministically and does not invoke the simulated O-Agent, but it still
creates a fresh state-bound candidate and requires the unchanged Commit path.

Coverage and reasoning-frequency values in the interactive evolution snapshot
are labeled as a five-case public simulation cohort. Supplied historical Xact
results remain separately labeled reference evidence.

## Consequences

- Telemetry can be replaced without changing decision contracts or Commerce
  rules.
- Evolution logic is not coupled to Commerce; Commerce supplies only an
  explicit key at the application composition boundary.
- The O-Agent cannot directly modify active deterministic behavior.
- A promoted pattern improves Resolution only and can never grant consequence
  authority.
- Production extraction, matching, scoring, validation, promotion, confidence,
  learning-loop, and Rule Pack internals remain encapsulated and absent.
