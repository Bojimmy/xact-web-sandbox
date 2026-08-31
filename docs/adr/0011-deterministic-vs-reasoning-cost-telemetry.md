# ADR 0011 — Deterministic-vs-Reasoning Cost Telemetry

**Status:** Accepted — experimental proof branch, drafted by DSH and implemented
as a public-safe provider boundary.

**Depends on:** ADR 0009 (construction benchmark), ADR 0010 (deterministic scale
workload). It **preserves** 6A.1 and 6A.2 unchanged; the 6A.2 concurrency curve
(`~6.1×`, bit-identical checksum) remains the standalone concurrency proof and
is **not** folded into this experiment.

## Context

6A.1/6A.2 prove that Xact can schedule and execute a large deterministic
workload in parallel with a reproducible checksum. They do **not** quantify the
asymmetry that justifies Xact in the first place:

> **The deterministic path finishes enormous work in ~0 tokens; the reasoning
> path is the expensive clock the whole job waits on.**

This ADR adds a *second, separate* telemetry surface that measures that
asymmetry — the core "determinism amortizes, reasoning is the tail" argument —
using a **real** O-Agent where one is available.

## The O-Agent is real, but never authoritative

A real LLM O-Agent is not only possible; it is the target. The one hard rule is
that the model lives behind a **provider boundary**, never inside the page:

```text
Browser / WebMCP page
        │  structured reasoning request (U fields + context)
        ▼
O-Agent provider boundary   ← credentials live server-side; the page never sees them
        ▼
Server / secure model endpoint
        ▼
OpenAI / other LLM
        ▼  structured reasoning result (evidence, not authority)
```

The O-Agent (real *or* simulated) may interpret ambiguous intent, compare
authorized options, propose a solution, produce structured evidence, and call
read-only WebMCP tools for context. It may **not** independently authorize or
commit a consequence. Its proposal always returns through Xact: Resolve →
re-entry → Commit. The model being real changes nothing about the authority
boundary.

## Decision

1. Introduce two **cost paths** with a hard provenance discriminator. A number
   may never be presented as measured if it was simulated, and none may be
   merged with the Reference Xact benchmark.
2. Introduce a replaceable **`OAgentProvider`** abstraction — the reasoning
   boundary. A real server-side LLM and a public-safe simulated stub implement
   the same interface; the demo picks one at composition time.
3. Introduce two **modes** — `NAIVE_REASONING` and `XACT_HYBRID` — over the
   **same** workload, differing only in *where* reasoning is invoked.
4. Add a **latency-variance protocol**: N ≥ 10 runs per mode, reporting mean and
   standard deviation. Determinism is stable; reasoning is wide.
5. Add the **learning-loop delta**: after a governed promotion, the same case
   shows fewer O-Agent calls and lower tokens/latency — making "reasoning
   reduces future reasoning" a *measured* trend, not a conceptual one.

## Contract

### Provenance discriminator

```ts
type TelemetryKind =
  | "LIVE_SANDBOX_MEASUREMENT" // actually timed/measured — includes a real O-Agent behind the provider boundary
  | "SIMULATED_O_AGENT"        // offline fallback: a labeled public-safe stub (no real model wired)
  | "ESTIMATED_COST";          // tokens × price; an estimate, never a measurement
```

`LIVE_SANDBOX_MEASUREMENT` is the **target**. `SIMULATED_O_AGENT` is the
labeled fallback for an offline/demo run with no provider; it is never the
default when a provider is available.

### O-Agent provider boundary (new replaceable abstraction)

```ts
interface ReasoningRequest {
  context: unknown;            // structured, minimal — only what the U needs
  unresolved: string[];        // the genuine U fields
}

interface ReasoningResult {
  evidence: { claim: string; resolves: string[] }[];
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
}

interface OAgentProvider {
  reason(request: ReasoningRequest): Promise<ReasoningResult>;
}
```

Real implementation = a server endpoint behind credentials; simulation = a
deterministic stub. Both return the same `ReasoningResult` shape. The provider
may read, but never causes a consequence; its output is evidence for Xact.

The sandbox implements `SecureEndpointOAgentProvider` as the browser-side
client for that boundary. It has no credential field and accepts a response
only when the protected server endpoint attests `LIVE_SANDBOX_MEASUREMENT`.
Deployments may wire that endpoint to a real model using server-only secrets;
until then, the explicit `SimulatedOAgentProvider` is the offline fallback.
The bundled route fails closed until it has either a server-only
`MOONSHOT_API_KEY` for the direct Kimi transport or both
`OAGENT_PROVIDER_URL` and `OAGENT_PROVIDER_TOKEN` for a protected model
gateway. In both cases, the browser receives only the attested structured
result; the provider credential and transport remain server-side.

### Two-path metrics

```ts
interface DeterministicPathMetrics {
  kind: "LIVE_SANDBOX_MEASUREMENT";
  operations: number;
  schedulerTimeMs: number;
  throughputOpsPerSec: number;
  inferenceCalls: 0;   // invariant — the deterministic path is zero-token
  inferenceTokens: 0;
}

interface ReasoningPathMetrics {
  kind: "LIVE_SANDBOX_MEASUREMENT" | "SIMULATED_O_AGENT";
  calls: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  wallTimeMs: number;
  latencySamplesMs: number[]; // N ≥ 10 samples, for variance
}

interface CostComparisonRun {
  mode: "NAIVE_REASONING" | "XACT_HYBRID";
  totalOperations: number;
  deterministicOperations: number;
  reasoningOperations: number;
  deterministic: DeterministicPathMetrics;
  reasoning: ReasoningPathMetrics;
  verification: { timeMs: number; kind: "LIVE_SANDBOX_MEASUREMENT" };
  totalTimeMs: number;
  estimatedCostUsd?: { kind: "ESTIMATED_COST"; value: number; pricePer1kTokensUsd: number };
  checksum: number; // determinism witness — must match across modes and runs
}
```

