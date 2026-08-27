# ADR 0004 — Execution Authorization Artifact

**Status:** Proposed (revised) — drafted by DSH, refined by lead review; Codex implements against this contract.

## Context

Phase 2 `Commit` returns a bare `AUTHORIZED` status; execution trusts only
"substrate match + non-empty `commitId`". That is not a verifiable authorization
binding. Two failures follow if Phase 3 (WebMCP) makes execution real:

1. A caller can *manufacture* the artifact structure — knowing the schema must
   not equal authorizing yourself.
2. A bare shape check cannot close the check-then-act race on replay.

## Decision

1. Rename state bindings from `*Hash` to `*Fingerprint` (simulated deterministic
   binding, not cryptographic integrity).
2. Move `intent` into `ScenarioPack` (generic providers stop knowing they process
   refunds).
3. Introduce `AuthorizationArtifact` — a **bounded evidence record** emitted and
   **recorded** by Xact, independently validated by execution.
4. Add **issuance/authenticity**: execution must establish that Xact issued the
   exact artifact, via a public-safe `AuthorizationArtifactStore` (a stand-in for
   production signing, which stays private).
5. Make **nonce consumption atomic at the execution boundary** so concurrent
   requests cannot both pass the replay check.

## Load-bearing invariant

> **No execution adapter may cause a consequential effect without independently
> validating an authentic, current `AuthorizationArtifact` issued by Xact and
> bound to that exact actor, capability, effect, and state.**

## Contract

### `AuthorizationArtifact` (`src/xact/contracts.ts`)

```ts
interface AuthorizationArtifact {
  commitId: string;             // the Commit decision that produced it
  effectFingerprint: string;    // exact authorized effect
  baseStateFingerprint: string; // state the effect was authorized against
  actor: string;                // host-stamped; never read from the payload
  capability: string;           // e.g. "refund:create"
  nonce: string;                // single-use
  issuedAtEpochMs: number;      // epoch ms (machine contract; UI formats ISO-8601)
  expiresAtEpochMs: number;     // epoch ms; after this the artifact is stale
}
```

Epoch ms is used deliberately (not a monotonic clock, not an ISO string):
no parsing ambiguity, trivial comparisons, deterministic expiry-boundary tests.

### Issuance & authenticity (public-safe, replaces signing — `src/xact/`)

```ts
// Single source of truth for what Xact has issued. In production this is
// signature verification; the sandbox must NOT reconstruct that — the store is
// the public-safe authenticity oracle.
interface AuthorizationArtifactStore {
  // Authenticity: was this EXACT artifact (all fields) issued for commitId?
  // A tampered field (e.g. effectFingerprint) fails this check.
  issued(artifact: AuthorizationArtifact): boolean;
  // Atomic replay protection: mark nonce used iff not already used.
  consumeNonce(nonce: string): boolean;
}

interface AuthorizationArtifactIssuer {
  issue(params: {
    commitId: string;
    effectFingerprint: string;
    baseStateFingerprint: string;
    actor: string;
    capability: string;
  }): AuthorizationArtifact; // also records the full artifact in the store
}
```

`consumeNonce` must be **atomic**: a single compare-and-mark that returns true
exactly once per nonce, even under concurrency. In the single-threaded sandbox
an in-memory `Set` satisfies this; the contract still requires it so the WebMCP
adapter (which may be concurrent) cannot regress.

### `DecisionResult` change

```ts
interface DecisionResult<TInputs, TEffect> {
  // ...existing fields unchanged...
  artifact?: AuthorizationArtifact; // present iff status === "AUTHORIZED"
}
```

`Commit` mints the artifact via the `AuthorizationArtifactIssuer` and returns it.

### `ExecutionAdapter` contract change (`src/execution/contracts.ts`)

