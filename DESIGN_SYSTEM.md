# Xact Web Sandbox — Design Direction

## Visual posture

Serious infrastructure, not generic SaaS.

Reference feel: operational control room, modern infrastructure console, trace inspector.

## Primary UI objects

- REQUEST
- R — Resolved
- U — Unresolved
- C — Conflict / Commit context
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

## UX goal

A first-time viewer should understand three things without reading documentation:

1. reasoning is isolated to genuine uncertainty;
2. authority is independently checked at Commit;
3. execution method is selected only after authorization.
