# ADR 0013 — Service Operations Console Construction Target

**Status:** Accepted

## Context

The experimental 6A.1 construction artifact was an Inventory Dashboard. ADR
0012 defines the flagship constructed application differently: the Service
Operations Console, with customer, account, service-credit, plan, and audit
surfaces. The former Commerce refund runtime remains a separate Phase 2 demo.

## Decision

The construction engine now assembles a public-safe
`SERVICE_OPERATIONS_CONSOLE` artifact. Its exact constructed capability manifest
is:

- `get_customer`
- `get_account_status`
- `list_available_actions`
- `request_service_credit`
- `change_service_plan`
- `get_audit_history`

The manifest is descriptive, not executable. Read capabilities describe the
constructed read model. Consequential capability requests describe what a later
artifact-bound transport may make possible; they provide neither Commit
authority nor an execution handler.

## Consequences

Stage 2's guarded WebMCP host will attach only to this constructed console. The
first consequential demo target will be service credit for customer `1042`.
`AuthorizationArtifact`, nonce consumption, current-state validation,
observation, and verification remain unchanged and are intentionally deferred
to that attachment slice.
