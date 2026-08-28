# ADR 0016 — Governed Capability Construction Vocabulary (Xact Foundry seed)

**Status:** Accepted

**Depends on:** ADR 0012 (flagship), ADR 0014 (Outcome Effectiveness Evidence
Gate), ADR 0015 (Run Explainer). Changes none of them.

## Context

The flagship's "GIVE XACT MORE ABILITIES TO ABSORB" feature (Stage 3,
`src/flagship/capability-extension.ts`) currently proves a narrow version of a
much larger idea: Xact as a **governed WebMCP tool foundry** — "describe the
capability, and Xact governs what becomes infrastructure."

The important distinction in that idea is *not* "let an LLM generate tools."
It is:

> **Don't ask AI to invent infrastructure from scratch. Give it governed
> primitives from which infrastructure may be constructed.**

Xact Nodes act as a deterministic **compiler** over a bounded construction
vocabulary; the O-Agent acts as a **designer** only for the genuinely
unresolved fragment. WebMCP is the target interface; Commit is the authority
boundary. Over time, more of that composition graph becomes deterministic.

This ADR records the architectural decision to plant that vocabulary as a seed
**now**, without building the foundry.

## Decision

Introduce a closed, typed **capability construction vocabulary**
(`src/flagship/capability-vocabulary.ts`) — the 16 primitives from which a
governed capability may later be composed:

`TOOL_DEFINITION`, `INPUT_SCHEMA`, `OUTPUT_SCHEMA`,
`READ_CAPABILITY`, `MUTATION_CAPABILITY`, `SESSION_REQUIREMENT`,
`STATE_BINDING`, `ACTOR_BINDING`, `CONFIRMATION_REQUIREMENT`,
`EFFECT_FINGERPRINT`, `OBSERVATION`, `VERIFICATION`, `AUDIT_EVENT`,
`ERROR_CONTRACT`, `ROLLBACK_CAPABILITY`, `COMMIT_BOUNDARY`.

A `GovernedCapabilityDescriptor` composes a subset into a real descriptor:
`{ id, capabilityKind: READ | MUTATION, label, resolves, boundaries[] }`, where
each `CapabilityBoundary` instantiates one primitive with an optional
actor/limit/freshness/audit/confirmation/rollback constraint. Composing a
descriptor is **descriptive only** — it grants no execution, authorization,
commit, or activation authority.

The existing absorption feature is the **seed instance** of this vocabulary:
`CandidateCapability { id, label, resolves }` is a READ capability with an
empty boundary set. Future capability absorption extends the descriptor to
carry `capabilityKind` and `boundaries`; it does not fork a second vocabulary.

The construction engine now exposes a **typed, inert recognition extension
point**: `ConstructionBenchmarkEngine.recognizeCapability(descriptor)` (via
`recognizeGovernedCapability`) validates a descriptor against the closed
vocabulary and returns a `CapabilityRecognitionResult` whose `composed` field
is typed `false`. A Node recognizes and validates a governed capability without
generating a tool, effect, or artifact.

## Load-bearing invariant

**Constructing a capability never authorizes using it.**

Creating the tool (or its inert descriptor) does not confer execution
authority. `ACTIVATED` remains authority to participate in deterministic
*resolution* only; `COMMIT` remains the sole authority to cause a consequence.
A tool definition carrying governed boundaries (`amount ≤ $25`, `actor requires
SERVICE_RECOVERY`, `audit required`) constrains *future* consequences; it does
not pre-authorize any of them.

## Mapping of existing contracts

| Existing contract | Vocabulary primitive |
|---|---|
| `CandidateCapability` (id/label/resolves) | `READ_CAPABILITY` (boundary-free seed) |
| `ServiceOperationsToolDescriptor` (name/description/kind) | `TOOL_DEFINITION` + `READ_CAPABILITY`/`MUTATION_CAPABILITY` |
| `CommitConstraint` (condition: required/limit/authority/freshness) | `COMMIT_BOUNDARY`, `ACTOR_BINDING`, `SESSION_REQUIREMENT` |
| `AuthorizationArtifact` (effectFingerprint, nonce) | `EFFECT_FINGERPRINT` |
| `ExecutionObservation` / `VerificationResult` | `OBSERVATION` / `VERIFICATION` |
| `ServiceAuditEvent` | `AUDIT_EVENT` |

## Consequences

- The vocabulary is a **seed contract**, not a foundry. No tool generation,
  schema synthesis, test generation, or deployment is built now.
- It is additive and does not refactor Stage 3; `capability-extension.ts` keeps
  its narrow single-capability proof. When the foundry is built
  (post-challenge), `analyzeCapabilityRequest`'s output grows from
  `CandidateCapability` into a `GovernedCapabilityDescriptor` with kind and
  boundaries.
- The compiler-front-end framing is explicit: O-Agent = designer for genuine U;
  Xact Nodes = compiler over known primitives; WebMCP = target interface;
  Commit = authority boundary.
