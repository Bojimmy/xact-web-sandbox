"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { XactAgentLiaison, type ConverseAndRegisterResult, type XactTurn } from "../../src/flagship/xact-agent-liaison";
import { commitGatedExecute } from "../../src/flagship/foundry-build-register";
import { WebMCPDispatchRegistry } from "../../src/execution/webmcp-dispatch";
import { createMutationCommitEngine } from "../../src/flagship/foundry-mutation-commit";
import { FoundryRuntime, FoundryToolRegistry, type FoundryInvocationResult } from "../../src/flagship/foundry-runtime";
import type { FoundryActivity } from "../../src/flagship/foundry-liaison";
import type { FoundryWebMCPHost } from "../../src/flagship/webmcp-host-registration";

type ConversationTurn = XactTurn & { speaker?: "user" };

const EXAMPLES = [
  "Build a WebMCP tool that shows active users and open support requests",
  "Let support agents issue a service credit up to $25",
  "Find customers by email",
];

const CUSTOMER_DIRECTORY = Object.freeze([
  { customerId: "1042", email: "ada@example.com", name: "Ada Lovelace", status: "ACTIVE", openRequests: 2 },
  { customerId: "8821", email: "lin@example.com", name: "Lin Chen", status: "ACTIVE", openRequests: 1 },
]);

type AppliedEffect = { customerId?: string; tool: string; amount?: number; receipt: string };

function turnTone(kind: XactTurn["kind"]): "ok" | "warn" | "block" {
  if (kind === "REFUSED") return "block";
  if (kind === "CLARIFY" || kind === "PENDING_GOVERNANCE") return "warn";
  return "ok";
}

function browserWebMCPHost(): FoundryWebMCPHost {
  const context = (document as unknown as { modelContext?: FoundryWebMCPHost }).modelContext;
  if (!context) return { getTools: async () => [] };
  return {
    registerTool: context.registerTool?.bind(context),
    getTools: context.getTools.bind(context),
  };
}

