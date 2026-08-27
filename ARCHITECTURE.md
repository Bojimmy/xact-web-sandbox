# Xact Web Sandbox — Canonical Architecture

## System flow

```text
Request
  ↓
Resolution
  ├─ R: resolved facts
  ├─ U: unresolved semantics
  └─ C: conflicts / commit-relevant constraints
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

## Replaceable interfaces

- `DecisionProvider`
- `PolicyProvider`
- `EvidenceProvider`
- `VerificationProvider`
- `ExecutionAdapter`
- `ScenarioPack`

The challenge build uses a public-safe resolution simulation. Production Xact components must be replaceable behind the same contracts without redesigning the application.

## Architectural non-negotiables

- Tool access is not authority.
- Evidence access is not authority.
- Reasoning output is evidence, not authorization.
- Commit re-validates relevant assumptions against current state.
- Unknown authorization state fails closed.
- Consequential effects are verified after execution.
