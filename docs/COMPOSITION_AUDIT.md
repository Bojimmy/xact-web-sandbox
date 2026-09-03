# Xact Foundry composition audit

Baseline: 1 September 2026, after deployment v32.

## What the scan checks

Every natural-language read request must preserve four things through resolution and Boss re-entry:

1. The explicit read-only boundary must exclude mutation candidates.
2. Requested filters must remain filters, not become mutation predicates.
3. Requested joins and evidence fields must remain in the composed definition.
4. The runtime handler, when approved, must return the declared projection and remain read-only.

## Regression classes now covered

- Urgent work-order triage: priority, owner, due time, blocker.
- Work orders with unavailable owners: owner-unavailable filter, priority, due time, status.
- Escalated support review: severity, owner, customer history, next review.
- Service-credit opportunity evidence: eligibility, qualifying evidence, prior credits, unissued status.
- Customer plan-change history: email lookup plus date, prior plan, resulting plan.
- Owner workload: assigned work orders and tickets without reassignment.
- Customer 360: account, history, cases, work orders, and health without escalation.

## Current known gap

“Show support tickets that meet the stated conditions for escalation, with the evidence for each. Do not escalate any ticket.” still lacks a governed capability for the escalation-condition filter and evidence projection. The safe result is `NOVEL_BOUNDARY`/candidate build brief until that contract is explicitly approved; it must never fall back to a generic queue or escalation mutation.

## Inventory result

The catalog contains 40 governed entries. Twenty-four have direct public-safe runtime-read handlers. The remaining entries are construction-only or mutation contracts and must not be treated as executable reads. Catalog presence alone is not proof of a working tool.

## Required gate before judge testing

For each new read recipe, add one positive composition test and one negative mutation-contamination test, then verify the live MCP response and runtime read separately. A `BUILT` contract proves construction only; a successful `read_xact_capability` call is the evidence of an available read handler.
