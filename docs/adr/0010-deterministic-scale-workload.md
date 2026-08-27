# ADR 0010 — Deterministic Construction Scale Workload

**Status:** Experimental proof branch

**Depends on:** ADR 0009. It preserves, rather than replaces, Experiment 6A.1.

## Experiment 6A.1 — Scheduler Structural Validation

The original 18-operation construction graph is retained as a correctness
experiment. It validates dependency order and bounded ready-set execution. Its
performance result is explicitly **non-conclusive** because async no-op work is
dominated by scheduler overhead and its graph width cannot occupy a large pool.

## Experiment 6A.2 — Deterministic Scale Workload

The scale workload is a separate 10,011-operation, 47-stage graph with more
than 100 independent operations at every ready stage. Each operation performs
real, deterministic local work: component descriptor composition, schema and
binding validation, constraint evaluation, and artifact fingerprinting.

Browser Web Workers execute bounded stage batches for configurations 1, 10,
25, 50, and 100. The Lab records configured/peak/average worker utilization,
worker compute time, scheduler time, throughput, checksum, browser user agent,
and hardware-concurrency hint. The five runs execute serially to avoid
cross-run contamination.

No artificial delay is used. A flat, regressive, or saturating curve is a valid
result and may indicate browser-worker or hardware limits rather than an Xact
architecture result.

## Verification

Construction `WORKING_APP` now requires behavioral verification of the local
inventory artifact: required products, inventory total, low-stock rule, add
mutation, quantity adjustment, derived-total update, and absence of
unauthorized primitives.

## Boundary

The scale worker operates only on fixed deterministic values. It has no shell,
network, arbitrary source, file, package, route, O-Agent, or authorization
capability. Phase 5 boundaries remain unchanged.
