# ADR 0018 — Campaign UI is a Projection of Real Xact State (no theater)

**Status:** Accepted

**Depends on:** ADR 0012 (flagship), ADR 0014 (Outcome Effectiveness Evidence
Gate), ADR 0016 (construction vocabulary), ADR 0017 (campaign interface).

## Context

The campaign's visual language — the level ladder, the substrate loadout, the
Decoy Target Challenge, `AUTHORITY ≠ SCORE`, and the proposed ABSORB gates — is
strong enough to carry the demo. The risk is that these visuals become
*theater*: UI state that animates on its own, independent of the Xact mechanics
it depicts.

## Decision

> **If it lights up, Xact actually did it.**

Every gate, lock, counter, denial, and progression step is a **projection of a
real deterministic function's return value**. The UI never sets an authoritative
state independently; it reads it from the architecture.

The one honest exception is the Level 04 substrate **execution**, which is
browser-local **simulation** (there is no live backend) and is labeled
simulated. Even there, the authority decisions — Commit outcome, artifact
guard, decoy target mismatch — are real function calls, not hardcoded booleans.

## UI → architecture mapping (the contract)

### Level 06 — ABSORB (four gates → ACTIVATED)

| UI element | Real source | "Lights up" when |
|---|---|---|
| DOOR — `ADMISSIBLE ✓` | `doorValidate(raw, capabilityExtensionAllowlist)` (`src/flagship/outcome-effectiveness-gate.ts`) | `door.admissible === true` |
| LEDGER — `VALID ✓` | `ledgerValidate(raw)` | `ledger.valid === true` |
| OUTCOME — `EFFECTIVE ✓` | `recordOutcomeEvidence(...)` → `OutcomeEvidence.measurement.verdict` | `verdict === "EFFECTIVE"` |
| GOVERNANCE — `APPROVED ✓` | `governCandidate(candidate, evidence, decision)` → `PromotionDecision` | `decision.approval === "APPROVED"` and `targetState === "APPROVED"` |
| **ACTIVATED** | `activateResolutionAuthority(candidate, governed)` | the call returns (does not throw) |
| "Resolution authority only" | fixed invariant language | always |
| 🔒 **COMMIT AUTHORITY** (locked) | absence of `commitAuthorizationFrom(decision)` | stays locked until a real AUTHORIZED Commit with an artifact |

The campaign's Level 06 must drive these gates through the **same governing
operations** the control room uses — `doorValidate` + `ledgerValidate`, then
`recordOutcomeEvidence`, then `governCandidate`, then
`activateResolutionAuthority`. It must not reimplement them as UI booleans.
`analyzeCapabilityRequest(...)` remains the control-room-specific parser for
its separate, closed audit-history vocabulary.

### Level 07 — learning result

| UI element | Real source |
|---|---|
| `30 → 4` | measured `FlagshipLearningRun.reasoningOperations` (cold 30 → activated 4), or computed `reasoningComparison.callsBefore/callsAfter` |
| `−86.7%` | computed `(30 − 4) / 30` — never a hardcoded `−87` literal |
| `CONSTRUCTION WORK: 10,011 → 10,011` | `executedConstructionOperations` (identical in both runs) |
| `ARTIFACT CHECKSUM: IDENTICAL ✓` | `checksum` unchanged (e.g. `698530768 → 698530768`) |
| "The LLM didn't get faster. Xact stopped needing it." | `reasoningComparison.note`, shown only when the checksum is unchanged and calls decreased |

### XACT STATUS panel (replaces the duplicated AUTHORITY ≠ SCORE box)

| Field | Real source |
|---|---|
| `RESOLUTION COMPLETE` | `session.candidate` present |
| `AUTHORITY ESTABLISHED` | `session.decision.status === "AUTHORIZED"` |
| `COMMIT VALID` | `session.decision.artifact` present |
| `SUBSTRATE WEBMCP/DOM/VISION` | `session.selectedSubstrate` |
| `VERIFICATION PENDING/VERIFIED` | `session.phase` |
| `CURRENT EFFECT …` | `session.decision.candidate.proposedEffect` |

### Decoy / attack state

| Field | Real source |
|---|---|
| `TARGET DECOY` / `FINGERPRINT MISMATCH` / `AUTHORITY INVALID FOR TARGET` / `CONSEQUENCE BLOCKED` | `validateAuthorizationArtifact(...)` (effect-bound FAIL) against the decoy target |

### AUTHORITY ≠ SCORE

The "score" signal is evidence, never authority: it maps to the invariant
"reasoning may propose, only Xact may commit" and the effectiveness-is-
evidence-not-authority rule (ADR 0014). The UI may show a score; the score may
never advance a level.

### "You don't progress by clicking. You progress by proving."

`run.completed` is driven by real phase transitions (Commit AUTHORIZED,
verification VERIFIED), never by a click handler.

## Acceptance contract (for Codex)

1. A UI element that "lights up" derives its state from the real function's
   return value (derived / `useMemo`), never from an independent `useState`
   toggle.
2. If a gate shows ✓, the corresponding function returned true **in the same
   run, for the inputs the participant actually supplied**.
3. If the ladder reports `REFUSED` / `NOT EXECUTED`, the real Commit outcome
   was REJECTED and no substrate was selected.
4. `30 → 4`, `−86.7%`, `10,011 → 10,011`, and the checksum come from the
   measured run / computed comparison — not literals in the component.
5. `ACTIVATED` and `COMMIT` remain visually and semantically distinct:
   ACTIVATED = resolution-only; the 🔒 COMMIT AUTHORITY lock opens only on a
   real AUTHORIZED Commit.

## Consequences

- The spectacle is real: the audience watches the architecture, not a script.
- "You don't progress by clicking. You progress by proving." is true, not a
  slogan.
- No UI state can claim a consequence Xact did not authorize.