```ts
interface AuthorizedEffect {
  artifact: AuthorizationArtifact; // replaces the bare commitId
  substrate: ExecutionSubstrate;
  payload: unknown;
}

interface ExecutionValidation {
  valid: boolean;
  reason?: string;
  checks: string[]; // guard trace (audit-correlatable)
}

interface ExecutionAdapter {
  readonly substrate: ExecutionSubstrate;
  validate(
    artifact: AuthorizationArtifact,
    payload: unknown,
    currentStateFingerprint: string,
  ): Promise<ExecutionValidation>;
  execute(effect: AuthorizedEffect): Promise<ExecutionResult>;
}
```

`execute` is responsible for the atomic nonce consume *before* causing the effect
(see guard steps 8–9); `validate` is read-only.

### Guard sequence (fail-closed, in order)

```text
1.  authentic — store.issued(artifact) is true (exact artifact, not tampered)
2.  well-formed — all fields present and correctly typed
3.  unexpired — expiresAtEpochMs > nowEpochMs
4.  unreplayed (read) — nonce not already consumed (fast path)
5.  authority current — actor + capability still authorized
6.  effect bound — effectFingerprint === fingerprint(payload)
7.  state fresh — baseStateFingerprint === currentStateFingerprint
8.  consume nonce — atomic store.consumeNonce(nonce); false → BLOCK
9.  execute — cause the effect
10. verify — independently compare observed effect to the authorized effect
11. audit — correlate commitId ↔ execution ↔ verification
```

Steps 1–7 are read-only validation; step 8 is the atomic check-then-act that
closes the replay race. Step 4 is a fast-path read; step 8 is the enforcement.
Any failure → hard non-execution with a reason — there is no `ASK` / `PENDING` /
`PARTIAL` execution state.

## Phase 2 corrections folded into this change

### `ScenarioPack` owns intent (`src/scenarios/contracts.ts`)

```ts
interface ScenarioPack<TInputs, TState, TEffect> {
  // ...existing members...
  intent(inputs: TInputs): string;
}
```

Remove the hardcoded `"Issue a refund under simulated Commerce V1 policy"` from
`SimulationDecisionProvider.buildCandidate` and `runtime-view.ts`.

### `stateHash` → `stateFingerprint` (full rename surface)

| From | To |
|------|----|
| `ScenarioPack.stateHash` | `stateFingerprint` |
| `DecisionCandidate.baseStateHash` | `baseStateFingerprint` |
| `DecisionResult.currentStateHash` | `currentStateFingerprint` |
| `SimulationSession.currentStateHash` | `currentStateFingerprint` |
| `ControlRoomScenario.commit.baseHash` / `currentHash` | `baseFingerprint` / `currentFingerprint` |
| fixture `baseHash`/`currentHash` + `hash-compare` UI | `baseFingerprint`/`currentFingerprint` |

Keep the runtime fingerprint a readable deterministic string; normalize the
hex-like fixture hashes so the demo never implies cryptographic integrity.

## Tests Codex must add (negative paths first-class)

- `validate` rejects: missing / malformed / expired / replayed / effect-mismatched / stale-state / unauthorized.
- **authenticity:** an artifact not in the store is rejected; a *tampered* artifact (any field changed) is rejected.
- no adapter executes without a valid, authentic artifact.
- `AUTHORIZED` carries an artifact; `REJECTED` / `ESCALATED` / `STALE` carry none.
- **atomic nonce:** two concurrent `consumeNonce` for the same nonce → exactly one succeeds; the other fails closed.
- expiry-boundary: `expiresAtEpochMs === now` is stale (strictly greater).

## Out of scope

- Production signing/key management for artifact authenticity (private; the store simulates it).
- A real WebMCP server — this ADR defines the *contract* the WebMCP adapter implements as a second `ExecutionAdapter` behind `validate` + `execute`.

## See also

ADR 0005 (`governed-multi-substrate-execution-router`) supersedes the
`ExecutionAdapter` sketch above with the **substrate-neutral** contract (adding
`canHandle` and `observe`) and introduces the `ExecutionRouter`. The
`AuthorizationArtifact` contract in this ADR is unchanged by ADR 0005.
