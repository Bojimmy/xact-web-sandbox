# Phase 1 Review Handoff — Xact Control Room

## Review subject

| Field | Value |
| --- | --- |
| Repository | `Bojimmy/xact-web-sandbox` |
| Pull request | `#1` — Phase 1: Xact Control Room |
| Base | `main` at `ab95528c42998713b5de3048ef4e4e27a51be559` |
| Review commit | `b763238bcadb64bea5a4131cb4beed42c965ddc9` |
| Head branch | `phase-1-control-room` |
| Review state | Draft; not merged |
| Artifact scope | Evidence-only handoff; this document is added after the review commit and does not change the application under review |

Direct references:

- Repository: <https://github.com/Bojimmy/xact-web-sandbox>
- Pull request: <https://github.com/Bojimmy/xact-web-sandbox/pull/1>
- Review commit: <https://github.com/Bojimmy/xact-web-sandbox/commit/b763238bcadb64bea5a4131cb4beed42c965ddc9>
- Base-to-review comparison: <https://github.com/Bojimmy/xact-web-sandbox/compare/ab95528c42998713b5de3048ef4e4e27a51be559...b763238bcadb64bea5a4131cb4beed42c965ddc9>

## Requested decision

Review Phase 1 against:

1. canonical architecture;
2. the public/private boundary;
3. first-view UX clarity;
4. consequence-boundary invariants; and
5. readiness to proceed to mutable scenarios and WebMCP.

Return one verdict:

- **PASS** — Phase 1 proves the architecture and may proceed;
- **PASS WITH CHANGES** — direction is sound, with bounded corrections; or
- **HOLD** — an architecture, public-boundary, or consequence-boundary issue must be resolved first.

## What Phase 1 implements

Phase 1 is a single-page, deterministic Control Room for four Commerce V1
scenarios:

- **Authorized** — an in-policy refund reaches `AUTHORIZED → EXECUTED → VERIFIED`;
- **Rejected** — a refund above verified authority fails before execution;
- **Escalated** — one semantic field is isolated, O-Agent output returns as
  evidence, and governed review is required;
- **Stale** — reasoning occurs against a valid base state, Commit re-reads the
  state, detects a hash mismatch, and discards the candidate without effect.

Every scenario exposes the same review surface:

`Request → R/U/C → Evidence + provenance → O-Agent involvement → Commit → Execution substrate → Trace → Verification`

The implementation is intentionally fixture-driven. It does not include a
backend, mutable state, live tools, policy evaluation, an authorization engine,
or a real execution adapter.

## Architecture mapping

| Canonical requirement | Phase 1 proof |
| --- | --- |
| Resolution and execution ladders remain orthogonal | R/U/C is rendered in a dedicated resolution section; execution substrate is shown only inside and after the Commit section. |
| Reason only when U requires interpretation | Authorized and Rejected skip O-Agent; Escalated and Stale invoke it for one explicit unresolved field. |
| O-Agent output is evidence, not authority | O-Agent output is rendered in the evidence panel and re-enters Commit; it never sets execution state. |
| Commit independently checks authority | Policy, capability, and candidate-state binding are separate visible checks. |
| Commit re-reads relevant state | Base and current hashes are compared; Stale shows a mismatch and no released effect. |
| Tool access is not authority | WebMCP appears only as the selected substrate in the Authorized fixture after Commit. |
| Unknown or non-authorized outcomes fail closed | Rejected, Escalated, and Stale use substrate `NONE`, `executed: false`, and no receipt. |
| Consequential effects are verified | Authorized has a distinct verification state and exact post-effect checks; other states explicitly show blocked or not-run verification. |

No production provider is implemented in Phase 1. ADR 0001 records that this
surface consumes presentation-only fixtures and defers `ScenarioPack` and
`SimulationDecisionProvider` runtime work to Phase 2.

## Public-boundary assessment

### Exposed, public-safe material

- Xact concepts and canonical terminology;
- R/U/C display values;
- reported, verified, and derived evidence labels;
- simulated evidence provenance;
- simulated authorization outcomes;
- candidate-state binding and stale-guard presentation;
- execution-substrate labels;
- deterministic trace and verification fixtures; and
- public TypeScript view-model contracts.

### Explicitly absent

- production Xact Core or X-Node code;
- proprietary deterministic resolution logic;
- matching, scoring, or confidence algorithms;
- production Rule Packs or rule generation;
- governed learning or pattern promotion;
- production authorization logic;
- private benchmarks; and
- live WebMCP or other execution calls.

The interface labels itself **Public-safe simulation** and **Deterministic
fixture**. ADR 0001 additionally states that the UI does not evaluate policy,
infer confidence, resolve semantics, mutate state, or execute effects.

