# ADR 0015 — Evidence-Grounded Run Explainer

**Status:** Accepted

**Depends on:** ADR 0004 (Authorization Artifact), ADR 0005/0007/0008 (substrate
independence), ADR 0011 (three-clock telemetry), ADR 0012 (flagship), ADR 0013
(Service Operations Console target). It changes **none** of them.

## Context

At the end of a judge's verified session, Xact should explain *what just
happened* — from the judge's own evidence, not from a prerecorded script. This
ADR defines that feature as a strictly downstream, evidence-grounded projection
and specifies the boundary so Codex can later wire "EXPLAIN THIS RUN" into the
end of the flagship without understanding the explainer internals.

## Reconciliation (E0)

The authoritative, already-available evidence sources are:

| Evidence | Source record |
|---|---|
| Run / session + trace | `SimulationSession` (`src/runtime/contracts.ts`) |
| Resolve (R/U/C) | `DecisionCandidate.resolution` → `resolved[]`, `unresolved[]`, `commitConstraints[]` |
| Commit + artifact | `DecisionResult` + `AuthorizationArtifact` |
| Execution + substrate | `ExecutionResult`, `selectedSubstrate`, `RuntimeTraceEvent` |
| Verification | `VerificationResult` |
| Telemetry (work clock) | `TelemetrySample[]`, `ConstructionRun.metrics` |
| Reasoning (reasoning clock) | `FlagshipLearningRun`, `ReasoningPathMetrics` |
| Governance lifecycle | `EvolutionSnapshot` / `LearningCandidate` |
| WebMCP capability manifest | `ServiceOperationsToolDescriptor[]` |
| Reference decision clock | `referenceXactBenchmark` (`REFERENCE_IMPLEMENTATION_NOT_SANDBOX`) |

**Flagged gap (do not modify mainline yet):** `SimulationSession` does not
retain the post-execution `ExecutionObservation` — it is a local in
`ServiceCreditEngine.executeAndVerify`. To represent `observations[]` and the
verified-consequence binding, the session should later retain that public-safe
observation. The explainer builder therefore accepts an optional
`observation` input and, when it is absent, emits **no** observation claim
(the correct, evidence-grounded behaviour). This is the smallest additional
public-safe field required; it is a Codex-side mainline change and is out of
scope for this side project.

## Decision

### Core architectural rule — strictly downstream

The explainer sits **after** `Verify`/`Audit`. It has **zero** authority over
R/U/C, escalation, artifact issuance, Commit, ACTIVATED, execution routing,
substrate selection, replay protection, or verification. It observes completed
evidence and projects it. No explainer type exposes `commit`, `execute`,
`authorize`, `activate`, `resolve`, or `artifact`-emitting methods.

### ExplainerManifest (E1)

`buildExplainerManifest(input)` deterministically projects the records above
into a typed `ExplainerManifest`. Every factual item carries a `ref` — a source
path back into the underlying record plus a truth label (`REFERENCE` / `LIVE` /
`SIMULATED`) and, for timing facts, a clock (`DECISION` / `WORK` / `REASONING`).
The manifest is a projection, **not** a new source of truth.

### Claim provenance

`ExplainerClaim { claimId, claimType, fact, sourceEventIds[], truth, clock?, verified }`.
`validateClaim(claim, manifest)` rejects any claim whose `sourceEventIds` do not
all resolve to manifest evidence, or that is not marked `verified`. `manifestClaims`
generates only grounded claims. The invariant is: **no narration claim exists
without a corresponding verified manifest field or audit event.**

### Three-clock model (preserved, never blended)

- **DECISION** — `REFERENCE_XACT_CORE_BENCHMARK` (≈9 µs reference; never measured here).
- **WORK** — `LIVE_SANDBOX_MEASUREMENT` (deterministic construction workload).
- **REASONING** — `LIVE_O_AGENT_MEASUREMENT` (or `SIMULATED_O_AGENT`; never relabeled live).

