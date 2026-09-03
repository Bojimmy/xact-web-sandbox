# COLDOPEN — WebMCP Explainer Engine

> **ColdOpen is its own bird.** It is a standalone app, independent of the Xact
> WebMCP Foundry, and it gets its own open-source public repo. This file is the
> complete spec + handoff so a fresh workspace can pick it up with zero lost
> context.

---

## 1. What it is

A **self-contained, static, client-side explainer engine**: feed it any
JSON / CSV / plain text, and it parses locally, storyboards the data into a
narrated, caption-baked video cut, and plays it — exportable as a real `.webm`.

A **JSON-RPC 2.0 MCP server with 9 tools runs inside the tab**, so the entire
engine is drivable programmatically (`COLDOPEN.call(...)` + `postMessage`).

- **No server, no build, no network calls** for the core path.
- Single `index.html` (~148 KB, everything bundled) + a `data/` fixture folder.
- Canvas-rendered kinetic scenes; fonts **Archivo** + **IBM Plex Mono**.
- `.webm` export via in-browser `MediaRecorder` canvas capture.

## 2. Where it lives today (source of truth)

```
public/coldopen/
├── index.html          # the whole app (single file)
├── README.md           # user-facing quick start + controls + MCP table
├── COLDOPEN_SPEC.md    # this file
└── data/
    ├── coffee.json  streaming.csv  ev_adoption.csv  brownie_recipe.csv  ocean.txt
    ├── xact.json  xact.txt  xact_deck.json           # Xact demo deck
    └── xact_slides/  (slide_01..slide_09 .jpg/.jpeg)
```

- `dist/client/coldopen/` is a **build artifact**, not the source of truth.
- In the current repo, `app/page.tsx` redirects `/` → `/coldopen/index.html`
  (ColdOpen is the judge-facing splash that routes into the Foundry Boss). This
  coupling is **Xact-specific and must be removed** for the standalone repo.

## 3. Ingestion model (what the engine accepts)

The engine auto-detects and normalizes three input shapes, then maps them onto
the scene types below.

### JSON — a ranked metric set
```json
{ "title": "Global Coffee Production 2024", "unit": "million 60-kg bags",
  "items": [ { "label": "Brazil", "value": 66.3 }, { "label": "Vietnam", "value": 29.0 } ] }
```
`items[].value` must be numeric. Produces ranking/share/compare/trend scenes.

### CSV — a time series or category table
```csv
year,netflix,disney+,prime video
2019,167,0,112
```
First row = headers; first column = x-axis; remaining numeric columns = series.
Produces `trend` (multi-series line) scenes.

### Text — free prose → key points
Each non-empty line becomes a takeaway/bullet card (see `ocean.txt`, `xact.txt`).

### Deck — an explicit presentation (the richest mode)
```json
{ "kind": "presentation", "title": "...", "slides": [ ... ] }
```
Slide types observed in `xact_deck.json`:
- `{ "type": "slide", "title", "slug", "image", "narration" }`
- `{ "type": "diagram", "diagramType": "triage"|"pipeline"|"gates", "category", "title", "slug", "narration" }`
- `{ "type": "milestones", "header", "title", "slug", "steps": [{ "label", "desc" }], "narration" }`
- `{ "type": "takeaway", "title", "slug", "dur"?, "narration" }`

## 4. Scene types (12)

`title` (cold open) · `chapter` (act intro) · `facts` (metric rows) ·
`grid` (KPI matrix) · `ranking` (bar distribution) · `share` (donut gauge) ·
`compare` (head-to-head) · `trend` (line chart) · `milestones` (timeline) ·
`lines` (bullet stack) · `quote` (pull-quote) · `takeaway` (conclusion).

## 5. MCP surface (JSON-RPC 2.0)

| Tool | Purpose |
|---|---|
| `ingest_data` | Feed raw JSON/CSV/text → parse, normalize, storyboard (`mode: 'long'\|'short'`) |
| `compose_video` | Re-cut the current dataset (`mode`; optional voice/autoplay toggles) |
| `list_scenes` | Scene list with timings + narration |
| `get_state` | Playhead, duration, current scene, toggles, dataset summary |
| `play` / `pause` | Transport control |
| `seek` | Absolute seconds |
| `set_speed` | 0.6 / 1 / 1.5 / 2 |
| `export_webm` | Start/stop real-time canvas capture |

Programmatic entry points (all equivalent):
```javascript
COLDOPEN.call('ingest_data', { raw: '{"items":[{"label":"A","value":10}]}', name: 'demo.json', mode: 'long' });
COLDOPEN.call('list_scenes').then(console.log);
// or send a JSON-RPC 2.0 request object to this window via postMessage
```

