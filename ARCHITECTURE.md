# Xact Web Sandbox — Canonical Architecture

## System flow

```text
Request
  ↓
Resolution
  ├─ R: Resolved
  ├─ U: Unresolved
  └─ C: Commit Constraints
  ↓
Reason only if U requires interpretation
  ↓
O-Agent structured evidence
  ↓
Xact re-entry
  ↓
Validate → re-read state → check conflict → check authority → stale guard
  ↓
COMMIT BOUNDARY
  ├─ AUTHORIZED
  ├─ REJECTED
  ├─ STALE
  └─ ESCALATED
  ↓
Execution Router
  ├─ Structured/local
  ├─ WebMCP
  ├─ DOM / accessibility
  ├─ Vision
  └─ Future adapters
  ↓
Effect
  ↓
Verify
  ↓
Audit
```

## Two orthogonal ladders

### Resolution ladder
1. Deterministic resolution
2. O-Agent
3. Swarm when warranted
4. Human

### Execution ladder
1. Structured/local operation
2. WebMCP
3. DOM/accessibility
4. Vision
5. Native/API/future protocols

The resolution ladder answers **what is unresolved?**

The execution ladder answers **how should an authorized effect be caused?**

The Commit boundary separates them.

## Canonical R / U / C terminology

- **R — Resolved:** facts established from reported, verified, or derived evidence.
- **U — Unresolved:** semantics that still require interpretation or additional evidence.
- **C — Commit Constraints:** conditions that must be evaluated at Commit, including limits, required capabilities, authority requirements, conflicts, and freshness bindings.

Conflict is a condition represented within C. It is not an alternate expansion
or meaning of the letter C.

## Commit decision semantics

- `AUTHORIZED` — Commit passed; an execution substrate may be selected.
- `REJECTED` — final denial under the current request, policy, and state. A materially changed request or state requires a new decision.
- `ESCALATED` — additional resolution or authority is required. The request may re-enter Xact with new governed evidence for a new Commit decision.
- `STALE` — current state no longer matches the candidate binding. Fresh resolution is required before re-entry.

Only `AUTHORIZED` may proceed to execution. `REJECTED`, `ESCALATED`, and
`STALE` select no execution substrate.

## Replaceable interfaces

- `DecisionProvider`
- `PolicyProvider`
- `EvidenceProvider`
- `VerificationProvider`
- `ExecutionAdapter`
- `ScenarioPack`

The challenge build uses a public-safe resolution simulation. Production Xact components must be replaceable behind the same contracts without redesigning the application.

## Phase 2 runtime

```text
Commerce ScenarioPack
  ↓
SimulationDecisionProvider.resolve
  ↓
state-bound DecisionCandidate (R / U / C + evidence)
  ↓
optional structured reasoning evidence → re-entry
  ↓
SimulationDecisionProvider.commit(current state)
  ↓
DecisionResult
  ├─ AUTHORIZED → SimulatedExecutionAdapter → VerificationProvider
  └─ REJECTED / ESCALATED / STALE → NONE
  ↓
Control Room projection
```

`SimulationDecisionProvider` is a replaceable clean-room adapter. Scenario
rules are explicit demo data owned by `ScenarioPack`; the provider does not
claim to reproduce production resolution, scoring, matching, or authorization.

Resolve produces a candidate bound to a state hash. Commit independently reads
current state and evaluates freshness before semantic re-entry or authority.
Structured reasoning evidence may reduce U, but a new Commit decision remains
mandatory. Execution receives only an already-authorized effect, and
verification compares the observed post-effect state with that exact candidate.

## Architectural non-negotiables

- Tool access is not authority.
- Evidence access is not authority.
- Reasoning output is evidence, not authorization.
- Commit re-validates relevant assumptions against current state.
- Unknown authorization state fails closed.
- Consequential effects are verified after execution.