`deterministicallyResolvedOperations` is kept distinct from
`executedConstructionOperations`: the workload executes all 10,011 operations in
both runs; learning changes only how many require reasoning, not whether the work
was performed.

### ACTIVATED vs COMMIT (preserved in narration)

`authorityStatements(manifest)` emits precise language: ACTIVATED → *"can now
participate in deterministic resolution"* (never "can execute automatically");
COMMIT → *"authority established for this exact consequence."*

## Codex integration boundary (E7 target)

Codex imports **only** `src/explainer/index.ts`. The concrete contract is:

```ts
import {
  prepareRunExplainer, renderApprovedExplainer, publishExplainer,
  verifyRender, StoryboardPreview,
  EXPLAINER_RENDER_CAPABILITY, EXPLAINER_PUBLISH_CAPABILITY,
} from "./explainer";
```

```ts
// 1. READ — project the completed verified run (no consequence).
const prepared = prepareRunExplainer({
  runId, judgePrompt, requestedCapability, session,
  construction?, learning?, learningBaseline?, evolution?, cost?,
  webMcpTools?, observation?,           // observation optional — see flag below
});

// 2. PREVIEW — mount the storyboard; no render yet.
<StoryboardPreview storyboard={prepared.storyboard} />

// 3. RENDER — a consequence; requires its own Commit AuthorizationArtifact.
const rendered = await renderApprovedExplainer(prepared, renderArtifact);

// 4. Verify (optional) — bind the artifact to its inputs.
verifyRender(rendered, { explainerId: prepared.explainerId, runId, storyboard: prepared.storyboard, narration: prepared.narration });

// 5. PUBLISH — a DIFFERENT consequence; requires its own Commit AuthorizationArtifact.
publishExplainer(rendered, publishArtifact, destination);
```

No refactor of the flagship, no cross-cutting dependency, no change to Stage 2A
behaviour. The explainer adapts to Xact; Xact's authority model is unchanged.

**Flagged gap (do not modify mainline yet):** `SimulationSession` does not
retain the post-execution `ExecutionObservation` (it is a local in
`ServiceCreditEngine.executeAndVerify`). Until it is retained, pass `observation`
as an optional input to `prepareRunExplainer`; when absent the explainer emits
**no** observation claim (the correct evidence-grounded behaviour). This is the
single smallest additional public-safe field required from mainline.

## Narration script (E2)

`src/explainer/narration-script.ts` turns a manifest into a typed
`NarrationScript`. Two sentence kinds:

- **FACTUAL** — must carry ≥1 validated `ExplainerClaim`; its `sourceEventIds`
  all resolve to manifest evidence. No factual sentence without evidence.
- **TRANSITION** — restricted to a closed architectural library
  (`TRANSITION_LIBRARY`), never a fabricated measured event.

`generateScript(manifest)` is the deterministic path. `acceptNarrationDraft`
validates an optional O-Agent draft and rejects: no evidence, unsupported
evidence, relabeling REFERENCE/SIMULATED as LIVE, clock blending, automatic-
authority phrasing, and unknown transition keys. The script preserves
sentence-level provenance (claims + `sourceEventIds`) for later captions,
storyboard scenes, and an "inspect evidence" control.

## Storyboard (E3)

`src/explainer/storyboard.ts` turns a validated `NarrationScript + ExplainerManifest`
into a timed, renderer-independent `Storyboard`. Each card carries an id, title,
`startMs`/`durationMs`, narration sentence ids, evidence refs, visual type,
primary/supporting facts, a `LIVE`/`REFERENCE`/`SIMULATED` provenance badge, an
optional clock, and an optional transition.

- No card introduces a factual claim absent from E1/E2; derived facts (counts,
  lifecycle, checksum) carry the underlying evidence refs.
