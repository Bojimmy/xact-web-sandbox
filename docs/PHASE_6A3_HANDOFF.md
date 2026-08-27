# Phase 6A.2 → 6A.3 Handoff (DSH → Codex)

You are at **`773085b` (Phase 6A.2)**. This updates you on DSH's live-browser
test results and points at the next ADR.

## Latest test results — real Chrome, real Web Workers, 10 cores

DSH ran `SCALE_WORK_ROUNDS` sweeps in a real browser (`hardwareConcurrency: 10`).
Speedup vs the 1-worker baseline, all five configs reported (no cherry-picking):

| ROUNDS | 1w | 10w | 25w | 50w | 100w |
|-------:|---:|---:|---:|---:|---:|
| 160 (shipped) | 1.00× | 1.39× | 0.81× | 0.52× | 0.36× |
| 2,000 | 1.00× | 1.60× | 1.16× | 0.71× | 0.54× |
| 10,000 | 1.00× | 3.06× | 2.19× | 1.51× | 1.08× |
| 100,000 | 1.00× | 4.49× | 4.71× | 4.27× | 3.32× |
| 250,000 | 1.00× | 5.32× | 5.56× | 5.34× | 4.75× |
| **500,000** | 1.00× | 5.79× | **6.12×** | 5.82× | 5.41× |

**Determinism: the checksum is bit-identical across all five worker counts at
every round-count** (e.g. `3125889056` at 500K). This is the strongest result —
the XOR-partitioned work reassembles byte-identically regardless of width.

## Findings to act on

1. **`peakActiveWorkers` is wrong (confirmed live).** It reports the *pool
   size* (`workerCount`), not the measured peak. Actual vs reported: 25→24,
   50→43, 100→71. Fix: report `max(batches.length)` per stage, or make
   `batches()` produce exactly `min(workers, count)` balanced batches so every
   worker is used. (`averageActiveWorkers` is already correct.)

2. **The shipped `160` rounds is too small to demonstrate speedup.** At 160 the
   curve *regresses* past 10 workers (overhead-dominated). For a positive curve
   ship ~**40,000+** rounds (or make it a UI knob). At 500K the curve is
   positive everywhere.

3. **The ceiling is ~6.4×, not 10× — and it's Amdahl + JS-overhead, not the
   stage count.** A stage sweep at 250K rounds: 47→5.41×, 16→5.49×, 8→6.02×,
   1→6.36×. Collapsing the 47 stages gains barely ~1×, so the stage barrier is
   *not* the main limiter; per-op `Math.imul` function-call cost + worker
   messaging are. Present the curve as **saturating at the graph's parallel
   limit**, not as linear scaling — the saturation *is* the architectural point.

4. **Real O-Agent, not simulated.** DSH's earlier "no real O-Agent in the
   sandbox" was too restrictive. A real LLM behind a secure `OAgentProvider`
   boundary is the target; credentials stay server-side; the browser receives
   only structured reasoning results. The O-Agent is real but never
   authoritative — its output returns through Resolve → re-entry → Commit.

## Next work — ADR 0011

Implement `docs/adr/0011-deterministic-vs-reasoning-cost-telemetry.md`. In short:

- A second, **separate** telemetry surface (do **not** touch 6A.2's concurrency
  curve) with a hard provenance discriminator:
  `LIVE_SANDBOX_MEASUREMENT` | `SIMULATED_O_AGENT` | `ESTIMATED_COST`.
- A replaceable `OAgentProvider { reason(request): Promise<ReasoningResult> }`
  — real server-side LLM or a labeled simulated stub, same shape.
- Two modes over the **same** workload, same **checksum**:
  `XACT_HYBRID` (one call per genuine `U`) vs `NAIVE_REASONING` (one call per
  dependency stage = 47; per-operation is disallowed as a baseline).
- N ≥ 10-run variance protocol (deterministic `stddev ≈ 0`, reasoning wide).
- Learning-loop delta (calls 30 → 4 after a governed promotion).
- `deterministic.inferenceTokens === 0` is an invariant.

Read ADR 0011 for the full contract and honesty rules before implementing.
