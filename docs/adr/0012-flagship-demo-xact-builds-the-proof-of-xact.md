# ADR 0012 — Flagship Demo: "Xact Builds the Proof of Xact"

**Status:** Proposed — consolidated flagship (frozen concept → contract).

**Depends on:** ADR 0004–0011. This ADR **composes** existing boundaries; it adds no
new authority, Commit, execution, verification, or public/private logic. It
*does* open the Construction Lab through one tightly-bounded capability-extension
entry point — a construction-layer change, never an authority change.

---

## 1. The frozen flagship — PROVE IT → TEACH IT → USE IT

One continuous system, three acts, one artifact.

- **I — PROVE IT.** Controlled cold construction → governed learning → ACTIVATED
  → rebuild, showing the measured **30 → 4 O-Agent calls (−87%)** and a
  bit-identical verified artifact.
- **II — TEACH IT.** The judge enters a novel WebMCP capability under "Give Xact
  more abilities to absorb." Xact decomposes it into R/U/C, uses the O-Agent only
  for genuine U, validates the proposal against governed primitives and
  authority, and permits activation only through
  `OBSERVED → CANDIDATE → VALIDATED → APPROVED → ACTIVATED`.
- **III — USE IT.** Exercise the resulting capability through WebMCP, and
  demonstrate substrate-independent authority through WebMCP → DOM → Vision.

Part II is **in-scope** because the judge-supplied capability is the strongest
evidence the system is live, not a canned benchmark. It is deliberately **narrow**:
a bounded WebMCP capability-extension system over approved primitives — never a
general application generator. A refusal is a *success*, not a failure.

---

## 2. The authority model — two distinct governed consequences

This is load-bearing and must never be collapsed into one "authorize."

```text
(a) COMMIT — authorize + commit a CONSEQUENCE
    • building the application (Part I)
    • constructing a new capability (Part II)
    • executing an effect (Part III)

(b) ACTIVATED — approve + activate a CAPABILITY's participation in
    DETERMINISTIC RESOLUTION
    • the governed lifecycle: OBSERVED → CANDIDATE → VALIDATED → APPROVED → ACTIVATED
    • grants the right to RESOLVE (reduce reasoning), never to EXECUTE
```

The full capability-creation path, in order:

```text
O-Agent proposal            (evidence, never authority)
  → candidate capability    (not executable)
  → validate (allowlist)    (reject non-approved primitives)
  → authorize → Commit      (consequence: the capability is constructed)
  → observe → verify        (the constructed capability is real)
  → ABSORB                  (OBSERVED → CANDIDATE → VALIDATED → APPROVED → ACTIVATED)
  → ACTIVATED               (may RESOLVE deterministically)
```

**Rule: `ACTIVATED` grants resolution authority, never execution authority.**
An activated capability reduces reasoning (U → R, 0 tokens) but the construction
or effect it feeds still traverses Commit. The word *authorize* never carries
both "authorize to construct" and "authority to execute."

**No route-around:** `LLM proposal → new WebMCP tool → executable` is forbidden.
The only path is `proposal → candidate → validate → Commit → construct → verify →
governed ACTIVATED → executable-under-Commit`. A negative test must assert the
O-Agent alone cannot produce an executable capability.

---

## 3. Terminology change — `ACTIVE` → `ACTIVATED`

Rename `PromotionState.ACTIVE` → `ACTIVATED` across `evolution/contracts.ts`,
`learning-simulation-provider.ts`, the UI, tests, and ADR 0009/0010/0011. The
sequence stays `OBSERVED → CANDIDATE → VALIDATED → APPROVED → ACTIVATED`.

`APPROVED` = governance accepted the capability. `ACTIVATED` = the capability is
now permitted to participate in deterministic resolution. **Approval precedes
activation** — an O-Agent resolution must never automatically become
deterministic authority.

---

## 4. Reconciliations with ADR 0004–0011 (already analysed)

| # | Conflict | Smallest change | Layer |
|---|----------|-----------------|-------|
| A | closed construction vs. novel capability extension | bounded capability-extension entry point over the existing allowlist + Commit | construction |
| B | `ACTIVE` vs. `ACTIVATED` + governed transition | rename + audit record on APPROVED → ACTIVATED | terminology + provenance |
| C | reasoning provenance | introduce `LIVE_O_AGENT_MEASUREMENT` (distinct from `LIVE_SANDBOX_MEASUREMENT`) | telemetry |
| D | data artifact vs. live WebMCP app | render a live app + register `document.modelContext` tools | construction |
| E | (none — anti-route-around) | encode the capability-creation path + negative test | invariant |

None weaken authority, Commit, AuthorizationArtifact, WebMCP, DOM, Vision,
verification, stale-state, replay, or public/private.

---

## 5. The three clocks (presentation model)

| Clock | Measures | Provenance | Result |
|-------|----------|-----------|--------|
| Decision | Xact authorizes one candidate | `REFERENCE_XACT_CORE_BENCHMARK` (displayed, not sandbox-measured) | ~9 μs |
| Work | deterministic construction | `LIVE_SANDBOX_MEASUREMENT` | ~0.5 s |
| Reasoning | O-Agent on genuine U | `LIVE_O_AGENT_MEASUREMENT` | 109.9 s → 13.9 s (Halo) |

> **Xact decides in microseconds, deterministic work executes in milliseconds,
> and reasoning takes seconds. Learning reduces the seconds — not the work.**

