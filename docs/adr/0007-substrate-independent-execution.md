# ADR 0007 — Same Authority Across Execution Substrates

**Status:** Accepted

**Depends on:** ADR 0004, ADR 0005, and ADR 0006.

## Context

An execution router is only useful if changing transport does not alter the
authorized consequence. Phase 4 proves that a single candidate and its one
`AuthorizationArtifact` can use WebMCP, DOM/accessibility, or Vision without
re-running resolution or changing Commit policy.

## Decision

1. `ExecutionObservation` is a typed record: substrate, receipt, exact target,
   effect fingerprint, and observation time. It replaces the former implicit
   receipt-shaped observation convention.
2. The router returns a routed execution envelope. It may replace only
   `effect.substrate`; `artifact` and `payload` remain the same object values.
3. Target identity lives inside the proposed effect payload and is therefore
   included in the artifact's effect fingerprint.
4. `DOMExecutionAdapter` activates the exact bound DOM target and reads its
   post-activation audit attributes. `BrowserDOMExecutionClient` is an actual
   document capability, not an authority source.
5. `VisionExecutionAdapter` calls a replaceable visual-location capability, but
   compares the located target to the target bound in the effect before it may
   activate anything. A visual match for a different target fails closed.
6. Fallback is explicit: `WEBMCP → DOM → VISION`. It is availability routing,
   never a policy, authority, payload, actor, capability, or state decision.

## Consequences

- The same verification criteria apply regardless of route: execution receipt,
  observed receipt, exact effect fingerprint, exact target, and state delta.
- DOM/Vision availability does not cause reasoning, new authorization, or an
  ungoverned retry.
- Real production vision remains an injected public capability. This sandbox
  does not infer or expose proprietary Xact resolution internals.

## Tests

The substrate-independence suite asserts both fallback paths, preserves the
same artifact/payload identity, validates a real DOM target activation client,
and blocks a Vision client that locates a different target.
