"use client";

import { useState } from "react";
import Link from "next/link";
import { XactFoundryLiaison, type FoundryActivity, type FoundryBuildResult } from "../../src/flagship/foundry-liaison";

const SUGGESTIONS = [
  "Find customers by email",
  "Issue service credits up to $25",
  "Refund delivery fees up to $15",
  "Build a WebMCP tool that lets any agent delete any customer",
];

export default function FoundryPage() {
  const [intent, setIntent] = useState(SUGGESTIONS[1]);
  const [activity, setActivity] = useState<FoundryActivity[]>([]);
  const [result, setResult] = useState<FoundryBuildResult>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function build() {
    setBusy(true); setError(undefined); setResult(undefined); setActivity([]);
    try {
      const liaison = new XactFoundryLiaison();
      const next = await liaison.buildCapability(intent, (event) => setActivity((current) => [...current, event]));
      setResult(next);
    } catch {
      setError("LIVE REASONING UNAVAILABLE — Xact did not substitute a simulated result.");
    } finally { setBusy(false); }
  }

  return <main className="foundry">
    <header className="foundry-top"><Link href="/">XACT</Link><span>WEBMCP FOUNDRY</span><strong>Parallelize what is exact. Concentrate intelligence where exactness ends.</strong></header>
    <section className="foundry-hero"><p>Tell Xact what you want the web to do.</p><h1>A governed compiler from human intent to agent capability.</h1></section>
    <section className="foundry-grid">
      <section className="foundry-panel foundry-conversation">
        <p className="foundry-kicker">XACT AGENT</p><h2>What should your agent be able to do?</h2>
        <textarea value={intent} onChange={(event) => setIntent(event.target.value)} rows={5} placeholder="Describe a WebMCP capability…" />
        <div className="foundry-suggestions">{SUGGESTIONS.map((suggestion) => <button key={suggestion} type="button" onClick={() => setIntent(suggestion)}>{suggestion}</button>)}</div>
        <button className="foundry-build" type="button" onClick={() => void build()} disabled={busy || !intent.trim()}>{busy ? "XACT IS BUILDING…" : "BUILD WITH XACT"}</button>
        {error ? <p className="foundry-error">{error}</p> : null}
        {result?.refusal ? <div className="foundry-refusal"><b>IMPLEMENTATION POSSIBLE ✓</b><b>CAPABILITY UNDERSTOOD ✓</b><b>AUTHORITY NOT ESTABLISHED</b><b>CONSTRUCTION BLOCKED 🔒</b><p>Knowing how is not authority to act.</p></div> : null}
      </section>
      <section className="foundry-panel">
        <p className="foundry-kicker">BUILD ACTIVITY</p><h2>What Xact is doing</h2>
        {!activity.length ? <p className="foundry-empty">Submit an intent. Only actions Xact actually performs will appear here.</p> : <ol className="foundry-activity">{activity.map((event, index) => <li key={`${event.type}-${index}`} data-status={event.status}><span>{event.status === "PASS" ? "✓" : event.status === "BLOCK" ? "×" : event.status === "EVIDENCE" ? "◈" : "◉"}</span><div><b>{event.label}</b><p>{event.detail}</p></div></li>)}</ol>}
        <details><summary>INSPECT EVIDENCE</summary><p>Reasoning evidence is shown only if the liaison emitted an O-Agent event. Construction evidence is unavailable until a real host registers, observes, and verifies the definition.</p></details>
        <details><summary>INSPECT AUTHORITY</summary><p>Composing a definition is not authority to use it. Mutation tools require a fresh Commit for every consequence.</p></details>
        <details><summary>INSPECT LEARNING</summary><p>Learning review opens only after verified registration and observation.</p></details>
      </section>
      <section className="foundry-panel foundry-artifact">
        <p className="foundry-kicker">ARTIFACT</p><h2>{result?.tool ? result.tool.name : "No tool definition"}</h2>
        {result?.tool ? <><span className="foundry-state">COMPOSED DEFINITION · NOT REGISTERED</span><p>{result.tool.description}</p><dl><div><dt>Kind</dt><dd>{result.tool.capabilityKind}</dd></div><div><dt>Commit</dt><dd>{result.tool.requiresCommit ? "REQUIRED" : "NOT REQUIRED"}</dd></div></dl><h3>Input schema</h3><code>{result.tool.inputSchema.required.join(" · ") || "none"}</code><h3>Governed boundaries</h3><ul>{result.tool.boundaries.map((boundary) => <li key={boundary.primitive}>{boundary.primitive} — {boundary.description}</li>)}</ul><p className="foundry-pending">REGISTER / OBSERVE / VERIFY remain pending until a public-safe WebMCP host performs them.</p></> : <p className="foundry-empty">A composed definition will appear here. A blocked request never creates one.</p>}
      </section>
    </section>
  </main>;
}
