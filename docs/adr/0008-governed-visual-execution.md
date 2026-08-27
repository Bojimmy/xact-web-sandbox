# ADR 0008 — Governed Visual Execution Preflight

**Status:** Accepted

**Depends on:** ADR 0004, ADR 0005, ADR 0007.

## Invariant

> **Vision may locate an authorized target. It may not redefine one.**

## Decision

The Vision execution route has two distinct stages:

```text
NON-CONSEQUENTIAL PREFLIGHT
capture surface + context → locate candidate → exact descriptor validation
                                      │ mismatch → BLOCK (nonce unspent)
                                      ▼
immediate exact-target re-check
                                      │ mismatch → BLOCK (nonce unspent)
                                      ▼
CONSEQUENTIAL BOUNDARY
atomic nonce consumption → activate exact target → observe → verify → audit
```

The `VisionTargetDescriptor` is part of the proposed-effect fingerprint:

```ts
interface VisionTargetDescriptor {
  targetId: string;
  role: string;
  name: string;
  origin: string;
  frameId: string;
  pageRevision: string;
}
```

All fields must match exactly at preflight and at the immediate re-check.
Confidence may be retained by an injected visual capability as diagnostic
evidence; it cannot substitute for identity or allow a partial match.

If a target disappears, moves, or mutates after the last re-check, activation
fails closed. The nonce remains consumed because the consequential operation
was reached and retry ambiguity must require a fresh Commit.

## Consequences

- Vision does not authorize, change an actor/capability/effect, or choose a
  substitute control.
- The visual capability remains injected and public-facing; no proprietary
  Xact resolution, matching, scoring, or learning internals are present.
- WebMCP, DOM, and Vision retain one common artifact, router, observation,
  verification, and audit boundary.

## Tests

The suite covers descriptor mismatch in preflight, target replacement during
the immediate re-check, disappearance/mutation during activation, nonce
timing, and the existing cross-substrate fallback paths.
