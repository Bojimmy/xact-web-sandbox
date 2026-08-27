# ADR 0005 — Governed Multi-Substrate Execution Router

**Status:** Proposed — drafted by DSH; Codex implements against ADR 0004 + this.

**Depends on:** ADR 0004 (`AuthorizationArtifact`). The artifact contract is
unchanged except that the `ExecutionAdapter` sketch there is superseded by the
substrate-neutral contract below.

## Context

Phase 3 is broader than "add WebMCP." It establishes the governed **Execution
Router**. WebMCP is the first challenge-facing adapter; DOM/Accessibility,
Vision, Native/API, and future protocols must plug into the same architecture
later **without redesigning Xact or weakening the Commit boundary**.

## Decision

1. Resolution and execution remain **orthogonal** (two ladders, never one).
2. Introduce `ExecutionRouter` — capability routing after Commit, never authority.
3. Make the `ExecutionAdapter` contract **substrate-neutral**.
4. State the extended invariants, fallback rules, and Vision-is-a-capability.
5. Phase 3A/B/C ordering; DOM/Vision start as contract-compatible placeholders
   or capability descriptors — **never fake "working" adapters**.

## Extended invariants

(ADR 0004's artifact invariant stands, plus:)

> **Changing the execution substrate never changes the authority required for the consequence.**

> **Execution adapters may determine HOW an authorized effect is caused. They may not determine WHETHER the effect is authorized.**

> **The browser can see the Delete Account button. That does not mean the agent has authority to press it.**

## Contract

### `ExecutionRouter`

```ts
interface ExecutionRouterSelection {
  adapter: ExecutionAdapter | null; // null → no capable adapter (fail closed)
  reason: string;                   // human-readable selection trace
}

interface ExecutionRouter {
  select(
    effect: AuthorizedEffect,
    availableAdapters: ExecutionAdapter[],
  ): Promise<ExecutionRouterSelection>;
}
```

The router selects **deterministically** by explicit policy/capability priority
order — never incidental array ordering, and never model choice. Default priority:

```text
LOCAL → WEBMCP → DOM → VISION → NATIVE_API
```

A scenario/policy may override the default, but the priority is always explicit.

The router must **explain** its choice, e.g.:

```text
WEBMCP selected — capability available + policy-preferred structured substrate
```

```text
WEBMCP unavailable → DOM unavailable → VISION selected
```

The router is **capability routing, not authority determination**. It must NOT:

- authorize an effect;
- alter the authorized payload;
- expand capability;
- resolve semantic ambiguity;
- invoke reasoning merely because an adapter is unavailable;
- bypass artifact validation;
- silently downgrade consequence controls.

### Substrate-neutral `ExecutionAdapter` (canonical; supersedes the ADR 0004 sketch)

```ts
interface ExecutionAdapter {
  readonly substrate: ExecutionSubstrate;

  // Capability routing: can this adapter cause this exact authorized effect?
  canHandle(effect: AuthorizedEffect): boolean;

  // ADR 0004 guard sequence: authentic → well-formed → unexpired → unreplayed
  // → authority current → effect bound → state fresh.
  validate(
    artifact: AuthorizationArtifact,
    payload: unknown,
    currentStateFingerprint: string,
  ): Promise<ExecutionValidation>;

  // Atomic nonce consume, then cause the effect. No side effect without a
  // valid, authentic artifact.
  execute(effect: AuthorizedEffect): Promise<ExecutionResult>;

  // Read what ACTUALLY happened (post-execution state) for independent
  // verification. Never return the intended effect as if it were observed.
  observe(
    effect: AuthorizedEffect,
    execution: ExecutionResult,
  ): Promise<unknown>; // scenario-typed observed state
}
```

`ExecutionSubstrate` already enumerates the ladder (`LOCAL`, `WEBMCP`, `DOM`,
`VISION`, `NATIVE_API`); future adapters extend that union, not the contract.

### Vision is a capability, not a brain

The Vision adapter **may**: observe screenshots, locate authorized targets,
interact with visual controls, confirm visual state, return observations.

The Vision adapter **may NOT**: independently authorize a consequence, expand
the authorized effect, substitute a different target, treat visual availability
as permission, or infer new authority because a control is visible.

### Execution fallback rules

- Fallback changes **HOW** the consequence is attempted, never the actor,
  capability, effect, authorization, state binding, or Commit decision.
- The **same `AuthorizationArtifact`** stays bound to the **same** consequence.
- If fallback requires materially changing the effect, target, capability, or
  state premise, **return to Xact for a new Commit**.
- Unavailable/insufficient substrate → **fail closed**; do not fabricate success
  and do not invoke reasoning merely because an adapter is unavailable.

## Phase 3 implementation order

- **3A** — `AuthorizationArtifact` (ADR 0004), artifact issuer/store/authenticity,
  atomic nonce consumption, substrate-neutral `ExecutionAdapter`, `ExecutionRouter`,
  negative-path tests. DOM/Vision as placeholders or capability descriptors.
- **3B** — real `WebMCPExecutionAdapter`: cause one real authorized sandbox
  effect, independently verify it, audit Commit → execution → verification.
- **3C** — demonstrate WebMCP unavailable/failure: the router does not bypass
  authority, and adapter failure cannot fabricate successful execution.

## Tests (add to ADR 0004's list)

- router cannot select an adapter before AUTHORIZED;
- every consequential adapter requires a valid artifact;
- adapter selection cannot alter the effect;
- adapter selection cannot alter actor/capability;
- fallback preserves artifact/effect binding;
- fallback cannot bypass freshness;
- unsupported substrate fails closed;
- unavailable WebMCP does not automatically invoke reasoning;
- adapter failure does not become AUTHORIZED success;
- verification failure remains visible;
- Vision cannot execute a different visually located target;
- materially changed execution intent requires a new Commit.

## Public / private boundary

WebMCP, DOM, and Vision adapters are **public execution capabilities**. Xact
resolution internals remain encapsulated — no production matching, scoring,
Rule Packs, learning extraction, production authorization policy, or X-Node
internals.

## Acceptance criterion

Adding `DOMExecutionAdapter` and `VisionExecutionAdapter` must require **no
change to Xact Commit or `AuthorizationArtifact`**. If an adapter addition forces
either to change, the architecture has drifted.