## Changed-file inventory for `b763238`

### Product surface

| File | Role |
| --- | --- |
| `app/page.tsx` | Scenario switcher and complete Control Room composition. |
| `app/globals.css` | Infrastructure-console visual system, status semantics, responsive layout, focus states, and reduced-motion handling. |
| `app/layout.tsx` | Product metadata and social-preview metadata. |
| `public/og.png` | 1200×630 branded social-preview asset; not an application screenshot. |

### Deterministic scenario model

| File | Role |
| --- | --- |
| `src/control-room/types.ts` | Typed presentation model for scenario, evidence, trace, Commit, execution, and verification data. |
| `src/control-room/fixtures.ts` | The four deterministic Commerce V1 scenario fixtures. |
| `tests/control-room-fixtures.test.ts` | Consequence-boundary invariants for the fixture pack. |

### Architecture and project documentation

| File | Role |
| --- | --- |
| `docs/adr/0001-phase-1-control-room-fixtures.md` | Records the fixture-only Phase 1 decision and Phase 2 replacement seam. |
| `README.md` | Adds Phase 1 scope and local validation instructions. |
| `project-manifest.json` | Advances the project phase and points to application, fixtures, and ADR. |

### Application toolchain

| File | Role |
| --- | --- |
| `package.json`, `package-lock.json` | Reproducible runtime, build, lint, test, and audit dependencies. |
| `vite.config.ts` | Vinext, Sites, and Cloudflare-compatible build configuration. |
| `.openai/hosting.json` | Declares no D1 or R2 capability for this static phase. |
| `next.config.ts`, `next-env.d.ts`, `tsconfig.json` | Framework and TypeScript configuration. |
| `eslint.config.mjs` | Next.js and TypeScript lint configuration. |
| `.gitignore` | Excludes dependencies, builds, local runtime state, and environment files. |

Totals: **19 changed files**, **12,291 insertions**, **2 deletions**. Most
insertions are the generated lockfile; the hand-authored product surface is
concentrated in the files listed above.

## Key implementation excerpts

Line references are pinned to review commit `b763238`.

### 1. Execution remains an explicit post-Commit choice

`src/control-room/types.ts:70`

```ts
execution: {
  selected: ExecutionSubstrate | "NONE";
  effect: string;
  executed: boolean;
  receipt: string;
};
```

`NONE` is a first-class display state, so the three non-authorized outcomes do
not need a fabricated or placeholder execution substrate.

### 2. Fixtures encode the consequence boundary directly

`src/control-room/fixtures.ts:41,87,133,179`

```ts
// Authorized
execution: {
  selected: "WEBMCP",
  effect: "refund.create",
  executed: true,
  receipt: "rcpt_WM_729A",
}

// Rejected, Escalated, and Stale
execution: {
  selected: "NONE",
  executed: false,
  receipt: "—",
  // effect text explains why no consequence was released
}
```

The Stale fixture additionally binds `baseHash: "ae10…29f1"` and
`currentHash: "ce44…9a70"` to `stateBinding: "FAIL · base hash mismatch"`.

### 3. The UI keeps resolution, Commit, execution, and verification visible

`app/page.tsx:76,95,143,153,166,174`

```tsx
<div className="decision-block" role="status" aria-live="polite">
  <span>Commit decision</span>
  <strong>{scenario.status}</strong>
</div>

<div className="resolution-grid">{/* R / U / C */}</div>
<div className="commit-checks">{/* policy / capability / binding */}</div>
<div className="execution-route">{/* substrate / effect / receipt */}</div>
<ol className="trace-list">{/* Resolve through Verify */}</ol>
<div className="verification-bar">{/* explicit verification result */}</div>
```

The scenario controls are native buttons with `aria-pressed`; decision changes
are announced through an `aria-live` status region.

### 4. Negative paths are executable tests, not visual convention

`tests/control-room-fixtures.test.ts:12`

```ts
test("only the authorized scenario may execute", () => {
  for (const scenario of scenarios) {
    assert.equal(scenario.execution.executed, scenario.status === "AUTHORIZED");
    if (scenario.status !== "AUTHORIZED") {
      assert.equal(scenario.execution.selected, "NONE");
      assert.equal(scenario.execution.receipt, "—");
    }
  }
});
```

Additional tests pin the four canonical states, require explicit verification
for Authorized, require hash mismatch and no effect for Stale, and limit
reasoning involvement to scenarios with unresolved semantics.

## UI description

No application screenshot is embedded in this handoff; this description is the
review artifact requested as the screenshot alternative.

### First viewport

