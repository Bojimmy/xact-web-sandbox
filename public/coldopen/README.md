# COLDOPEN — WebMCP Explainer Engine

Feed it any JSON, CSV, or plain text; it parses the data locally, storyboards it into an explainer video, and plays a narrated, caption-baked video cut — which you can export as a real `.webm`. A JSON-RPC 2.0 MCP server with 9 tools runs inside the tab, so the whole engine is drivable programmatically.

## Quick start

- Double-click `index.html` — no server, no build, no network calls. (Optional: `python3 -m http.server 8000` then open `http://localhost:8000`)
- Serve the folder over http (`python3 -m http.server 8000`) and the sample chips load **live from `data/`** — edit a fixture, click the chip again, and the cut reflects your edit. On `file://` the chips fall back to built-in copies; the console header shows the active feed mode.
- Click a sample chip (e.g. `coffee.json`, `streaming.csv`, `ocean.txt`) or hit `random` — the cut auto-plays with voice + captions.
- Drag any file from `data/` onto the window to ingest it.
- Toggle between **LONG FORM** (multi-chapter deep-dive cut with 12–14 scenes) and **SHORT FORM** (punchy ~35s cut) via the deck button or MCP `{ mode: 'long' | 'short' }`.
- Click `EXPORT .WEBM` to capture a real-time .webm that auto-downloads when the cut ends. Click again to cancel.

## Controls

| Key / Action | Effect |
|---|---|
| **Space** | Play / pause |
| **← / →** | Scrub 2s (Shift: 8s) |
| **Drag filmstrip** | Scrub anywhere |
| **M** | Toggle synthetic voiceover |
| **C** | Toggle burned-in captions |
| **LONG / SHORT FORM button** | Toggle cut length (Multi-Chapter Deep Dive vs Punchy Short) |
| **Speed button** | 0.6× → 1× → 1.5× → 2× |

## Scene Types & Visual Architecture

COLDOPEN renders fully kinetic canvas scenes with high-contrast typography (`Archivo` + `IBM Plex Mono`), motion eases, and film grain:

1. **`title` (Cold Open)**: Bold animated header with feed metadata.
2. **`chapter` (Act Intro)**: Cinematic dark-mode Act title cards (`ACT 01 · THE MACRO PICTURE`).
3. **`facts` (The Basics)**: Parameterized data rows with metric reveals.
4. **`grid` (KPI Matrix)**: 4-quadrant key performance indicator cards.
5. **`ranking` (Ranked Breakdown)**: Horizontal bar distribution chart with leader badges.
6. **`share` (Leader Share)**: Radial donut gauge with leader percentage callout.
7. **`compare` (Head-to-Head)**: Split-screen comparative analysis with spread multipliers.
8. **`trend` (The Curve)**: Multi-series line charts with peak tracking and live playhead dots.
9. **`milestones` (Phases / Clusters)**: Stepped timeline roadmap and node clusters.
10. **`lines` (Key Points)**: Numbered bullet card stack for textual takeaways.
11. **`quote` (Central Thesis)**: Oversized pull-quote presentation for strategic takeaways.
12. **`takeaway` (Conclusion)**: Bold through-line summary card.

## MCP tools (JSON-RPC 2.0)

| Tool | Purpose |
|---|---|
| `ingest_data` | Feed raw JSON/CSV/text → parse, normalize, storyboard (`mode: 'long' \| 'short'`) |
| `compose_video` | Re-cut the current dataset (`mode: 'long' \| 'short'`); optionally toggle voice/autoplay |
| `list_scenes` | Scene list with timings and narration |
| `get_state` | Playhead, duration, current scene, toggles, dataset summary |
| `play` / `pause` | Transport control |
| `seek` | Absolute time in seconds |
| `set_speed` | 0.6 / 1 / 1.5 / 2 |
| `export_webm` | Start a real-time canvas capture |

The server answers over `postMessage` (send a JSON-RPC 2.0 request object to this window) and via a DevTools shortcut:

```javascript
COLDOPEN.call('ingest_data', { raw: '{"items":[{"label":"A","value":10}]}', name: 'demo.json', mode: 'long' });
COLDOPEN.call('list_scenes').then(console.log);
```

Or type one-liners in the app's in-browser console (click any tool row to prefill).
