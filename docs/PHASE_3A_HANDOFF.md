# Phase 3A — Implementation Handoff (DSH → Codex)

**Branch:** `phase-3a-authorization-artifact` (off `phase-2-mutable-scenario-engine`)
**Tests:** 37/37 passing (`npm test` = `tsx --test tests/*.test.ts`)
**Status:** implemented, not yet committed — review before `git commit`.

The authority for the contracts is **ADR 0004** (`AuthorizationArtifact`) and
**ADR 0005** (multi-substrate execution router). This handoff summarizes what
DSH already built against those ADRs, and what Codex should do next. Where this
note and an ADR disagree, **the ADR wins**.

---

## 1. What is implemented

### Phase 2 corrections (folded in per ADR 0004)
- `ScenarioPack.intent(inputs)` — generic providers no longer hardcode the refund string.
- `stateHash → stateFingerprint` across the full surface; fixture values normalized to readable
  `commerce:vN:balance=…:refunded=…` strings so the demo never implies cryptographic integrity.

### Phase 3A (the boundary contract, per ADR 0004 + 0005)

| Concept | File | Notes |
|---------|------|-------|
| `AuthorizationArtifact` (7 fields) | `src/xact/contracts.ts` | `commitId`, `effectFingerprint`, `baseStateFingerprint`, `actor`, `capability`, `nonce`, `issuedAtEpochMs`, `expiresAtEpochMs` (numeric epoch ms) |
| `DecisionResult.artifact?` | `src/xact/contracts.ts` | present iff `AUTHORIZED` |
| `AuthorizationArtifactStore` + `Issuer` + `stableFingerprint` | `src/xact/authorization-artifact.ts` | authenticity = full-artifact compare (tamper-evident); `consumeNonce` atomic; public-safe (no signing) |
| substrate-neutral `ExecutionAdapter` | `src/execution/contracts.ts` | `canHandle` / `validate` / `execute` / `observe` |
| `DeterministicExecutionRouter` | `src/execution/execution-router.ts` | priority `LOCAL → WEBMCP → DOM → VISION → NATIVE_API`, returns `{ adapter, reason }` |
| `SimulatedExecutionAdapter` | `src/execution/simulated-adapter.ts` | implements the 6-check guard + atomic nonce |
| Engine wiring | `src/runtime/commerce-engine.ts` | Commit mints the artifact; `executeAndVerify` does router-select → validate → execute → observe → verify |

### Guard sequence implemented in `SimulatedExecutionAdapter.validate`
1. authentic (store.issued — full-field compare)
2. well-formed
3. unexpired (`expiresAtEpochMs > now`, strict)
4. unreplayed (read fast-path)
5. effect-bound (`effectFingerprint === stableFingerprint(payload)`)
6. state-fresh (`baseStateFingerprint === currentStateFingerprint`)

Atomic nonce consumption happens in `execute`, **before** causing the effect.

### Tests added (`tests/authorization-artifact.test.ts`, 13 cases)
Forged / tampered / malformed / expired / effect-mismatched / stale artifacts all rejected;
nonce consumed exactly once; replayed execute blocked; router deterministic + fail-closed on
no capable adapter; `AUTHORIZED` carries an artifact and non-`AUTHORIZED` carries none;
end-to-end authorize → execute → verify.

---

## 2. Key contract points Codex must preserve

- **Substrate neutrality.** A real WebMCP adapter is just a second `ExecutionAdapter`
  behind the same `canHandle` / `validate` / `execute` / `observe` boundary.
- **`observe` reads what actually happened**, never the intended effect.
- **Fail closed = no execution + a reason.** No invented `ASK`/`PENDING`/`PARTIAL` execution state.
- **Atomic nonce at the execution boundary.** Replay must be blocked under concurrency.
- **Router is capability routing, never authority.** It must not authorize, alter the payload,
  expand capability, resolve ambiguity, invoke reasoning, or bypass validation.

---

## 3. What is NOT implemented (Codex's next work)

### Phase 3B — real WebMCP adapter (after 3A tests pass)
- Implement `WebMCPExecutionAdapter` as a second `ExecutionAdapter`.
- Cause one real authorized sandbox effect, independently verify it, emit audit
  (commitId ↔ execution ↔ verification).

### Phase 3C — failure behavior
- Demonstrate WebMCP unavailable → router does not bypass authority.
- Adapter failure must not fabricate successful execution.

### DOM / Vision
- Keep as contract-compatible placeholders or capability descriptors.
- **Do not implement fake "working" DOM/Vision adapters.**
- Acceptance: adding them must require **no change** to Commit or `AuthorizationArtifact`.

---

## 4. Caveat

`npx tsc --noEmit` currently fails on a **pre-existing** missing dependency
(`@cloudflare/workers-types` — `node_modules` was never installed in this checkout).
Run `npm install` before a full type-check. The 37 tests exercise the code at runtime and pass.