- A near-black operational header identifies **XACT / Control Room**, the
  Commerce V1 simulation, and the principle **Capability ≠ Authority**.
- A persistent left rail switches between Authorized, Rejected, Escalated, and
  Stale. Status is encoded by both text and color.
- The main header names the request and gives the Commit decision a large,
  status-colored block separate from the request narrative.
- A dark request strip exposes intent, actor, target, and proposed effect before
  any resolution or authorization content.

### Evidence and consequence flow

- R, U, and C occupy adjacent bounded columns. Resolved facts carry reported,
  verified, or derived tags plus provenance.
- Evidence rows bind individual claims to sources and timestamps.
- O-Agent involvement is a subordinate evidence band. It reads **Not invoked**
  when U is empty and **Invoked for U1 only** when semantic interpretation is
  warranted.
- Commit is a separately bordered panel with policy, capability, state binding,
  base/current hashes, selected substrate, effect, and receipt.
- The trace runs through Resolve, Reason, Commit, Execute, and Verify. Blocked
  paths visibly stop at Commit; later nodes remain pending.
- A final verification bar distinguishes `VERIFIED`, `BLOCKED`, and `NOT_RUN`.

### State-specific visual proof

| State | Resolution/reasoning | Commit | Execution | Verification |
| --- | --- | --- | --- | --- |
| Authorized | `R3 · U0 · C1`; reasoning skipped | Policy, capability, and binding pass | WebMCP receipt present | Verified exact amount and rail |
| Rejected | Deterministic policy conflict; reasoning skipped | Requested amount exceeds limit | `NONE`; no receipt | Blocked; balance unchanged |
| Escalated | `U1`; O-Agent evidence returns to Xact | Human approval required | `NONE`; no receipt | Not run; no mutation |
| Stale | `U1`; O-Agent evidence returns against base state | Base/current hashes differ | `NONE`; candidate discarded | Blocked; fresh resolution required |

### Responsive and accessibility behavior

- Desktop uses a persistent scenario rail and dense inspector layout.
- Tablet collapses evidence and Commit into one column.
- Mobile converts the rail to a two-by-two scenario selector, stacks request and
  execution data, and turns the trace into a vertical sequence.
- Controls retain visible focus treatment; statuses do not rely on color alone;
  reduced-motion preferences disable transitions.

## Consequence-boundary test evidence

Fresh validation was run on 2026-08-27 against exact review commit `b763238`.

### `npm test`

Result: **PASS — 5 tests, 0 failures**

1. exposes exactly the four canonical Commit states;
2. only Authorized may execute;
3. Authorized requires an explicit verified effect and receipt;
4. Stale requires mismatched hashes, failed state binding, and no execution;
5. reasoning involvement is limited to unresolved semantics and does not
   authorize Escalated.

### `npm run lint`

Result: **PASS — 0 lint errors**

### `npm run build`

Result: **PASS — Vinext/Vite production build completed**

Build note: Vinext reports the root route as statically **Unknown** because its
current classifier cannot prove the absence of dynamic API usage. It explicitly
labels this as a static-analysis limitation; the build completes successfully.

### `npm audit --json`

Result: **PASS — 0 known vulnerabilities**

## Known limitations and deliberate deferrals

- Scenario data is immutable and bundled with the client.
- No `SimulationDecisionProvider` runtime is instantiated yet.
- No policy, evidence, verification, or execution provider is called.
- No effect can be caused from this application.
- WebMCP is displayed as the Authorized substrate but is not invoked.
- Trace timestamps and receipts are deterministic fixture data.
- The social-preview asset is branding, not proof of the rendered UI.
- Browser visual-regression tests and screenshot baselines are not part of
  Phase 1.

These are deliberate Phase 1 boundaries, not claims of completed Phase 2
behavior.

## Focused reviewer questions

1. Can a first-time reviewer see that reasoning is isolated to U rather than
   applied to every request?
2. Is O-Agent output unmistakably evidence rather than authorization?
3. Is Commit visibly independent of execution capability?
4. Do Rejected, Escalated, and Stale fail closed with no implied effect?
5. Does Stale make read-before-write revalidation understandable without
   implying proprietary implementation details?
6. Is WebMCP clearly below Commit as an execution substrate?
7. Does any copy, fixture, or visual object cross the public/private boundary?
8. Is the static fixture seam sufficient to proceed to mutable `ScenarioPack`
   and `SimulationDecisionProvider` work without redesigning the interface?

## Suggested review response

```text
Verdict: PASS | PASS WITH CHANGES | HOLD

Architecture:
- ...

Public boundary:
- ...

UX clarity:
- ...

Consequence-boundary invariants:
- ...

Required changes before Phase 2:
- ...
```
