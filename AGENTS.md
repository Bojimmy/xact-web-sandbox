# Xact Web Sandbox — Agent Instructions

Every coding or reasoning agent must read:

1. `PROJECT.md`
2. `ARCHITECTURE.md`
3. `PUBLIC_BOUNDARY.md`

before making architectural changes.

## Rules

- Preserve canonical Xact terminology.
- Do not redesign architecture silently.
- Keep reasoning and execution authority separate.
- Keep resolution and execution ladders orthogonal.
- Prefer small, testable changes.
- Test negative paths first-class.
- Fail closed on unknown authority state.
- Never weaken Commit controls to make a demo pass.
- Never fabricate proprietary Xact internals.
- Use public-safe simulation when internals are unavailable.
- Record meaningful architecture decisions.

## Required pre-change check

Before substantial implementation, state:

- affected architectural layer
- public/private boundary assessment
- expected failure modes
- smallest implementation that proves the concept
- tests required at the consequence boundary

## Agent skills

### Issue tracker

GitHub Issues via `gh`. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the five default triage labels. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout using root `CONTEXT.md` and `docs/adr/`. See `docs/agents/domain.md`.
