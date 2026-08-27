# Xact Web Sandbox — Design Direction

## Visual posture

Serious infrastructure, not generic SaaS.

Reference feel: operational control room, modern infrastructure console, trace inspector.

## Primary UI objects

- REQUEST
- R — Resolved
- U — Unresolved
- C — Commit Constraints
- EVIDENCE
- PROVENANCE
- AUTHORITY
- EXECUTION
- TRACE
- VERIFY

## Commit status

The primary visual state may show:

- AUTHORIZED
- REJECTED
- ESCALATED
- STALE
- VERIFIED

Conflict is displayed as a condition within C, never as the meaning of C.

`REJECTED` must read as a final denial under current inputs. `ESCALATED` must
show a governed re-entry path for additional resolution or authority. Both are
non-executable until a later Commit returns `AUTHORIZED`.

## UX goal

A first-time viewer should understand three things without reading documentation:

1. reasoning is isolated to genuine uncertainty;
2. authority is independently checked at Commit;
3. execution method is selected only after authorization.