**Metrics distinction (§4 of the source):** "deterministically resolved
operations" (9,981 → 10,007) is *not* "construction operations executed"
(10,011 in both runs). Learning changes the first; it never eliminates the second.

**Model-independent vs model-dependent (§10):** the call reduction 30 → 4
(−86.67% → reported −87%) is model-independent (driven by how many U nodes go
deterministic). Tokens, latency, and cost are model-dependent and are measured
per provider, never copied from Halo onto another model.

---

## 6. Judge journey (exact sequence)

1. **RUN COLD** — live counters increment; inspectable per-call reasoning trace
   (node, status, provider, latency, tokens, evidence, result).
2. **OPEN RESULT** — the finished application is visible, interactive, verifiable,
   inspectable, WebMCP-enabled.
3. **INSPECT WEBMCP TOOLS** — actual tools exist (`get_customer`,
   `get_account_status`, `list_available_actions`, `request_service_credit`,
   `change_service_plan`, `get_audit_history`); never claim a tool that is absent.
4. **PROMOTE GOVERNED LEARNING** — `OBSERVED → CANDIDATE → VALIDATED → APPROVED → ACTIVATED`.
5. **REBUILD** — 30 → 4 calls (−87%), identical checksum, same app, same workload.
6. **TEACH IT** — enter a novel capability prompt; decompose → R/U/C → O-Agent on
   U → validate → authorize → Commit → construct → observe → verify → ABSORB → ACTIVATED.
7. **TRY SOMETHING FORBIDDEN** — "delete any customer account" →
   `REQUEST UNDERSTOOD ✓ / CAPABILITY NOT ACTIVATED / knowing how is not authority
   to act`, with the commit constraints that block it.
8. **USE IT** — one exact authorized effect through WebMCP, then DOM, then Vision
   (same authority, same verified outcome); a decoy target → `TARGET MISMATCH → BLOCKED`.

> **Don't trust the numbers. Inspect the run.**

`INTRODUCE NOVELTY` and other adversarial extras are **stretch scope** — the
judge-supplied capability already provides the novelty for the minimum flagship.

---

## 7. Classification (hard vs. soft)

| Kind | Items |
|------|-------|
| **Measured facts** | 30→4 (−87%) Halo · 5,032→665 tokens · 109.9→13.9s · 478→534ms (noise) · checksum `698530768` · 6.12× @ 25 workers · checksum `3125889056` · 9μs / 109,500/s (reference) |
| **Architectural invariants** | Commit = authority · capability ≠ authority · approval precedes activation · no LLM→executable · vision locates never redefines · substrate changes, authority doesn't |
| **Messaging** | §8 slogans · "The LLM didn't get faster; Xact stopped needing it" · "Knowing how is not authority to act" |
| **Future implications** | one day/month/year · enterprise proposition (never claimed as measured) |
| **Optional scope** | INTRODUCE NOVELTY · additional adversarial features |

---

## 8. Canonical messaging (retained verbatim)

- **Product:** *Reason when necessary. Execute Xactly.*
- **Authority:** *Reasoning may propose a consequence. Only Xact may commit one.*
- **WebMCP:** *WebMCP provides capability. Xact provides authority.*
- **Governance:** *Capability may evolve. Authority remains governed.*
- **Learning:** *Reasoning used to reduce the future need for reasoning.*
- **Absorption:** *Reasoning discovers. Governance approves. Xact absorbs.*
- **Enterprise AI:** *AI can learn without learning to overstep.*
- **Refusal:** *Knowing how is not authority to act.*
- **Execution:** *Execution substrate can change. Authority does not.*
- **Vision:** *Vision may locate an authorized target. It may not redefine one.*
- **Overall:** *Let intelligence expand capability without expanding authority.*
- **Closing:** *The LLM didn't get faster. Xact stopped needing it.*
- **Final lockup:** *On time. Under budget. Done Xactly as determined.*

---

## 9. Boundaries preserved (explicit)

- **Authority / Commit:** ADR 0004 unchanged.
- **WebMCP / DOM / Vision:** ADR 0006 / 0007 / 0008 unchanged.
- **Verification + observation:** unchanged.
- **Public / private:** the O-Agent is provider-neutral (`OAgentProvider`); Halo is
  the local measured provider; a cloud multimodal model is a replaceable
  implementation, never an architectural dependency; credentials live behind the
  secure gateway; no production Xact internals are exposed.

---

## 10. Staged implementation plan (smallest credible first)

- **Stage 0 — authority disambiguation.** Encode §2 (Commit vs. ACTIVATED) as an
  explicit contract + negative test (O-Agent alone cannot produce an executable
  capability). No behavior change; it locks the boundary.
- **Stage 1 — Part I live.** Wire the controlled cold → learn → ACTIVATED →
  rebuild loop (30 → 4) with the three-clock panel + per-call inspectable trace.
- **Stage 2 — Part III live.** One authorized effect through WebMCP → DOM →
  Vision (decoy → BLOCKED) on the constructed app.
- **Stage 3 — Part II live.** The bounded capability-extension entry point:
  novel prompt → decompose → R/U/C → O-Agent on U → validate → authorize → Commit
  → construct → observe → verify → ABSORB → ACTIVATED; forbidden → refusal.
- **Stage 4 — polish.** OPEN RESULT / INSPECT TOOLS / refusal UX / slogan captions.

Each stage lands with negative-path tests at the consequence boundary. The
authority layer (ADR 0004–0008) requires no changes at any stage.
