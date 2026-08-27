# Scenario Packs

## Commerce V1

Commerce V1 is a mutable `ScenarioPack` with an explicit demonstration limit,
simulated authority and capability states, state hashing, a simulated effect,
and exact post-effect verification. These rules are public fixtures, not
production policy.

### 1. Authorized refund
Valid request, verified policy, current state, authorized effect.

Expected outcome: `AUTHORIZED → EXECUTED → VERIFIED`.

Control Room path: load **Allowed**, Resolve, Commit, then Execute + verify.

### 2. Excess refund
Requested refund exceeds verified policy authority.

Expected outcome: `REJECTED`.

Control Room path: change an allowed amount to an excessive amount, Resolve a
new candidate, and Commit. The previous decision is invalidated on mutation.

### 3. Semantic escalation
Most facts resolve deterministically. Only one semantic field is unresolved.

Expected flow:
`Resolve R → isolate U → O-Agent → structured evidence → Xact re-entry → independent validation → Commit`.

Control Room path: load **Ambiguous**, Resolve, Commit to `ESCALATED`, add
structured evidence and re-enter, then request a new Commit decision.

### 4. Stale-state rejection
Reasoning occurs against valid state. Underlying state changes before Commit.

Expected flow:
`base_hash mismatch → STALE → no effect`.

Control Room path: Resolve, change current state, then Commit. Freshness is
checked against the current state and no execution substrate is selected.

### 5. Unknown authority

The simulated authority registry cannot establish authority.

Expected outcome: `ESCALATED → NONE`; execution remains blocked until governed
authority evidence can produce a newly resolved candidate and Commit decision.

### 6. Governed evolution replay

The first encounter uses the existing semantic escalation path. After the
re-entered candidate passes Commit, the sandbox may observe a public-safe
learning candidate. The user must move it through every lifecycle state:

`OBSERVED → CANDIDATE → VALIDATED → APPROVED → ACTIVE`

Before `ACTIVE`, the candidate cannot affect Resolution. After `ACTIVE`, an
equivalent explicit demo case receives governed resolution evidence, places the
previously unresolved rationale in R, leaves U empty, and does not invoke the
simulated O-Agent. Policy, authority, capability, freshness, Commit, execution,
and verification remain unchanged and independently required.

## Expansion packs

- IT Operations
- Security
- Finance
- Code operations

All packs must reuse the same provider and execution interfaces.