export default function FoundryPage() {
  const [draft, setDraft] = useState("");
  const [reply, setReply] = useState("");
  const [pendingIntent, setPendingIntent] = useState<string>();
  const [pendingSubstrate, setPendingSubstrate] = useState("FOUNDRY_CUSTOMER_DIRECTORY");
  const [pendingMode, setPendingMode] = useState("ON_DEMAND_SNAPSHOT");
  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const [activity, setActivity] = useState<FoundryActivity[]>([]);
  const [result, setResult] = useState<ConverseAndRegisterResult>();
  const [shelf, setShelf] = useState<string[]>([]);
  const [invocationInput, setInvocationInput] = useState<Record<string, string>>({});
  const [actor, setActor] = useState("SERVICE_RECOVERY");
  const [confirmation, setConfirmation] = useState(false);
  const [invocation, setInvocation] = useState<FoundryInvocationResult>();
  const [invocationError, setInvocationError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const registry = useRef(new FoundryToolRegistry());
  const appliedEffects = useRef<AppliedEffect[]>([]);

  async function converse(intent: string, userText: string) {
    setBusy(true);
    setError(undefined);
    setTurns((current) => [...current, { kind: "UNDERSTAND", text: userText, speaker: "user" }]);
    try {
      const liaison = new XactAgentLiaison();
      const dispatches = new WebMCPDispatchRegistry();
      const next = await liaison.converseAndRegister(
        intent,
        {
          host: browserWebMCPHost(),
          executeFor: (tool) => tool.capabilityKind === "MUTATION"
            ? commitGatedExecute(dispatches.claim.bind(dispatches))
            : async () => { throw new Error("No approved read substrate is connected for this capability."); },
          onActivity: (event) => setActivity((current) => [...current, event]),
        },
        (turn) => setTurns((current) => [...current, turn]),
      );
      setResult(next);
      if (next.tool) {
        const builtTool = next.tool;
        registry.current.add(builtTool);
        setShelf(registry.current.list().map((tool) => tool.name));
        setInvocationInput(Object.fromEntries(builtTool.inputSchema.required.map((field) => [field, field === "email" ? "ada@example.com" : field === "amount" ? "25" : ""])));
        setActor("SERVICE_RECOVERY");
        setConfirmation(false);
        setInvocation(undefined);
        setInvocationError(undefined);
        setActivity((current) => [...current, { type: "REGISTER", label: "Foundry shelf", detail: `Added "${builtTool.name}" to the Foundry's internal tool shelf.`, status: "PASS" }]);
      }
      if (next.outcome === "NEEDS_INPUT" || next.outcome === "PENDING_GOVERNANCE") setPendingIntent(intent);
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

  async function supplyBuildRequirements() {
    if (!pendingIntent) return;
    // Explicit bounded re-entry: this supplies a public-safe read substrate and
    // supported reporting mode. It is not governance approval and cannot add an
    // arbitrary primitive or grant a mutation authority.
    if (pendingSubstrate !== "FOUNDRY_CUSTOMER_DIRECTORY" || pendingMode !== "ON_DEMAND_SNAPSHOT") return;
    await converse(
      "Build a WebMCP tool that shows active users and open support requests as an on-demand snapshot from the Foundry customer directory.",
      "Use the Foundry customer directory for an on-demand snapshot of active users and open support requests.",
    );
  }

  async function invokeTool() {
    if (!tool || !shelf.includes(tool.name)) return;
    setInvocationError(undefined);
    setInvocation(undefined);
    const input: Record<string, unknown> = {};
    for (const field of tool.inputSchema.required) {
      const value = invocationInput[field] ?? "";
      input[field] = field === "amount" ? Number(value) : value;
    }
    if (tool.capabilityKind === "MUTATION") {
      input.actor = actor;
      input.confirmation = confirmation;
    }
    try {
      const foundryRuntime = new FoundryRuntime(
        registry.current,
        (readTool, readInput) => {
          const values = readInput as Record<string, unknown>;
          if (readTool.name === "find_customer_by_email") {
            const email = typeof values.email === "string" ? values.email.trim().toLowerCase() : "";
            return CUSTOMER_DIRECTORY.find((customer) => customer.email === email) ?? { found: false, email };
          }
          if (readTool.name === "get_audit_history") {
            const customerId = typeof values.customerId === "string" ? values.customerId : undefined;
            return appliedEffects.current.filter((effect) => !customerId || effect.customerId === customerId);
          }
          if (readTool.name === "read_active_users_and_open_requests") {
            const activeUsers = CUSTOMER_DIRECTORY.filter((customer) => customer.status === "ACTIVE").length;
            const openSupportRequests = CUSTOMER_DIRECTORY.reduce((count, customer) => count + customer.openRequests, 0);
            return { activeUsers, openSupportRequests, source: "Foundry customer directory", mode: "ON_DEMAND_SNAPSHOT" };
          }
          throw new Error(`No approved public-safe read substrate is connected for ${readTool.name}.`);
        },
        createMutationCommitEngine(),
        (mutationTool, mutationInput, artifact) => {
          const values = mutationInput as Record<string, unknown>;
          const receipt = `foundry:${mutationTool.name}:${artifact.nonce}`;
          const applied = { customerId: typeof values.customerId === "string" ? values.customerId : undefined, tool: mutationTool.name, amount: typeof values.amount === "number" ? values.amount : undefined, receipt };
          appliedEffects.current.push(applied);
          return { ...applied, applied: true };
        },
      );
      const next = await foundryRuntime.invoke(tool.name, input);
      setInvocation(next);
    } catch (cause) {
      setInvocationError(cause instanceof Error ? cause.message : "Invocation failed.");
    }
  }

  const clarification = [...turns].reverse().find((turn) => turn.kind === "CLARIFY");
  const pending = result?.outcome === "PENDING_GOVERNANCE";
  const tool = result?.tool;

  return <main className="foundry">
    <header className="foundry-top"><Link href="/">XACT</Link><span>WEBMCP FOUNDRY</span><strong>The O-Agent understands. Xact decides what may become real.</strong></header>
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
        </> : pending ? <>
          <p className="foundry-empty">Give Xact the bounded information it needs. It re-enters the build only when that information maps to an approved read capability.</p>
          <label className="foundry-label" htmlFor="foundry-substrate">Approved read substrate</label>
          <select id="foundry-substrate" value={pendingSubstrate} onChange={(event) => setPendingSubstrate(event.target.value)}>
            <option value="FOUNDRY_CUSTOMER_DIRECTORY">Foundry customer directory (public-safe demo data)</option>
          </select>
          <label className="foundry-label" htmlFor="foundry-mode">Reporting mode</label>
          <select id="foundry-mode" value={pendingMode} onChange={(event) => setPendingMode(event.target.value)}>
            <option value="ON_DEMAND_SNAPSHOT">Current snapshot on demand</option>
            <option value="NOTIFICATION">Notifications when something changes — not yet governed</option>
          </select>
          {pendingMode === "NOTIFICATION" ? <p className="foundry-error">Notifications need a governed delivery primitive. Xact will not pretend the current read tool can send them.</p> : null}
          <button className="foundry-build" type="button" onClick={() => void supplyBuildRequirements()} disabled={busy || pendingMode !== "ON_DEMAND_SNAPSHOT"}>{busy ? "XACT IS BUILDING…" : "GIVE XACT WHAT IT NEEDS → BUILD"}</button>
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
        {pending ? <><h2>Understood · not yet governed</h2><span className="foundry-state">PENDING GOVERNANCE · NO TOOL CREATED</span><p>{result?.build?.reasoning?.claims.join(" ") || "The O-Agent supplied a structured interpretation."}</p><p className="foundry-pending">Xact cannot construct this capability until governance adds approved primitives and a reachable substrate.</p></> : tool ? <><h2>{tool.name}</h2><span className="foundry-state">{shelf.includes(tool.name) ? "ON FOUNDRY SHELF · INVOCABLE" : "COMPOSED DEFINITION"}</span><p>{tool.description}</p><dl><div><dt>Kind</dt><dd>{tool.capabilityKind}</dd></div><div><dt>Commit</dt><dd>{tool.requiresCommit ? "FRESH PER INVOCATION" : "NOT REQUIRED"}</dd></div></dl><h3>Input schema</h3><code>{tool.inputSchema.required.join(" · ") || "none"}</code><h3>Governed boundaries</h3><ul>{tool.boundaries.map((boundary) => <li key={boundary.primitive}>{boundary.primitive} — {boundary.description}</li>)}</ul><section className="foundry-invoke"><p className="foundry-kicker">RUN THIS TOOL</p>{tool.inputSchema.required.map((field) => <label key={field} className="foundry-label" htmlFor={`invoke-${field}`}>{field}<input id={`invoke-${field}`} type={field === "amount" ? "number" : field === "email" ? "email" : "text"} value={invocationInput[field] ?? ""} onChange={(event) => setInvocationInput((current) => ({ ...current, [field]: event.target.value }))} /></label>)}{tool.capabilityKind === "MUTATION" ? <><label className="foundry-label" htmlFor="invoke-actor">Actor<input id="invoke-actor" value={actor} onChange={(event) => setActor(event.target.value)} /></label><label className="foundry-check"><input type="checkbox" checked={confirmation} onChange={(event) => setConfirmation(event.target.checked)} /> I confirm this exact consequence</label></> : null}<button className="foundry-build" type="button" onClick={() => void invokeTool()}>{tool.capabilityKind === "MUTATION" ? "REQUEST FRESH COMMIT" : "RUN READ"}</button>{invocation ? <div className={`foundry-invocation ${invocation.status === "BLOCKED_NO_AUTHORITY" ? "is-blocked" : ""}`}><b>{invocation.status.replaceAll("_", " ")}</b>{invocation.result !== undefined ? <pre>{JSON.stringify(invocation.result, null, 2)}</pre> : null}{invocation.effectFingerprint ? <small>EFFECT · {invocation.effectFingerprint}</small> : null}<ul>{invocation.audit.map((line) => <li key={line}>{line}</li>)}</ul></div> : null}{invocationError ? <p className="foundry-error">{invocationError}</p> : null}</section><p className="foundry-pending">{result?.outcome === "WORKING_TOOL" ? "Browser WebMCP exposure is also registered and verified." : result?.outcome === "REGISTRATION_FAILED" ? "Browser exposure failed, but the tool remains hosted on the Foundry shelf." : "Browser exposure is optional; the Foundry shelf is the host."}</p></> : result?.build?.refusal ? <><h2>Construction blocked</h2><span className="foundry-state">NO TOOL CREATED</span><p>{result.build.refusal.reasons.join(" ")}</p><p className="foundry-pending">Implementation knowledge is not authority to construct this capability.</p></> : <><h2>No artifact yet</h2><p className="foundry-empty">A governed, inert definition appears here only when Xact actually composes one.</p></>}
      </section>
    </section>
  </main>;
}
