# Handoff → Codex — Xact WebMCP Foundry (ready to commit + deploy)

**Worktree:** `/private/tmp/xact-darkdash-integration` — branch `codex/phase-7-dark-dashboard-integration`.
I restored the worktree's `.git` pointer file (it had been deleted, which made `git` report the
worktree as "prunable"), so `git status` works again from inside the worktree.

**Validation (all green):** `tsc --noEmit` clean · **311/311 tests pass** · bridge `npm run build` clean.

---

## 1. Commit these

Everything below is uncommitted on `codex/phase-7-dark-dashboard-integration`. From the worktree:

```bash
git add -A && git commit -m "flagship: governed MCP build + sales leaderboard + judge brief"
git push origin codex/phase-7-dark-dashboard-integration
```

Root `.gitignore` already covers `node_modules/` and `.next/` at any depth, so the bridge's build
artifacts are NOT staged by `git add -A` (verified: `git check-ignore` flags
`chatgpt-mcp-bridge/node_modules/.bin` and `chatgpt-mcp-bridge/.next`).

### Modified (15)

- `app/foundry/catalog/page.tsx`
- `app/foundry/page.tsx`
- `app/globals.css`
- `public/coldopen/index.html`
- `src/chatgpt-app/xact-foundry-tools.ts`
- `src/chatgpt-app/xact-mcp-server.ts`
- `src/flagship/business-workspace.ts`
- `src/flagship/foundry-catalog.ts`
- `src/flagship/foundry-liaison.ts`
- `src/flagship/foundry-mutation-commit.ts`
- `src/flagship/foundry-read-substrate.ts`
- `tests/foundry-liaison.test.ts`
- `tests/foundry-read-substrate.test.ts`
- `tests/foundry-runtime.test.ts`
- `tests/xact-chatgpt-tools.test.ts`

### New / untracked (23) — the whole ChatGPT MCP bridge + Foundry UI + demo pack

- `chatgpt-mcp-bridge/` (separate Next.js app re-exporting `createXactMcpServer`)
- `src/chatgpt-app/capability-composition.ts`
- `src/chatgpt-app/capability-resolution.ts`
- `src/chatgpt-app/xact-boss-loop.ts`
- `src/chatgpt-app/xact-demo-prompts.ts`
- `docs/JUDGES_BRIEF.md`
- `docs/COMPOSITION_AUDIT.md`
- `docs/PUBLIC_DISCLOSURE_AUDIT.md`
- `docs/adr/0020-capability-resolution-seam.md`
- `public/assets/` (5 webp, ~564K), `public/xact-foundry-logo.{png,webp}`, `public/coldopen/COLDOPEN_SPEC.md`
- `tests/capability-composition.test.ts`, `tests/capability-composition-demo.test.ts`
- `tests/capability-resolution.test.ts`, `tests/resolver-regression.test.ts`
- `tests/sales-leaderboard.test.ts`, `tests/xact-boss-loop.test.ts`
- `tests/xact-boss-server-state.test.ts`, `tests/xact-demo-prompts.test.ts`, `tests/xact-runtime-read.test.ts`

---

## 2. What changed since live v35 (41 capabilities → 44)

1. **`get_sales_leaderboard`** — new governed READ (representative, team, closedDeals, revenue,
   quotaAttainment, rank), `requiresCommit: false`, wired to a live on-demand read handler.
2. **`get_urgent_work_orders_unqualified_owner`** + **`get_support_lead_decision_queue`** — two new
   governed READ compositions, plus resolver fixes (`observationalIntent` exclusion so "do not
   perform / possible next action" language never resolves to a mutation).
3. **Sales-data name fix** — `salesLeaderboard`/`salesPipeline` in `business-workspace.ts` previously
   used invented names; now they reference only actual Sales-division employees, with a regression
   guard in `tests/sales-leaderboard.test.ts`.
4. **Demo copy** — `docs/JUDGES_BRIEF.md` gains "Recommended judge workflow" (5 steps) and
   "Challenge scope" (chat-scoped limitation + dashboard-as-future-productization framing).
   `xact-mcp-server.ts` Boss instructions and the `list_xact_demo_prompts` note now state the
   chat-scoped scope in the live surface.

## 3. Deploy + verify

- Deploy the bridge (OpenAI "sites", project `appgprj_6a960ba0dc288191a423ab175458c232`, live
  `https://xact-foundry-mcp.bojimmy.chatgpt.site`, endpoint `/api/mcp`).
- Verify `list_xact_capabilities` now returns **44** capabilities, including `get_sales_leaderboard`.

## 4. Invariants — do not break

1. construct ≠ authorize — composing a tool never authorizes using it.
2. ACTIVATED = resolution-only; COMMIT = consequence.
3. Every MUTATION invocation re-commits (no cached authorization).
4. No `SIMULATED_O_AGENT` in the judge-facing path; fail closed on unavailable reasoning.
5. "If the liaison does not emit it, it does not light up" — every lit state maps to a real event or a real failure.
6. Governed capabilities are **chat-scoped** for this Challenge build (no second persistence layer); dashboard is future productization, not part of this build.