### Mode definitions (same workload, different reasoning fan-out)

- **`XACT_HYBRID`** — one O-Agent call per *genuinely unresolved* node
  (`U` count, e.g. ~30). Deterministic resolution handles everything else.
- **`NAIVE_REASONING`** — one O-Agent call per **dependency stage** (the
  default naive baseline; 47 calls at 47 stages). A per-primitive-class
  baseline (21 calls) is a permitted alternative but must be stated. Per-operation
  (10,011 calls) is disallowed as a defensible baseline for what a naive agent
  would plausibly do.

The two modes must produce the **same `checksum`** — resolution fan-out changes
cost, never the constructed artifact.

### Variance protocol

- Run each mode **N ≥ 10** times, serially, fresh workers per run.
- Report `mean` and `stddev` for `totalTimeMs`, `deterministic.schedulerTimeMs`,
  and `reasoning.wallTimeMs`.
- Expected: deterministic `stddev ≈ 0`; reasoning `stddev` wide.

### Learning-loop delta

Run the hybrid mode **before and after** a governed promotion (the ADR 0009
evolution lifecycle). Report the same metrics both sides:

```text
O-Agent calls    30 → 4
Total tokens     ↓
Latency          ↓
Deterministic %  ↑
```

This is the live, measured form of "reasoning used to reduce the future need
for reasoning."

## The three clocks (presentation model)

Keep the three compute regimes visually distinct so the Reference decision
number can never be read as sandbox work:

| Clock | Measures | Provenance | Result |
|-------|----------|-----------|--------|
| Decision | Xact authorizes one candidate | **REFERENCE** — real Xact Core; displayed, not sandbox-measured | ~9 μs |
| Work | deterministic construction execution | **LIVE** sandbox | ~0.5 s |
| Reasoning | O-Agent resolves U nodes | **LIVE** (secure provider) | 110 s → 14 s |

Only the Work and Reasoning clocks are measured here. The Decision clock is a
labeled reference shown for scale; the sandbox has no real Xact Core and must
not imply it measured it.

> **Xact decides in microseconds, deterministic work executes in ~milliseconds,
> reasoning takes seconds — and learning shrinks the seconds, not the work.**

## Boundary and honesty rules

- The `6A.2` concurrency result is untouched and separately labeled.
- Credentials never enter the browser; the O-Agent provider boundary holds them
  server-side.
- The O-Agent's output is **evidence/proposal, never authority** — it does not
  change policy, capability, freshness, or Commit (unchanged from ADR 0005/0009).
- `SIMULATED_O_AGENT` numbers must be visibly labeled as simulation; they are
  the offline fallback, never a substitute when a live provider exists.
- `ESTIMATED_COST` must carry its per-1k-token price and the word "estimate".
- No number here is ever combined with, extrapolated from, or presented beside
  the Reference Xact benchmark (`9 μs mean`, etc.) without an explicit
  "reference implementation, not sandbox" label.

## Visualization (the deliverable)

Lead with the three-clock before/after and the checksum witness:

```text
BEFORE ACTIVATED LEARNING                 AFTER ACTIVATED LEARNING
Decision (REFERENCE)      ~9 μs           Decision (REFERENCE)      ~9 μs
Deterministic build       0.48 s          Deterministic build       0.53 s   (same work, within noise)
O-Agent reasoning         109.9 s         O-Agent reasoning         13.9 s
Tokens                    5,032           Tokens                    665

checksum 698530768  ==  checksum 698530768
```

`698530768` is the witness recorded for the 50,000-round workload above.
Checksums are deterministic functions of their workload; a lower-round sandbox
demonstration must show equality between its paired runs, not this literal
value.

Then a "where the time went" bar and the two-mode table. Encoded conclusion:
the work did not get cheaper because we skipped work — it got faster because
Xact stopped asking an LLM questions it had already learned to answer
deterministically.

| Metric | Naive Reasoning | Xact Hybrid |
|--------|----------------:|------------:|
| Total time | measured | measured |
| O-Agent calls | measured | measured |
| Input/output tokens | measured | measured |
| Deterministic ops | low | high |
| Output checksum | matches | matches |
| Latency stddev | wide | near-zero |
| Estimated cost | estimate | estimate |

The encoded message:

> **Xact finishes ~99.7% of the work in ~0 tokens while the build waits on the
> ~0.3% that needs judgment. Reasoning is the expensive clock; determinism is
> the free clock — and the O-Agent is real, not authoritative.**

## Tests Codex must add

- both modes produce the identical `checksum`;
- `deterministic.inferenceTokens === 0` in both modes;
- `XACT_HYBRID` reasoning calls == the `U` count, never more;
- `NAIVE_REASONING` reasoning calls == the stated baseline (stage or class count);
- `kind` discriminators are correct (no `SIMULATED_O_AGENT` mislabeled `LIVE`);
- the real `OAgentProvider` returns `ReasoningResult`; the simulated stub returns the same shape, labeled;
- variance: deterministic `stddev` is near-zero across N runs; reasoning `stddev` is reported;
- learning-loop: calls/tokens/latency decrease after a governed promotion;
- `ESTIMATED_COST` carries `pricePer1kTokensUsd` and the estimate flag.
