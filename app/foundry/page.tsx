"use client";

import { useState } from "react";
import Link from "next/link";
import { XactAgentLiaison, type XactTurn } from "../../src/flagship/xact-agent-liaison";
import type { FoundryActivity, FoundryBuildResult } from "../../src/flagship/foundry-liaison";

type ConversationTurn = XactTurn & { speaker?: "user" };

const EXAMPLES = [
  "Build a WebMCP tool that shows active users and open support requests",
  "Let support agents issue a service credit up to $25",
  "Find customers by email",
];

function turnTone(kind: XactTurn["kind"]): "ok" | "warn" | "block" {
  if (kind === "REFUSED") return "block";
  if (kind === "CLARIFY" || kind === "PENDING_GOVERNANCE") return "warn";
  return "ok";
}

export default function FoundryPage() {
  const [draft, setDraft] = useState("");
  const [reply, setReply] = useState("");
  const [pendingIntent, setPendingIntent] = useState<string>();
  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const [activity, setActivity] = useState<FoundryActivity[]>([]);
  const [result, setResult] = useState<FoundryBuildResult>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function converse(intent: string, userText: string) {
    setBusy(true);
    setError(undefined);
    setTurns((current) => [...current, { kind: "UNDERSTAND", text: userText, speaker: "user" }]);
    try {
      const liaison = new XactAgentLiaison();
      const next = await liaison.converse(intent);
      const nextResult = [...next].reverse().find((turn) => turn.result)?.result;
      setTurns((current) => [...current, ...next]);
      if (nextResult) {
        setResult(nextResult);
        setActivity(nextResult.activity);
      }
      const clarification = next.find((turn) => turn.kind === "CLARIFY");
      if (clarification) setPendingIntent(intent);
      else {
        setPendingIntent(undefined);
        setReply("");
      }
    } catch {
      setError("LIVE REASONING UNAVAILABLE — Xact did not substitute a simulated result.");
      setPendingIntent(undefined);
    } finally {
      setBusy(false);
    }
  }

  async function begin() {
    const intent = draft.trim();
    if (!intent) return;
    setDraft("");
    setTurns([]);
    setActivity([]);
    setResult(undefined);
    await converse(intent, intent);
  }

  async function answerClarification() {
    if (!pendingIntent || !reply.trim()) return;
    const answer = reply.trim();
    await converse(`${pendingIntent}\n${answer}`, answer);
  }

  const clarification = [...turns].reverse().find((turn) => turn.kind === "CLARIFY");
  const pending = result?.outcome === "PENDING_GOVERNANCE";

  return <main className="foundry">
    <header className="foundry-top"><Link href="/">XACT</Link><span>WEBMCP FOUNDRY</span><strong>The O-Agent understands. Xact decides what may become real.</strong></header>
    <section className="foundry-hero"><p>One conversation. Governed construction underneath.</p><h1>Ask the boss.<br />Xact keeps the consequences in check.</h1></section>
    <section className="foundry-grid">
      <section className="foundry-panel foundry-conversation">
        <p className="foundry-kicker">O-AGENT · XACT LIAISON</p><h2>What should your agent be able to do?</h2>
        <p className="foundry-empty">It interprets your request and asks for missing bounds. Xact—not the conversation—governs construction, authority, and Commit.</p>
        <div className="foundry-transcript" aria-live="polite">
          {!turns.length ? <p className="foundry-empty">Start with a real request. The liaison will distinguish what it understands, what it needs, and what Xact can actually construct.</p> : turns.map((turn, index) => <article className={`foundry-turn foundry-turn-${turnTone(turn.kind)}`} key={`${turn.kind}-${index}`}>
            <span>{turn.speaker === "user" ? "YOU" : `XACT · ${turn.kind.replaceAll("_", " ")}`}</span>
            <p>{turn.text}</p>
            {turn.resolved?.length ? <small>RESOLVED · {turn.resolved.join(" · ")}</small> : null}
            {turn.unresolved?.length ? <small>UNRESOLVED · {turn.unresolved.join(" · ")}</small> : null}
            {turn.questions?.length ? <ul>{turn.questions.map((question) => <li key={question}>{question}</li>)}</ul> : null}
          </article>)}</div>
        {pendingIntent && clarification ? <>
          <label className="foundry-label" htmlFor="foundry-clarification">Reply with the requested bounds</label>
          <textarea id="foundry-clarification" value={reply} onChange={(event) => setReply(event.target.value)} rows={3} placeholder={clarification.questions?.join(" ")} />
          <button className="foundry-build" type="button" onClick={() => void answerClarification()} disabled={busy || !reply.trim()}>{busy ? "XACT IS CHECKING…" : "CONTINUE WITH XACT"}</button>
        </> : <>
          <label className="foundry-label" htmlFor="foundry-intent">Your request</label>
          <textarea id="foundry-intent" value={draft} onChange={(event) => setDraft(event.target.value)} rows={4} placeholder="Describe a WebMCP capability…" />
          {!turns.length ? <div className="foundry-suggestions">{EXAMPLES.map((example) => <button key={example} type="button" onClick={() => setDraft(example)}>{example}</button>)}</div> : null}
          <button className="foundry-build" type="button" onClick={() => void begin()} disabled={busy || !draft.trim()}>{busy ? "XACT IS THINKING…" : "ASK XACT"}</button>
        </>}
        {error ? <p className="foundry-error">{error}</p> : null}
      </section>
      <section className="foundry-panel">
        <p className="foundry-kicker">XACT ACTIVITY</p><h2>What actually happened</h2>
        {!activity.length ? <p className="foundry-empty">Activity appears only after the liaison performs it. Conversation alone does not create a construction claim.</p> : <ol className="foundry-activity">{activity.map((event, index) => <li key={`${event.type}-${index}`} data-status={event.status}><span>{event.status === "PASS" ? "✓" : event.status === "BLOCK" ? "×" : event.status === "EVIDENCE" ? "◈" : "◉"}</span><div><b>{event.label}</b><p>{event.detail}</p></div></li>)}</ol>}
        <details><summary>INSPECT EVIDENCE</summary><p>O-Agent evidence appears only after the liaison emitted it. A provider interpretation is evidence, never authority.</p></details>
        <details><summary>INSPECT AUTHORITY</summary><p>Construction is not permission to use a tool. Mutations require a fresh Commit for each consequence.</p></details>
        <details><summary>INSPECT LEARNING</summary><p>Governance and learning review happen only after real host registration, observation, and verification.</p></details>
      </section>
      <section className="foundry-panel foundry-artifact">
        <p className="foundry-kicker">ARTIFACT</p>
        {pending ? <><h2>Understood · not yet governed</h2><span className="foundry-state">PENDING GOVERNANCE · NO TOOL CREATED</span><p>{result.reasoning?.claims.join(" ") || "The O-Agent supplied a structured interpretation."}</p><p className="foundry-pending">Xact cannot construct this capability until governance adds approved primitives and a reachable substrate.</p></> : result?.tool ? <><h2>{result.tool.name}</h2><span className="foundry-state">COMPOSED DEFINITION · NOT REGISTERED</span><p>{result.tool.description}</p><dl><div><dt>Kind</dt><dd>{result.tool.capabilityKind}</dd></div><div><dt>Commit</dt><dd>{result.tool.requiresCommit ? "REQUIRED" : "NOT REQUIRED"}</dd></div></dl><h3>Input schema</h3><code>{result.tool.inputSchema.required.join(" · ") || "none"}</code><h3>Governed boundaries</h3><ul>{result.tool.boundaries.map((boundary) => <li key={boundary.primitive}>{boundary.primitive} — {boundary.description}</li>)}</ul><p className="foundry-pending">REGISTER / OBSERVE / VERIFY remain pending until a public-safe WebMCP host performs them.</p></> : result?.refusal ? <><h2>Construction blocked</h2><span className="foundry-state">NO TOOL CREATED</span><p>{result.refusal.reasons.join(" ")}</p><p className="foundry-pending">Implementation knowledge is not authority to construct this capability.</p></> : <><h2>No artifact yet</h2><p className="foundry-empty">A governed, inert definition appears here only when Xact actually composes one.</p></>}
      </section>
    </section>
  </main>;
}
