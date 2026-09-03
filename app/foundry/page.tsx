"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { XactAgentLiaison, type ConverseAndRegisterResult, type XactTurn } from "../../src/flagship/xact-agent-liaison";
import { commitGatedExecute } from "../../src/flagship/foundry-build-register";
import { WebMCPDispatchRegistry } from "../../src/execution/webmcp-dispatch";
import { createMutationCommitEngine } from "../../src/flagship/foundry-mutation-commit";
import { FoundryRuntime, FoundryToolRegistry, type FoundryInvocationResult } from "../../src/flagship/foundry-runtime";
import { preparePromotionalEmailCampaign, type CampaignPreparation } from "../../src/flagship/promotional-campaign-nodes";
import { campaignBriefFromProfile } from "../../src/flagship/foundry-profile";
import { readCampaignDashboard, readCustomerHealth, readEmployeeDirectory, readOperationsReport, readSupportQueue, readWorkOrderQueue, type BusinessWorkspaceResult } from "../../src/flagship/business-workspace";
import { readAbsorbedFoundryTool } from "../../src/flagship/foundry-read-substrate";
import type { FoundryActivity } from "../../src/flagship/foundry-liaison";
import type { FoundryWebMCPHost } from "../../src/flagship/webmcp-host-registration";
import type { WebMCPToolDefinition } from "../../src/flagship/webmcp-tool-builder";
import { useFoundrySession } from "./foundry-session";
import { FoundryRunExplainer } from "./foundry-run-explainer";

type ConversationTurn = XactTurn & { speaker?: "user" };

const EXAMPLES = [
  "Build a WebMCP tool that shows active users and open support requests",
  "Build a WebMCP tool to read the field work-order queue",
  "Build a WebMCP tool to read the employee organization directory and division headcount",
  "Build a WebMCP tool for a weekly business operations report",
  "Build a weekly promotional email campaign with personalized drafts",
  "Let support agents issue a service credit up to $25",
  "Find customers by email",
];

const CUSTOMER_DIRECTORY = Object.freeze([
  { customerId: "1042", email: "ada@example.com", name: "Ada Lovelace", status: "ACTIVE", openRequests: 2 },
  { customerId: "8821", email: "lin@example.com", name: "Lin Chen", status: "ACTIVE", openRequests: 1 },
]);

function isCampaignPreparation(value: unknown): value is CampaignPreparation {
  return Boolean(value && typeof value === "object" && (value as { status?: unknown }).status === "DRAFTS_PREPARED_NO_SEND_AUTHORITY");
}

function isBusinessWorkspaceResult(value: unknown): value is BusinessWorkspaceResult {
  return Boolean(value && typeof value === "object" && (value as { source?: unknown }).source === "FOUNDRY_PUBLIC_SAFE_BUSINESS_WORKSPACE");
}

type AppliedEffect = { customerId?: string; tool: string; amount?: number; receipt: string; event?: string; recordedAt?: string };

const SEEDED_AUDIT_HISTORY: readonly AppliedEffect[] = Object.freeze([
  { customerId: "1042", tool: "support_case_review", event: "Late-delivery case reviewed and resolved", receipt: "demo-audit:1042:case-118", recordedAt: "2026-08-25T14:30:00Z" },
  { customerId: "1042", tool: "promotion_eligibility", event: "Eligible for weekly active-customer promotion", receipt: "demo-audit:1042:promo-042", recordedAt: "2026-08-26T09:15:00Z" },
  { customerId: "1042", tool: "preference_check", event: "Email preference confirmed for promotional drafts", receipt: "demo-audit:1042:pref-009", recordedAt: "2026-08-27T11:05:00Z" },
]);

function turnTone(kind: XactTurn["kind"]): "ok" | "warn" | "block" {
  if (kind === "REFUSED") return "block";
  if (kind === "CLARIFY" || kind === "PENDING_GOVERNANCE" || kind === "UNAVAILABLE") return "warn";
  return "ok";
}

function browserWebMCPHost(): FoundryWebMCPHost | undefined {
  const context = (document as unknown as { modelContext?: FoundryWebMCPHost }).modelContext;
  // Browser exposure is optional. Do not fabricate a host when this browser
  // does not implement WebMCP: the Foundry shelf remains the real host and
  // must not report a registration failure it never attempted.
  if (!context || typeof context.registerTool !== "function" || typeof context.getTools !== "function") return undefined;
  return {
    registerTool: context.registerTool?.bind(context),
    getTools: context.getTools.bind(context),
  };
}

