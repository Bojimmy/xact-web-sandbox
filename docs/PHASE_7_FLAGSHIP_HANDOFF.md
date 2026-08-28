# Flagship Demo — Handoff (DSH → Codex)

**Contract:** `docs/adr/0012-flagship-demo-xact-builds-the-proof-of-xact.md`. Read it
first; this file is the execution pointer, not the full record.

> **IMPLEMENTATION GATE: Stage 0 must land and pass its authority-boundary tests
> before any Stage 1–4 implementation begins. No later stage may introduce a path
> that bypasses Commit or allows ACTIVATED capability to confer execution authority.**

## Stage 0 acceptance criteria (what "pass" means)

- Two distinct, non-castable types exist: **consequence authorization** (Commit)
  and **resolution authority** (ACTIVATED). Nothing converts one into the other.
- A negative test proves an O-Agent proposal is a *candidate capability* with no
  executable surface — it cannot be invoked to cause an effect.
- A second negative test proves an ACTIVATED capability resolves U → R (0 tokens)
  but its output still traverses Commit to cause any effect.
- A test proves the only path from candidate to executable is
  `validate → authorize → Commit → construct → observe → verify → ACTIVATED`.

## Provider note

Stage 0 needs no model. Stages 1+ use the existing Halo/simulated `OAgentProvider`
until the cloud provider is wired; credentials arrive separately and are never
committed. Do not hardcode a specific model as a dependency (ADR 0012 §9).

## Staged plan (smallest credible first)

- **Stage 0 — authority disambiguation.** Encode the Commit-vs-ACTIVATED
  distinction as an explicit contract + negative test: an O-Agent proposal alone
  cannot produce an executable capability. No behavior change; it locks the boundary.
- **Stage 1 — Part I live.** Cold → governed learning → ACTIVATED → rebuild
  (30 → 4 calls), three-clock panel, inspectable per-call reasoning trace.
- **Stage 2 — Part III live.** One exact authorized effect through WebMCP → DOM →
  Vision, decoy target → BLOCKED.
- **Stage 3 — Part II live.** Bounded capability-extension entry point:
  novel prompt → decompose → R/U/C → O-Agent on U → validate → authorize → Commit
  → construct → observe → verify → ABSORB → ACTIVATED; forbidden → refusal.
- **Stage 4 — polish.** OPEN RESULT / INSPECT TOOLS / refusal UX / slogan captions.

The authority layer (ADR 0004–0008) requires no changes at any stage. Every stage
lands with negative-path tests at the consequence boundary.
