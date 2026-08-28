# ADR 0014 — Outcome Effectiveness Evidence Gate

**Status:** Accepted

## Context

Agent Arena already contained a learning-boundary defense: the **Door/Ledger**
gate in `src/ontology/triageOntology.ts`. Its purpose was to prevent an
O-Agent from submitting arbitrary output and having the deterministic X-agents
begin trusting it.

That architecture answered two questions only:

- **Door** — closed-ontology / structural *admissibility* ("can we represent this?").
- **Ledger** — deterministic domain-invariant *validity* ("does it obey our invariants?").

It did **not** answer a third question that matters for governed absorption:
*"Did the O-Agent's resolution actually work?"* A resolution can be admissible
and valid yet produce no real-world effect, and such a resolution must not
become evidence for promotion into the deterministic layer.

This module (an idea also observed in Kubit) adds that missing question as a
first-class gate, reconciled with the current Xact architecture.

## Decision

The learning pipeline distinguishes **four separate questions**:

1. **ADMISSIBILITY** — can Xact represent the proposed capability? → **Door**
2. **VALIDITY** — does the proposal obey deterministic/domain invariants? → **Ledger**
3. **EFFECTIVENESS** — did the proposed resolution actually produce the intended result? → **Outcome Evidence**
4. **GOVERNANCE** — should this evidence be sufficient to approve and activate? → **Governance**

These are implemented in `src/flagship/outcome-effectiveness-gate.ts` as:

- `doorValidate(raw, allowlistedCapabilities)` — closed capability ontology and structural shape.
- `ledgerValidate(raw)` — a proposal must never carry an execution/authority surface (`execute`, `artifact`, `authorize`, `commit`, `activate`).
- `recordOutcomeEvidence(...)` — produces `OutcomeEvidence`, a branded, evidence-only record that references a **verified consequence** and a measured `EffectivenessMeasurement`.
- `issueGovernanceDecision(...)` — produces `GovernanceDecision`, a branded, explicitly-human approval.
- `governCandidate(candidate, evidence, decision)` — the **only** promotion path; it requires both `EFFECTIVE` evidence and an `APPROVED` governance decision, and returns a `PromotionDecision` (still not authority).

## Load-bearing invariant

**Effectiveness is evidence only. It informs promotion; it never causes it.**

A successful outcome must never automatically produce `APPROVED`, `ACTIVATED`,
`AUTHORIZATION`, `COMMIT`, or any execution authority. No metric, conversion
improvement, success score, user-behavior result, or statistical threshold may
directly activate deterministic capability.

This is enforced two ways:

1. **Structurally (types):** `OutcomeEvidence`, `GovernanceDecision`, and
   `PromotionDecision` are nominal (`unique symbol`-branded) types. None is
   assignable to `ActivatedResolutionAuthority` or `CommitAuthorization`. No
   exported function promotes from evidence alone — `governCandidate` requires
   the governance decision argument.

2. **At runtime (guards):** `governCandidate` refuses unless the evidence is
   `EFFECTIVE` *and* the governance decision is `APPROVED`. Either alone is
   insufficient, so effectiveness cannot be the cause of promotion.

## Existing Xact distinction is unchanged

`ACTIVATED` remains authority to participate in deterministic **resolution**
only. `COMMIT` remains authority to cause a **consequence**. Outcome evidence
changes neither.

After the full chain — Door ✓, Ledger ✓, Effectiveness ✓, Governance ✓,
`ACTIVATED` ✓ — a future consequential action still traverses the normal Xact
Commit path (`commitAuthorizationFrom` on an `AUTHORIZED` decision).

## Proposed learning flow

```
O-Agent resolves genuine U
        ↓
Structured evidence / proposal
        ↓
DOOR            (admissibility — closed capability ontology)
        ↓
LEDGER          (validity — no authority/execution surface on a proposal)
        ↓
Controlled use / execution where authorized
        ↓
OBSERVE
        ↓
VERIFY CONSEQUENCE   (did the exact authorized effect occur?)
        ↓
MEASURE OUTCOME     (did the resolution achieve its objective?)
        ↓
OUTCOME EVIDENCE    (evidence only — never authority)
        ↓
CANDIDATE
        ↓
Validation / replay
        ↓
GOVERNANCE          (explicit approval — the only promotion cause)
        ↓
APPROVED
        ↓
ACTIVATED           (resolution-only authority)
        ↓
May participate in future deterministic resolution
```

## Consequences

- The O-Agent may **propose**; it may not directly teach, execute, or authorize
  the deterministic layer. This principle is preserved and now extended by an
  effectiveness gate before any promotion is considered.
- This module is a boundary definition plus enforcement surface. Wiring the
  effectiveness measurement into a live panel or the run explainer is a later
  slice; the gate itself does not require a UI to hold.
- `OutcomeEvidence` must reference a `VerifiedConsequence` (an exact authorized
  effect was observed, not merely claimed), keeping "measure outcome"
  downstream of "verify consequence".

## Stage 3 sandbox integration

`TeachItPanel` projects this gate for one intentionally narrow, public-safe
extension: `get_audit_history`. The request is first decomposed locally and
checked against Door and Ledger. A request outside that ontology (for example,
deleting a customer account) is refused before any O-Agent request, candidate,
artifact, or effect exists.

For an admissible proposal, the protected O-Agent endpoint receives only the
genuine semantic U and returns evidence. It does not select the capability ID.
`CapabilityConstructionEngine` then runs the construction consequence through
the existing public-safe `Resolve → Commit → AuthorizationArtifact → LOCAL
adapter → observe → verify` boundary. Only the resulting verified consequence
may become `OutcomeEvidence`; only an explicit governance action may create a
`PromotionDecision`; `ACTIVATED` remains resolution-only.
