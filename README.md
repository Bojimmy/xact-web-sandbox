# Xact Web Sandbox

**Xact — The Commit Layer for Agentic Web**

> *Reason when necessary. Execute Xactly.*

Xact Web Sandbox is a public-safe demonstration of a deterministic consequence boundary for agentic web execution.

🔗 **Live Demo:** [https://xact-web-sandbox.bojimmy.chatgpt.site](https://xact-web-sandbox.bojimmy.chatgpt.site)

---

## Core Principle

> **Reasoning may propose a consequence. Only Xact may commit one.**
>
> **WebMCP provides capability. Xact provides authority.**

WebMCP, DOM/browser control, Vision, native APIs, and future adapters provide execution capability. They do not provide authority.

---

## Canonical Flow

```
Request → Resolve → Reason only if unresolved → Re-entry → Validate → Authorize → Commit → Select execution substrate → Execute → Verify → Audit
```

---

## Key Demonstrations

- **Authorized Action:** Happy path execution where a consequence is authorized and safely committed.
- **Policy Rejection:** A requested consequence exceeds verified authority or policy, so Commit is rejected before execution.
- **Semantic Escalation:** Only genuinely unresolved meaning is sent to reasoning; structured evidence returns to Xact for independent re-entry and Commit.
- **Stale-State Rejection:** Guarding against race conditions and invalidated environmental state.

---

## Phase 2 — Mutable Scenario Engine

The Control Room runs a deterministic, public-safe Commerce V1 runtime:
- **State-Bound Candidate Resolution:** Change the request or simulated authority state, resolve candidates, and mutate active state.
- **Structured Evidence Re-entry:** Re-enter with structured evidence when uncertainty (`U`) requires interpretation, then request a new Commit decision.
- **Substrate Gating:** The happy path selects a simulated WebMCP substrate only after `AUTHORIZED`, applies a simulated effect, and verifies the observed result. Every non-authorized decision selects `NONE` and cannot execute.

> [!NOTE]
> The runtime contains explicit demonstration rules only. It does not implement, imitate, or expose production Xact resolution or authorization internals.

### Telemetry Panel
Live timings are measured from the public sandbox runtime for **Resolve**, **Policy**, **Commit**, optional **reasoning/re-entry**, and **Verification**. Historical Xact benchmark figures are displayed separately and are not presented as browser-sandbox measurements.

### Evolution Panel
Demonstrates a public-safe governed lifecycle:
```
OBSERVED → CANDIDATE → VALIDATED → APPROVED → ACTIVE
```
1. Complete an ambiguous first encounter.
2. Promote the resulting candidate through each explicit lifecycle state.
3. Replay the equivalent request — `ACTIVE` evidence moves the semantic field into resolved space (`R`) and leaves unresolved space (`U`) empty, while Commit remains independently required before execution.

---

## Project Documentation

For architectural specifications and boundary rules, refer to:
- [`PROJECT.md`](./PROJECT.md) — Project constitution, north star, and invariants.
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — System architecture and execution substrate contracts.
- [`PUBLIC_BOUNDARY.md`](./PUBLIC_BOUNDARY.md) — Public disclosure boundaries and safety rules.
- [`SCENARIOS.md`](./SCENARIOS.md) — Scenario catalog and test definitions.
- [`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md) — UI design tokens and component styling guidelines.
- [`WEBMCP_SPEC.md`](./WEBMCP_SPEC.md) — WebMCP integration specification.

---

## Development

### Prerequisites
- Node.js `>=22.13.0`

### Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

### Validation & Build

```bash
# Run tests
npm test

# Run linter
npm run lint

# Build production bundle
npm run build
```