## 6. Controls & modes

- **Space** play/pause · **←/→** scrub 2 s (Shift: 8 s) · drag filmstrip to scrub
- **M** voiceover on/off · **C** captions on/off
- **LONG FORM** (multi-chapter deep-dive, 12–14 scenes) / **SHORT FORM** (~35 s punchy)
- **Speed** 0.6× → 1× → 1.5× → 2×
- Drag any `data/` file onto the window to ingest
- **EXPORT .WEBM** captures the cut and auto-downloads at the end

Feed mode: over `http://` the sample chips load **live from `data/`**; on
`file://` they fall back to built-in copies (console header shows the mode).

## 7. The Xact relationship (and why it ships a Xact deck)

ColdOpen is product-independent, but it ships a **Xact demo deck**
(`xact.json`, `xact.txt`, `xact_deck.json`, `xact_slides/`). The numbers in that
deck are **real, measured** — they come from the Foundry's benchmark modules:

| Deck figure | Source (Foundry repo) |
|---|---|
| 109,500 decisions/s | `src/telemetry/reference-benchmark.ts` |
| 9 µs mean / 24.3 µs p99 | `src/telemetry/reference-benchmark.ts` |
| 30 → 4 O-Agent calls | `src/flagship/learning-run.ts` |
| −86.7 % reasoning reduction | `src/flagship/campaign-reality.ts` |

In the standalone repo these are just demo fixtures; keep them as an example of
the deck format, but **do not** make ColdOpen depend on the Foundry.

## 8. Constraints to preserve (don't break these)

1. Core path stays **self-contained** (no build/network required to ingest + play + export).
2. The **9-tool MCP surface** and `COLDOPEN.call()` / `postMessage` API stay stable.
3. **Real `.webm` export** stays (MediaRecorder canvas capture, not a fake file).
4. **LONG/SHORT form** toggle stays.
5. Drag-to-ingest + live `data/` feed over http stays.
6. No telemetry, no tracking, no network calls on the core path.

## 9. Known issues (real, found in the current tree)

- `data/brownie_recipe.csv` has a stray first line `data/brownie_recipe.csv`
  (a path accidentally serialized as a row) — breaks clean header detection.
- `data/xact.json` writes `"0-Agent"` (zero) instead of `"O-Agent"` in two
  call-count labels.
- The 148 KB single-file `index.html` is monolithic; if a build step is ever
  introduced, split it into modules (parser / storyboard / scene renderers /
  MCP server / export).

## 10. Polish roadmap (candidate — proposals, not requirements)

1. **Repo scaffolding** — `LICENSE` (MIT is already referenced in the bundle),
   root `README.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `.gitignore`.
2. **Fix the two data bugs** in §9.
3. **Decouple from Xact** — remove the `/foundry` redirect assumption; make the
   Xact deck an opt-in demo (`examples/xact/`).
4. **Ship as static** — GitHub Pages-ready (drop the folder, no build).
5. **Add MCP tools** — `list_datasets`, `get_scene(index)`, `set_mode`, `reset`.
6. **Accessibility** — full keyboard focus ring, captions-on default, reduced-motion.
7. **Responsive canvas** — mobile portrait letterboxing + touch scrub.
8. **Test harness** — the MCP tools are deterministic; add a small
   `COLDOPEN.call(...)` smoke suite (runs headless against the same `index.html`).
9. **New data shapes** — nested/grouped JSON, named CSV columns with units.
10. **Visual polish** — theme presets, grain/motion-ease knobs, color ramps.

## 11. Bootstrap prompt (paste into the new workspace)

> Continue **ColdOpen**, a standalone open-source web app (its own public repo,
> separate from the Xact Foundry). The app is a self-contained, client-side
> "WebMCP Explainer Engine": feed JSON/CSV/text → it storyboards and plays a
> narrated, caption-baked video cut, exportable as a real `.webm`, with a
> 9-tool JSON-RPC 2.0 MCP server running in-tab.
>
> Read `COLDOPEN_SPEC.md` (this file) first — it is the source of truth. The
> app lives in `public/coldopen/` (`index.html` + `data/`). Its invariants are
> in §8; known bugs in §9; roadmap in §10.
>
> Goal: turn it into a clean, shippable, MIT-licensed public repo and polish it
> — start with §9 (fix the two data bugs), then §10 items 1–4 (repo scaffolding,
> decouple from Xact, static deploy). Preserve every invariant in §8. Do not
> fabricate features or measurements; every claim in the UI/README must be real.