export default function FoundryPage() {
  const searchParams = useSearchParams();
  const { tools, addTool, clearTools, profile, updateProfile } = useFoundrySession();
  const [draft, setDraft] = useState("");
  const [pendingIntent, setPendingIntent] = useState<string>();
  const [pendingSubstrate, setPendingSubstrate] = useState("FOUNDRY_CUSTOMER_DIRECTORY");
  const [pendingMode, setPendingMode] = useState("ON_DEMAND_SNAPSHOT");
  const [turns, setTurns] = useState<ConversationTurn[]>([]);
  const [activity, setActivity] = useState<FoundryActivity[]>([]);
  const [result, setResult] = useState<ConverseAndRegisterResult>();
  const [existingToolOffer, setExistingToolOffer] = useState<WebMCPToolDefinition>();
  const [selectedExistingTool, setSelectedExistingTool] = useState<WebMCPToolDefinition>();
  const [invocationInput, setInvocationInput] = useState<Record<string, string>>({});
  const [actor, setActor] = useState("SERVICE_RECOVERY");
  const [confirmation, setConfirmation] = useState(false);
  const [invocation, setInvocation] = useState<FoundryInvocationResult>();
  const [invocationError, setInvocationError] = useState<string>();
  const [selectedCampaignRecipientId, setSelectedCampaignRecipientId] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [buildElapsedMs, setBuildElapsedMs] = useState<number>();
  const [liveReasoningBudget, setLiveReasoningBudget] = useState<{ maximum: number; used: number; remaining: number }>();
  const [error, setError] = useState<string>();
  const appliedEffects = useRef<AppliedEffect[]>([...SEEDED_AUDIT_HISTORY]);
  const buildStartedAt = useRef<number | undefined>(undefined);
  const catalogRequestHandled = useRef<string | undefined>(undefined);
  const beginIntentRef = useRef<(intent: string) => Promise<void>>(async () => undefined);

  useEffect(() => {
    if (busy) {
      buildStartedAt.current = performance.now();
      return;
    }
    if (buildStartedAt.current !== undefined) {
      setBuildElapsedMs(Math.max(0.1, performance.now() - buildStartedAt.current));
      buildStartedAt.current = undefined;
    }
  }, [busy]);

  async function refreshLiveReasoningBudget() {
    try {
      const response = await fetch("/api/o-agent/budget", { cache: "no-store" });
      if (!response.ok) return;
      const next = await response.json() as { maximum?: unknown; used?: unknown; remaining?: unknown };
      if (typeof next.maximum === "number" && typeof next.used === "number" && typeof next.remaining === "number") {
        setLiveReasoningBudget({ maximum: next.maximum, used: next.used, remaining: next.remaining });
      }
    } catch {
      // The server remains the authority. A missing display counter must not
      // weaken the route's identity-bound quota check.
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void refreshLiveReasoningBudget(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function selectTool(nextTool: WebMCPToolDefinition) {
    setInvocationInput(Object.fromEntries(nextTool.inputSchema.required.map((field) => [field, field === "email" ? "ada@example.com" : field === "amount" ? "25" : field === "customerId" ? "1042" : ""])));
    setActor(nextTool.boundaries.find((boundary) => boundary.primitive === "ACTOR_BINDING")?.actor ?? "SERVICE_RECOVERY");
    setConfirmation(false);
    setInvocation(undefined);
    setInvocationError(undefined);
  }

  async function converse(intent: string, userText: string) {
    setBusy(true);
    setBuildElapsedMs(undefined);
    setError(undefined);
    setExistingToolOffer(undefined);
    setSelectedExistingTool(undefined);
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
        addTool(builtTool);
        selectTool(builtTool);
        setActivity((current) => [...current, { type: "REGISTER", label: "Foundry shelf", detail: `Added "${builtTool.name}" to the Foundry's internal tool shelf.`, status: "PASS" }]);
      }
      if (next.outcome === "NEEDS_INPUT" || next.outcome === "PENDING_GOVERNANCE") setPendingIntent(intent);
      else setPendingIntent(undefined);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "";
      const unavailable = message.includes("(429)")
        ? "LIVE BOSS REASONING ALLOWANCE EXHAUSTED — deterministic tools remain available, but Xact will not substitute a simulated answer."
        : "LIVE REASONING UNAVAILABLE — the Boss could not complete this interpretation. Xact did not substitute a simulated answer or claim a tool was built.";
      setError(unavailable);
      setTurns((current) => [...current, { kind: "UNAVAILABLE", text: unavailable }]);
      setPendingIntent(undefined);
    } finally {
      setBusy(false);
      void refreshLiveReasoningBudget();
    }
  }

  async function beginIntent(intent: string) {
    if (!intent) return;
    setActivity([]);
    setResult(undefined);
    const existing = new XactAgentLiaison().findExistingTool(intent, tools);
    if (existing) {
      setPendingIntent(undefined);
      setExistingToolOffer(existing);
      setSelectedExistingTool(undefined);
      setTurns((current) => [...current,
        { kind: "UNDERSTAND", text: intent, speaker: "user" },
        { kind: "UNDERSTAND", text: `I already built and verified "${existing.name}" on the Foundry shelf. Do you want to use that existing governed tool instead of rebuilding it?` },
      ]);
      return;
    }
    await converse(intent, intent);
  }

  useEffect(() => {
    beginIntentRef.current = beginIntent;
  });

  useEffect(() => {
    const request = searchParams.get("request")?.trim();
    if (!request || catalogRequestHandled.current === request) return;
    catalogRequestHandled.current = request;
    window.history.replaceState({}, "", "/foundry");
    void beginIntentRef.current(request);
  }, [searchParams]);

  async function begin() {
    const intent = draft.trim();
    if (!intent) return;
    setDraft("");
    await beginIntent(intent);
  }

  function useExistingTool() {
    if (!existingToolOffer) return;
    const existing = existingToolOffer;
    setExistingToolOffer(undefined);
    setSelectedExistingTool(existing);
    selectTool(existing);
    setTurns((current) => [...current, { kind: "UNDERSTAND", text: `Using the existing "${existing.name}" tool. It remains governed by its original contract.` }]);
  }

  async function answerClarification() {
    if (!pendingIntent || !draft.trim()) return;
    const answer = draft.trim();
    setDraft("");
    await converse(`${pendingIntent}\n${answer}`, answer);
  }

  function resetConversation() {
    setDraft("");
    setPendingIntent(undefined);
    setTurns([]);
    setActivity([]);
    setResult(undefined);
    setExistingToolOffer(undefined);
    setSelectedExistingTool(undefined);
    setInvocation(undefined);
    setInvocationError(undefined);
    setBuildElapsedMs(undefined);
    setError(undefined);
  }

  function clearDemoShelf() {
    clearTools();
    resetConversation();
    setSelectedCampaignRecipientId(undefined);
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
      const value = (invocationInput[field] ?? "").trim();
      if (!value) {
        setInvocationError(`Required input: ${field}.`);
        return;
      }
      input[field] = field === "amount" ? Number(value) : value;
    }
    if (tool.capabilityKind === "MUTATION") {
      input.actor = actor;
      input.confirmation = confirmation;
    }
    try {
      const registry = new FoundryToolRegistry();
      for (const shelfTool of tools) registry.add(shelfTool);
      // The selected definition is added last so an invocation always uses the
      // exact governed variant the Boss just constructed or reused.
      registry.add(tool);
      const foundryRuntime = new FoundryRuntime(
        registry,
        (readTool, readInput) => {
          const values = readInput as Record<string, unknown>;
          const absorbed = readAbsorbedFoundryTool(readTool.name, values);
          if (absorbed) return absorbed;
          if (readTool.name === "find_customer_by_email") {
            const email = typeof values.email === "string" ? values.email.trim().toLowerCase() : "";
            return CUSTOMER_DIRECTORY.find((customer) => customer.email === email) ?? { found: false, email };
          }
          if (readTool.name === "get_audit_history") {
            const customerId = typeof values.customerId === "string" ? values.customerId.trim() : "";
            if (!customerId) throw new Error("Missing required input: customerId.");
            return appliedEffects.current.filter((effect) => effect.customerId === customerId);
          }
          if (readTool.name === "read_active_users_and_open_requests") {
            const activeUsers = CUSTOMER_DIRECTORY.filter((customer) => customer.status === "ACTIVE").length;
            const openSupportRequests = CUSTOMER_DIRECTORY.reduce((count, customer) => count + customer.openRequests, 0);
            return { activeUsers, openSupportRequests, source: "Foundry customer directory", mode: "ON_DEMAND_SNAPSHOT" };
          }
          if (readTool.name === "get_work_order_queue") return readWorkOrderQueue();
          if (readTool.name === "get_employee_directory") return readEmployeeDirectory();
          if (readTool.name === "get_customer_support_queue") return readSupportQueue();
          if (readTool.name === "get_customer_health_summary") {
            const customerId = typeof values.customerId === "string" ? values.customerId.trim() : "";
            if (!customerId) throw new Error("Missing required input: customerId.");
            return readCustomerHealth(customerId);
          }
          if (readTool.name === "get_business_operations_report") return readOperationsReport();
          if (readTool.name === "get_campaign_dashboard") return readCampaignDashboard();
          if (readTool.name === "prepare_weekly_promotional_email_campaign") {
            return preparePromotionalEmailCampaign(campaignBriefFromProfile(profile));
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
  const tool = selectedExistingTool ?? result?.tool;
  const shelf = tools.map((shelfTool) => shelfTool.name);
  const campaignPreparation = isCampaignPreparation(invocation?.result) ? invocation.result : undefined;
  const selectedCampaignRecipient = campaignPreparation?.recipients.find((recipient) => recipient.customerId === selectedCampaignRecipientId) ?? campaignPreparation?.recipients[0];
  const businessWorkspace = isBusinessWorkspaceResult(invocation?.result) ? invocation.result : undefined;

  return <main className="foundry">
    <header className="foundry-top"><Link href="/" aria-label="Xact Foundry home"><img className="foundry-logo" src="/xact-foundry-logo.webp" alt="Xact Foundry" /></Link><span>WEBMCP FOUNDRY</span><nav className="foundry-tabs" aria-label="Foundry pages"><Link href="/foundry" aria-current="page">BOSS · BUILD A TOOL</Link><Link href="/foundry/catalog">XACT BUILD &amp; EXAMPLES</Link></nav><strong>The O-Agent understands. Xact decides what may become real.</strong></header>
    <section className="foundry-grid">
      <section className="foundry-panel foundry-conversation">
        <p className="foundry-kicker">BOSS CHAT · O-AGENT LIAISON</p><h2>Tell the Boss what tool you need.</h2>
        <p className="foundry-empty">The Boss understands your request, asks for missing bounds, and explains refusals. Xact—not chat—governs construction, authority, and Commit.</p>
        <p className="foundry-live-budget" aria-live="polite">{liveReasoningBudget ? <>LIVE BOSS REASONING · <b>{liveReasoningBudget.remaining} / {liveReasoningBudget.maximum} AVAILABLE</b><span>Identity-bound judge allowance. Consumed only when the Boss actually reasons.</span></> : "LIVE BOSS REASONING · CHECKING JUDGE ALLOWANCE…"}</p>
        <div className="foundry-transcript" aria-live="polite">
          {!turns.length ? <p className="foundry-empty">Describe the WebMCP tool you want. The Boss will distinguish what it understands, what it needs, and what Xact can actually construct.</p> : turns.map((turn, index) => <article className={`foundry-turn foundry-turn-${turnTone(turn.kind)}`} key={`${turn.kind}-${index}`}>
            <span>{turn.speaker === "user" ? "YOU" : `XACT · ${turn.kind.replaceAll("_", " ")}`}</span>
            <p>{turn.text}</p>
            {turn.resolved?.length ? <small>RESOLVED · {turn.resolved.join(" · ")}</small> : null}
            {turn.unresolved?.length ? <small>UNRESOLVED · {turn.unresolved.join(" · ")}</small> : null}
            {turn.questions?.length ? <ul>{turn.questions.map((question) => <li key={question}>{question}</li>)}</ul> : null}
          </article>)}</div>
        {pending ? <>
          <p className="foundry-empty">The Boss can keep explaining the boundary. Xact re-enters the build only when the answer maps to an approved capability and substrate.</p>
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
        </> : null}
        {existingToolOffer ? <section className="foundry-existing-tool">
          <span className="foundry-state">ALREADY ON THE FOUNDRY SHELF</span>
          <p><b>{existingToolOffer.name}</b> is already registered and verified. Reuse does not rebuild the tool or invoke reasoning.</p>
          <button className="foundry-build" type="button" onClick={useExistingTool}>USE EXISTING TOOL</button>
          <button className="foundry-new-conversation" type="button" onClick={() => setExistingToolOffer(undefined)}>REQUEST A DIFFERENT TOOL</button>
        </section> : null}
        <section className="foundry-chat-composer" aria-label="Message the Boss">
          <label className="foundry-label" htmlFor="foundry-intent">{pendingIntent ? "Reply to the Boss" : "Message the Boss"}</label>
          <textarea id="foundry-intent" value={draft} onChange={(event) => setDraft(event.target.value)} rows={4} placeholder={clarification?.questions?.join(" ") ?? (pending ? "Ask why this boundary exists, or supply a governed requirement…" : "Describe the WebMCP tool you want to build…")} />
          {!turns.length ? <div className="foundry-suggestions">{EXAMPLES.map((example) => <button key={example} type="button" onClick={() => setDraft(example)}>{example}</button>)}</div> : null}
          <button className="foundry-build" type="button" onClick={() => void (pendingIntent ? answerClarification() : begin())} disabled={busy || !draft.trim() || Boolean(existingToolOffer)}>{busy ? "BOSS IS CHECKING…" : pendingIntent ? "SEND ANSWER TO BOSS" : "SEND TO BOSS"}</button>
          {turns.length ? <button className="foundry-new-conversation" type="button" onClick={resetConversation}>NEW TOOL REQUEST</button> : null}
          {tools.length ? <button className="foundry-new-conversation foundry-clear-shelf" type="button" onClick={clearDemoShelf}>START CLEAN DEMO · CLEAR TOOL SHELF</button> : null}
        </section>
        {buildElapsedMs !== undefined ? <div className="foundry-build-time"><b>{tool ? `BROWSER RUN TIME · ${buildElapsedMs.toFixed(1)}ms` : `BROWSER RESPONSE · ${buildElapsedMs.toFixed(1)}ms`}</b><small>Measured from SEND TO BOSS until this browser completed the response. This is not a microsecond X-Node benchmark.</small></div> : null}
        <section className="foundry-tool-guide" aria-labelledby="foundry-tool-guide-heading">
          <p className="foundry-kicker">WEBMCP TOOL PATH</p>
          <h2 id="foundry-tool-guide-heading">How this WebMCP tool works</h2>
          <ol>
            <li><b>1 · ASK</b><span>Describe a business tool, choose a suggested request, or extend one on the shelf.</span></li>
            <li><b>2 · UNDERSTAND</b><span>The Boss interprets the request and asks for any missing governed bounds.</span></li>
            <li><b>3 · BUILD</b><span>X-Nodes compose a deterministic, governed tool definition from approved primitives.</span></li>
            <li><b>4 · USE</b><span>Reads use an approved substrate. Any real-world consequence needs its own fresh Xact Commit.</span></li>
          </ol>
          <p className="foundry-tool-guide-note">A fast build is still a live build. The activity and artifact columns show exactly what occurred in this run.</p>
          {tool ? <p className="foundry-tool-guide-note">This run assembled <b>{result?.build?.constructionNodes?.length ?? 0} recorded X-Node construction steps</b>. Clear the in-memory shelf to demonstrate a fresh build; it does not delete external data.</p> : null}
        </section>
        {error ? <p className="foundry-error">{error}</p> : null}
      </section>
      <section className="foundry-panel">
        <p className="foundry-kicker">XACT ACTIVITY</p><h2>What actually happened</h2>
        {!activity.length ? <p className="foundry-empty">Activity appears only after the liaison performs it. Conversation alone does not create a construction claim.</p> : <ol className="foundry-activity">{activity.map((event, index) => <li key={`${event.type}-${index}`} data-status={event.status}><span>{event.status === "PASS" ? "✓" : event.status === "BLOCK" ? "×" : event.status === "EVIDENCE" ? "◈" : "◉"}</span><div><b>{event.label}</b><p>{event.detail}</p></div></li>)}</ol>}
        <details><summary>INSPECT EVIDENCE</summary>{tool?.name === "prepare_weekly_promotional_email_campaign" ? campaignPreparation ? <><p>PREPARED FROM APPROVED PUBLIC-SAFE CAMPAIGN SUBSTRATE</p><p>{campaignPreparation.recipients.length} active-customer recipients were selected and personalized drafts were prepared. No delivery receipt exists yet.</p></> : <p>WAITING FOR CAMPAIGN PREPARATION — there is no recipient selection or draft evidence until you run this tool.</p> : <p>O-Agent evidence appears only after the liaison emitted it. A provider interpretation is evidence, never authority.</p>}</details>
        <details><summary>INSPECT AUTHORITY</summary>{tool?.name === "prepare_weekly_promotional_email_campaign" ? <><p>PREPARATION AUTHORITY ONLY · NO SEND COMMIT</p><p>The current tool can read the approved campaign substrate and prepare drafts. It has not requested, received, or consumed authority to email any recipient.</p></> : <p>Construction is not permission to use a tool. Mutations require a fresh Commit for each consequence.</p>}</details>
        <details><summary>INSPECT LEARNING</summary>{tool?.name === "prepare_weekly_promotional_email_campaign" ? <><p>WAITING FOR VERIFIED DELIVERY OUTCOME</p><p>Prepared drafts are not outcome evidence. Learning can begin only after a separately authorized email batch produces delivery receipts and those receipts are verified.</p></> : <p>Governance and learning review happen only after real host registration, observation, and verification.</p>}</details>
      </section>
      <section className="foundry-panel foundry-artifact">
        <p className="foundry-kicker">ARTIFACT</p>
        {pending ? <>
          <h2>Understood · not yet governed</h2>
          <span className="foundry-state">PENDING GOVERNANCE · NO TOOL CREATED</span>
          <p>{result?.build?.reasoning?.claims.join(" ") || "The O-Agent supplied a structured interpretation."}</p>
          <p className="foundry-pending">Xact cannot construct this capability until governance adds approved primitives and a reachable substrate.</p>
        </> : tool ? <>
          <h2>{tool.name}</h2>
          <span className="foundry-state">{shelf.includes(tool.name) ? "ON FOUNDRY SHELF · INVOCABLE" : "COMPOSED DEFINITION"}</span>
          <p>{tool.description}</p>
          <dl><div><dt>Kind</dt><dd>{tool.capabilityKind}</dd></div><div><dt>Commit</dt><dd>{tool.requiresCommit ? "FRESH PER INVOCATION" : "NOT REQUIRED"}</dd></div></dl>
          <h3>Input schema</h3><code>{tool.inputSchema.required.join(" · ") || "none"}</code>
          <h3>Governed boundaries</h3><ul>{tool.boundaries.map((boundary) => <li key={boundary.primitive}>{boundary.primitive} — {boundary.description}</li>)}</ul>
          {result?.build?.constructionNodes ? <section className="foundry-tool-construction"><span className="foundry-state">X-NODES BUILT THIS TOOL · {result.build.constructionNodes.length}/{result.build.constructionNodes.length} COMPLETE</span><ol>{result.build.constructionNodes.map((node) => <li key={node.id}><span>✓</span>{node.label}</li>)}</ol></section> : null}
          <section className="foundry-invoke">
            <p className="foundry-kicker">RUN THIS TOOL</p>
            {tool.inputSchema.required.map((field) => <label key={field} className="foundry-label" htmlFor={`invoke-${field}`}>{field}<input id={`invoke-${field}`} type={field === "amount" ? "number" : field === "email" ? "email" : "text"} value={invocationInput[field] ?? ""} onChange={(event) => setInvocationInput((current) => ({ ...current, [field]: event.target.value }))} /></label>)}
            {tool.capabilityKind === "MUTATION" ? <><label className="foundry-label" htmlFor="invoke-actor">Actor<input id="invoke-actor" value={actor} onChange={(event) => setActor(event.target.value)} /></label><label className="foundry-check"><input type="checkbox" checked={confirmation} onChange={(event) => setConfirmation(event.target.checked)} /> I confirm this exact consequence</label></> : null}
            {tool.name === "prepare_weekly_promotional_email_campaign" ? <section className="foundry-campaign-form" aria-labelledby="campaign-brief-heading">
              <span className="foundry-state">CAMPAIGN BRIEF · DRAFT PREPARATION ONLY</span>
              <h3 id="campaign-brief-heading">Configure this draft run</h3>
              <label className="foundry-label" htmlFor="campaign-company">Company / sender name<input id="campaign-company" value={profile.companyName} onChange={(event) => updateProfile({ companyName: event.target.value })} /></label>
              <label className="foundry-label" htmlFor="campaign-offer">Promotion offer<input id="campaign-offer" value={profile.campaignOffer} onChange={(event) => updateProfile({ campaignOffer: event.target.value })} /></label>
              <label className="foundry-label" htmlFor="campaign-voice">Voice<select id="campaign-voice" value={profile.brandVoice} onChange={(event) => updateProfile({ brandVoice: event.target.value })}><option>Warm, clear, and helpful</option><option>Confident and concise</option><option>Premium and celebratory</option></select></label>
              <label className="foundry-label" htmlFor="campaign-style">Email style<select id="campaign-style" value={profile.campaignStyle} onChange={(event) => updateProfile({ campaignStyle: event.target.value })}><option>Short promotional email with one clear offer</option><option>Personal note with a concise offer</option><option>Product update with one clear next step</option></select></label>
              <dl><div><dt>Approved audience</dt><dd>Active customers · mock directory</dd></div><div><dt>Delivery mode</dt><dd>Draft only · no send authority</dd></div><div><dt>Schedule</dt><dd>Tuesday · 09:00 local time</dd></div></dl>
            </section> : null}
            <button className="foundry-build foundry-run" type="button" onClick={() => void invokeTool()}>{tool.capabilityKind === "MUTATION" ? "REQUEST FRESH COMMIT" : tool.name === "prepare_weekly_promotional_email_campaign" ? "PREPARE THIS WEEK'S DRAFTS" : "RUN READ"}</button>
            {invocation ? <div className={`foundry-invocation ${invocation.status === "BLOCKED_NO_AUTHORITY" ? "is-blocked" : ""}`}>
              <b>{invocation.status.replaceAll("_", " ")}</b>
              {businessWorkspace ? <section className="foundry-business-workspace">
                <span className="foundry-state">{businessWorkspace.title.toUpperCase()} · PUBLIC-SAFE DEMO DATA</span>
                <section className="foundry-business-stats">{businessWorkspace.summary.map((item) => <div key={item.label}><span>{item.label}</span><strong>{item.value}</strong><small>{item.detail}</small></div>)}</section>
                <div className="foundry-business-table"><table><thead><tr>{businessWorkspace.columns.map((column) => <th key={column}>{column.replaceAll("_", " ")}</th>)}</tr></thead><tbody>{businessWorkspace.rows.map((row, index) => <tr key={`${businessWorkspace.kind}-${index}`}>{businessWorkspace.columns.map((column) => <td key={column}>{row[column] ?? "—"}</td>)}</tr>)}</tbody></table></div>
                <p className="foundry-pending"><b>Current demo:</b> deterministic public-safe Foundry data, with no external system connection. <b>Production path:</b> this same governed tool can read an approved authenticated CRM, support, dispatch, analytics, or campaign substrate. Any write, send, assignment, or other consequence still requires a fresh Xact Commit.</p>
              </section> : isCampaignPreparation(invocation.result) ? <section className="foundry-campaign">
                <span className="foundry-state">{invocation.result.status.replaceAll("_", " ")}</span>
                <h3>{invocation.result.campaign}</h3>
                <p><b>Rotation:</b> {invocation.result.rotation}<br /><b>Next preparation:</b> {invocation.result.nextRun}</p>
                <section className="foundry-campaign-stats" aria-label="Campaign preparation statistics">
                  <div><span>Audience selected</span><strong>{invocation.result.recipients.length}</strong><small>approved mock audience</small></div>
                  <div><span>Drafts prepared</span><strong>{invocation.result.recipients.length}</strong><small>personalized promotions</small></div>
                  <div><span>X-Node operations</span><strong>{invocation.result.totalOperations}</strong><small>deterministic work</small></div>
                  <div className="is-blocked"><span>Emails sent</span><strong>0</strong><small>no fresh Commit</small></div>
                </section>
                <p className="foundry-pending">These are personalized mock drafts only. Sending any batch requires a separate, exact fresh Commit.</p>
                <section className="foundry-node-run">
                  <span className="foundry-state">X-NODE CAMPAIGN RUN · {invocation.result.nodes.length}/{invocation.result.nodes.length} COMPLETE</span>
                  <strong>{invocation.result.totalOperations} deterministic operations</strong>
                  <ol>{invocation.result.nodes.map((node) => <li key={node.id}><span>✓</span>{node.label}<b>{node.operations}</b></li>)}</ol>
                </section>
                <section className="foundry-build-brief">
                  <span className="foundry-state">X-NODE BUILD BRIEF · COMPLETE</span>
                  <dl><div><dt>Profile</dt><dd>Foundry Profile v{profile.version}</dd></div><div><dt>Audience</dt><dd>Foundry mock customer directory</dd></div><div><dt>Mode</dt><dd>{invocation.result.brief.deliveryMode.replaceAll("_", " ")}</dd></div><div><dt>Voice</dt><dd>{invocation.result.brief.voice}</dd></div><div><dt>Style</dt><dd>{invocation.result.brief.style}</dd></div><div><dt>Sender</dt><dd>{invocation.result.brief.sender}</dd></div><div><dt>Offer</dt><dd>{invocation.result.brief.offer}</dd></div><div><dt>Audit</dt><dd>{invocation.result.brief.auditRequired ? "REQUIRED" : "NOT REQUIRED"}</dd></div></dl>
                </section>
                {selectedCampaignRecipient ? <section className="foundry-email-preview">
                  <span className="foundry-state">PERSONALIZED PROMOTION · DRAFT REVIEW</span>
                  <label className="foundry-label" htmlFor="campaign-recipient">Prepared recipient<select id="campaign-recipient" value={selectedCampaignRecipient.customerId} onChange={(event) => setSelectedCampaignRecipientId(event.target.value)}>{invocation.result.recipients.map((recipient) => <option key={recipient.customerId} value={recipient.customerId}>{recipient.name} · {recipient.segment} · {recipient.email}</option>)}</select></label>
                  <dl><div><dt>From</dt><dd>{invocation.result.brief.sender}</dd></div><div><dt>To</dt><dd>{selectedCampaignRecipient.name} &lt;{selectedCampaignRecipient.email}&gt;</dd></div><div><dt>Why selected</dt><dd>Approved {selectedCampaignRecipient.segment.toLowerCase()} customer segment</dd></div><div><dt>Subject</dt><dd>{selectedCampaignRecipient.subject}</dd></div></dl>
                  <div className="foundry-email-body"><p>Hi {selectedCampaignRecipient.name},</p><p>In a <b>{invocation.result.brief.voice.toLowerCase()}</b> voice: your approved promotion is <b>{invocation.result.brief.offer}</b>.</p><p>Style: {invocation.result.brief.style}.</p><span>SHOP THE OFFER →</span><p>— {invocation.result.brief.sender}</p></div>
                </section> : null}
                <section className="foundry-email-path">
                  <span className="foundry-state">EMAIL DELIVERY · NOT CONNECTED</span>
                  <p>When an approved email account is connected, this same tool can submit a prepared batch only after a fresh Commit binds its exact sender, recipients, content, and scheduled time.</p>
                  <ol><li>Prepared drafts</li><li>Fresh exact Commit</li><li>Approved email account</li><li>Delivery receipt and audit</li></ol>
                </section>
              </section> : invocation.result !== undefined ? <pre>{JSON.stringify(invocation.result, null, 2)}</pre> : null}
              {invocation.effectFingerprint ? <small>EFFECT · {invocation.effectFingerprint}</small> : null}
              <ul>{invocation.audit.map((line) => <li key={line}>{line}</li>)}</ul>
            </div> : null}
            {invocationError ? <p className="foundry-error">{invocationError}</p> : null}
          </section>
          <p className="foundry-pending">{result?.outcome === "WORKING_TOOL" ? "Browser WebMCP exposure is also registered and verified." : result?.outcome === "REGISTRATION_FAILED" ? "Browser exposure failed, but the tool remains hosted on the Foundry shelf." : "Browser exposure is optional; the Foundry shelf is the host."}</p>
        </> : result?.build?.refusal ? <>
          <h2>Construction blocked</h2><span className="foundry-state">NO TOOL CREATED</span><p>{result.build.refusal.reasons.join(" ")}</p><p className="foundry-pending">Implementation knowledge is not authority to construct this capability.</p>
        </> : <><h2>No artifact yet</h2><p className="foundry-empty">A governed, inert definition appears here only when Xact actually composes one.</p></>}
      </section>
    </section>
    <FoundryRunExplainer prompt={turns.find((turn) => turn.speaker === "user")?.text} tool={tool} activity={activity} invocation={invocation} buildElapsedMs={buildElapsedMs} />
  </main>;
}
