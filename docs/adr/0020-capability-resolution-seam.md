# ADR 0020 — Public Capability Resolution Seam

**Status:** Accepted

**Depends on:** ADR 0016 (governed capability construction vocabulary), ADR
0019 (Xact WebMCP Foundry). Changes neither construction authority nor Commit.

## Context

The public ChatGPT bridge originally treated every unrecognized request as a
Boss question and supplied the entire governed catalog. This was slow, made
the Boss infer choices from a large payload, and could end in an unexplained
`BLOCKED` result. It also risked a tempting but unsafe shortcut: treating a
nearby capability as the requested one.

## Decision

Add one public **Capability Resolution** seam before the Boss loop. It uses
only explicitly declared public discovery terms for governed recipes:

1. A declared equivalent resolves to its exact governed recipe and constructs
   immediately when no genuine U remains.
2. Two or more declared plausible recipes return at most three choices for a
   concise user clarification. The stored run accepts only those IDs.
3. No declared governed match returns a truthful `BLOCKED` result with a
   candidate read-only build brief for governance review.
4. `get_boss_request` is reserved for genuine semantic U after deterministic
   capability resolution; it never returns the full catalog.

A candidate build brief is not a capability, authorization, or a promise to
construct. It is public-safe evidence of what governance would need to add.

## Consequences

- The bridge optimizes for governed coverage and honest resolution, not a
  superficially high match rate.
- A false match is prohibited: for example, customer order-status lookup is
  not mapped to the distinct field work-order recipes.
- The complete catalog remains browseable through `list_xact_capabilities`,
  but runtime Boss context stays bounded and specific.
- Commit remains unchanged: every composed definition is inert, and every
  future mutation still needs a fresh Xact Commit.
