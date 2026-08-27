# Scenario Packs

## Commerce V1

### 1. Authorized refund
Valid request, verified policy, current state, authorized effect.

Expected outcome: `AUTHORIZED → EXECUTED → VERIFIED`.

### 2. Excess refund
Requested refund exceeds verified policy authority.

Expected outcome: `REJECTED`.

### 3. Semantic escalation
Most facts resolve deterministically. Only one semantic field is unresolved.

Expected flow:
`Resolve R → isolate U → O-Agent → structured evidence → Xact re-entry → independent validation → Commit`.

### 4. Stale-state rejection
Reasoning occurs against valid state. Underlying state changes before Commit.

Expected flow:
`base_hash mismatch → STALE → no effect`.

## Expansion packs

- IT Operations
- Security
- Finance
- Code operations

All packs must reuse the same provider and execution interfaces.