- The three clocks are emitted as **separate cards** (`CLOCK · DECISION
  (REFERENCE)` / `CLOCK · WORK (LIVE)` / `CLOCK · REASONING`), so the ~9 µs
  reference decision benchmark is never presented beside live numbers as if from
  the same measurement.
- The learning result keeps the exact measured delta (`30 → 4`, `−86.7%`, not a
  rounded `−87`) followed by the identical checksum.
- The refusal path renders `REQUEST UNDERSTOOD → CAPABILITY POSSIBLE →
  AUTHORITY NOT ESTABLISHED → CAPABILITY NOT ACTIVATED` with the exact phrase
  "Knowing how is not authority to act."
- Scenes for absent evidence are omitted, never filled.

`src/explainer/storyboard-preview.tsx` is a lightweight, renderer-independent
browser preview (advance/autoplay + provenance/clock badges) so the storyboard
can be watched before E4/E5 rendering exists.

## Renderer boundary (E4)

`src/explainer/renderer.ts` defines a narrow, replaceable `ExplainerRenderer`
contract: `render(request) → RenderResult`. A render result carries `renderId`,
`runId`, `explainerId`, status, renderer provenance (`MOCK`/`LIVE`), an
`artifactRef`, and a deterministic `fingerprint` over the exact render inputs —
enough to identify the output, observe completion, verify the artifact, and
associate it with the run and explainer.

The renderer receives only the downstream storyboard/narration and opaque ids,
never the run's session, decision, or authorization artifact, so it has no
authority over the run. `MockExplainerRenderer` is the clearly-labeled local
renderer (provenance `MOCK`, `mock://` artifact, zero bytes); `verifyRender`
rejects a `MOCK` render labeled `LIVE` ("do not fake a LIVE render"). Real
rendering (E5) and the WebMCP surface (E6) will traverse the normal Commit path.

## Real renderer (E5)

`src/explainer/html-renderer.ts` implements the first **real** renderer behind
the E4 boundary: `renderStoryboardHtml(storyboard)` deterministically serializes
a validated storyboard into a self-contained, autoplaying HTML slideshow — a
genuine, viewable explainer artifact (real bytes). `HtmlSlideshowRenderer`
wraps it with `kind: "BROWSER"`, `provenance: "LIVE"`, and returns verifiable
`RenderResult` evidence (`outputBytes > 0`, `html://` artifact ref, fingerprint
matching the inputs).

Every title, fact, badge, and clock is copied from the grounded storyboard and
HTML-escaped; nothing is invented. This is the honest browser-native first
artifact (MP4 is not the first milestone); FFmpeg / Remotion / cloud renderers
remain replaceable behind the same interface.

## WebMCP surface (E6)

`src/explainer/explainer-surface.ts` exposes exactly three high-level tools —
no low-level rendering functions:

- `prepare_run_explainer` — **READ** (no consequence): projects the run into a
  `PreparedExplainer` (manifest + script + storyboard + render plan).
- `render_approved_explainer` — **CONSEQUENCE** (`requiresCommit`): renders the
  artifact; requires a Commit `AuthorizationArtifact` with capability
  `explainer:render`.
- `publish_explainer` — a **different CONSEQUENCE** (`requiresCommit`): requires
  its own Commit `AuthorizationArtifact` with capability `explainer:publish`.

Permission to prepare does not grant render, and render does not grant publish.
Wrong-capability, expired, or nonce-less artifacts block without effect. The
surface never touches the underlying run.

## Consequences

- The explainer adapts to Xact; Xact's authority model is unchanged.
- A future renderer (`ExplainerRenderer`) and WebMCP surface
  (`prepare_run_explainer` / `render_approved_explainer`) are later slices
  (E4–E6) and remain behind the same downstream boundary; render and publish are
  distinct consequences with their own Commit.
- Public/private boundary: only public run/audit/telemetry evidence is projected;
  no chain-of-thought, no proprietary promotion/scoring internals.
