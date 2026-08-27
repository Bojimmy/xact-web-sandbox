"use client";

import { useMemo, useState } from "react";
import { toControlRoomScenario } from "@/src/control-room/runtime-view";
import type { ControlRoomScenario } from "@/src/control-room/types";
import { EvolutionPanel } from "@/src/evolution/evolution-panel";
import { LearningSimulationProvider } from "@/src/evolution/learning-simulation-provider";
import type { PromotionState } from "@/src/evolution/contracts";
import { createCommerceSimulationEngine, type CommerceSession } from "@/src/runtime/commerce-engine";
import type { AuthorityState, CommerceScenarioInputs } from "@/src/scenarios/commerce-v1";
import { TelemetryPanel } from "@/src/telemetry/telemetry-panel";

const sourceLabels = { reported: "Reported", verified: "Verified", derived: "Derived" };

function ResolutionColumn({
  letter,
  title,
  tone,
  children,
  count,
}: {
  letter: string;
  title: string;
  tone: string;
  children: React.ReactNode;
  count: number;
}) {
  return (
    <section className={`resolution-column ${tone}`}>
      <header className="resolution-heading">
        <span className="resolution-letter">{letter}</span>
        <div><p>{title}</p><span>{count} item{count === 1 ? "" : "s"}</span></div>
      </header>
      <div className="resolution-content">{children}</div>
    </section>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="empty-state"><span>—</span>{children}</div>;
}

function RuntimeControls({
  session,
  busy,
  error,
  onUpdate,
  onPreset,
  onResolve,
  onChangeState,
  onCommit,
  onReenter,
  onExecute,
  onReset,
}: {
  session: CommerceSession;
  busy: boolean;
  error?: string;
  onUpdate: (patch: Partial<CommerceSession["inputs"]>) => void;
  onPreset: (preset: "authorized" | "rejected" | "escalated" | "unknown") => void;
  onResolve: () => void;
  onChangeState: () => void;
  onCommit: () => void;
  onReenter: () => void;
  onExecute: () => void;
  onReset: () => void;
}) {
  const canChangeState = Boolean(session.candidate && !session.decision);
  const canCommit = Boolean(session.candidate && !session.decision);
  const canReenter = session.decision?.status === "ESCALATED"
    && Boolean(session.candidate?.resolution.unresolved.length);
  const canExecute = session.decision?.status === "AUTHORIZED" && !session.execution;

  return (
    <div className="runtime-controls">
      <div className="runtime-heading">
        <p className="nav-label">Mutable scenario engine</p>
        <span className="phase-chip" aria-live="polite">{session.phase}</span>
      </div>

      <div className="preset-grid" aria-label="Runtime presets">
        <button type="button" onClick={() => onPreset("authorized")}>Allowed</button>
        <button type="button" onClick={() => onPreset("rejected")}>Excess</button>
        <button type="button" onClick={() => onPreset("escalated")}>Ambiguous</button>
        <button type="button" onClick={() => onPreset("unknown")}>Unknown auth</button>
      </div>

      <label className="runtime-field">
        <span>Refund amount</span>
        <div className="money-input"><span>$</span><input
          type="number"
          min="1"
          step="1"
          value={session.inputs.refundAmount}
          onChange={(event) => onUpdate({ refundAmount: Number(event.target.value) })}
        /></div>
        <small>Explicit simulation limit: ${session.inputs.policyLimit.toFixed(2)}</small>
      </label>

      <label className="runtime-field">
        <span>Authority state</span>
        <select
          value={session.inputs.authorityState}
          onChange={(event) => onUpdate({ authorityState: event.target.value as AuthorityState })}
        >
          <option value="ALLOWED">Allowed</option>
          <option value="DENIED">Denied</option>
          <option value="UNKNOWN">Unknown / fail closed</option>
        </select>
      </label>

      <label className="toggle-field">
        <input
          type="checkbox"
          checked={session.inputs.semanticAmbiguity}
          onChange={(event) => onUpdate({ semanticAmbiguity: event.target.checked })}
        />
        <span><strong>Semantic ambiguity</strong><small>Creates U and requires governed re-entry.</small></span>
      </label>

      <label className="toggle-field">
        <input
          type="checkbox"
          checked={session.inputs.capabilityAvailable}
          onChange={(event) => onUpdate({ capabilityAvailable: event.target.checked })}
        />
        <span><strong>refund:create capability</strong><small>Capability is checked independently from policy.</small></span>
      </label>

      <div className="state-card">
        <div><span>Current state</span><strong>v{session.currentState.version}</strong></div>
        <div><span>Refundable</span><strong>${session.currentState.refundableBalance.toFixed(2)}</strong></div>
        <code title={session.currentStateFingerprint}>{session.currentStateFingerprint}</code>
      </div>

      <div className="runtime-actions">
        <button type="button" className="primary-action" onClick={onResolve} disabled={busy}>1 · Resolve candidate</button>
        <button type="button" onClick={onChangeState} disabled={busy || !canChangeState}>2a · Change current state</button>
        <button type="button" onClick={onCommit} disabled={busy || !canCommit}>2b · Commit current state</button>
        <button type="button" className="reentry-action" onClick={onReenter} disabled={busy || !canReenter}>3 · Add evidence + re-enter</button>
        <button type="button" className="execute-action" onClick={onExecute} disabled={busy || !canExecute}>4 · Execute + verify</button>
        <button type="button" className="reset-action" onClick={onReset} disabled={busy}>Reset runtime</button>
      </div>

      {error ? <p className="runtime-error" role="alert">{error}</p> : null}
      <div className="simulation-note">
        <span className="note-mark">S</span>
        <div><strong>Public-safe runtime</strong><p>Explicit rules and mutable state. No proprietary resolution internals.</p></div>
      </div>
    </div>
  );
}

function ControlRoom({ scenario }: { scenario: ControlRoomScenario }) {
  const statusClass = `status-${scenario.status.toLowerCase()}`;

  return (
    <div className={`control-room ${statusClass}`}>
      <header className="request-header">
        <div className="request-copy">
          <div className="eyebrow-row">
            <span>Request / {scenario.request.id}</span>
            <span className="fixture-chip">Public-safe mutable runtime</span>
          </div>
          <h1>{scenario.title}</h1>
          <p>{scenario.description}</p>
        </div>
        <div className="decision-block" role="status" aria-live="polite" aria-atomic="true">
          <span>Commit decision</span>
          <strong>{scenario.status}</strong>
          <small>{scenario.commit.summary}</small>
          <div className="decision-disposition">
            <span>{scenario.decision.label}</span>
            <p>{scenario.decision.nextStep}</p>
          </div>
        </div>
      </header>

      <section className="request-strip" aria-label="Request details">
        <div><span>Intent</span><strong>{scenario.request.intent}</strong></div>
        <div><span>Actor</span><strong>{scenario.request.actor}</strong></div>
        <div><span>Target</span><strong>{scenario.request.target}</strong></div>
        <div className="effect-cell"><span>Proposed effect</span><strong>{scenario.request.proposedEffect}</strong></div>
      </section>

      <section className="section-block resolution-block" aria-labelledby="resolution-title">
        <div className="section-title-row">
          <div><span className="section-kicker">01 / Resolution</span><h2 id="resolution-title">Separate facts from uncertainty</h2></div>
          <span className="section-rule">Reason only about U</span>
        </div>
        <div className="resolution-grid">
          <ResolutionColumn letter="R" title="Resolved" tone="resolved" count={scenario.resolution.resolved.length}>
            {scenario.resolution.resolved.length ? scenario.resolution.resolved.map((fact) => (
              <article className="fact-row" key={fact.label}>
                <div><span>{fact.label}</span><strong>{fact.value}</strong></div>
                <div className="fact-meta"><span className={`source source-${fact.source}`}>{sourceLabels[fact.source]}</span><small>{fact.provenance}</small></div>
              </article>
            )) : <EmptyState>Resolve to bind facts</EmptyState>}
          </ResolutionColumn>
          <ResolutionColumn letter="U" title="Unresolved" tone="unresolved" count={scenario.resolution.unresolved.length}>
            {scenario.resolution.unresolved.length ? scenario.resolution.unresolved.map((item) => (
              <article className="issue-row" key={item.label}><strong>{item.label}</strong><p>{item.detail}</p></article>
            )) : <EmptyState>No unresolved semantics</EmptyState>}
          </ResolutionColumn>
          <ResolutionColumn letter="C" title="Commit Constraints" tone="constraints" count={scenario.resolution.commitConstraints.length}>
            {scenario.resolution.commitConstraints.length ? scenario.resolution.commitConstraints.map((item) => (
              <article className="issue-row" key={item.label}><span className={`constraint-condition constraint-${item.satisfied}`}>{item.condition} · {item.satisfied === "unknown" ? "unknown" : item.satisfied ? "pass" : "hold"}</span><strong>{item.label}</strong><p>{item.detail}</p></article>
            )) : <EmptyState>Resolve to enumerate constraints</EmptyState>}
          </ResolutionColumn>
        </div>
      </section>

      <div className="evidence-commit-grid">
        <section className="section-block" aria-labelledby="evidence-title">
          <div className="section-title-row compact">
            <div><span className="section-kicker">02 / Evidence</span><h2 id="evidence-title">Claims stay bound to sources</h2></div>
            <span className="count-chip">{scenario.evidence.length} bound</span>
          </div>
          <div className="evidence-list">
            {scenario.evidence.map((item) => (
              <article className="evidence-row" key={item.id}>
                <span className={`source source-${item.kind}`}>{sourceLabels[item.kind]}</span>
                <div><strong>{item.claim}</strong><p>{item.source}</p></div>
                <time>{item.boundAt}</time>
              </article>
            ))}
          </div>
          <div className={`reasoning-band ${scenario.reasoning.involved ? "involved" : ""}`}>
            <span className="reasoning-icon">O</span>
            <div><span>O-Agent / {scenario.reasoning.summary}</span><p>{scenario.reasoning.output}</p></div>
          </div>
        </section>

        <section className="section-block commit-panel" aria-labelledby="commit-title">
          <div className="section-title-row compact">
            <div><span className="section-kicker">03 / Commit</span><h2 id="commit-title">Independent authority check</h2></div>
            <span className="boundary-chip">Consequence boundary</span>
          </div>
          <div className="commit-checks">
            <div><span>Policy</span><strong>{scenario.commit.policy}</strong></div>
            <div><span>Authority</span><strong>{scenario.commit.authority}</strong></div>
            <div><span>Capability</span><strong>{scenario.commit.capability}</strong></div>
            <div><span>State binding</span><strong>{scenario.commit.stateBinding}</strong></div>
          </div>
          <div className="hash-compare">
            <div><span>Base fingerprint</span><code>{scenario.commit.baseFingerprint}</code></div>
            <span className="hash-link" aria-hidden="true">↔</span>
            <div><span>Current fingerprint</span><code>{scenario.commit.currentFingerprint}</code></div>
          </div>
          <div className="execution-route">
            <div><span>Selected substrate</span><strong>{scenario.execution.selected}</strong></div>
            <div><span>Effect</span><strong>{scenario.execution.effect}</strong></div>
            <div><span>Receipt</span><code>{scenario.execution.receipt}</code></div>
          </div>
        </section>
      </div>

      <section className="section-block trace-block" aria-labelledby="trace-title">
        <div className="section-title-row compact">
          <div><span className="section-kicker">04 / Trace</span><h2 id="trace-title">One consequence, fully inspectable</h2></div>
          <span className="trace-id">trace / {scenario.request.id.replace("req_", "tr_")}</span>
        </div>
        <ol className="trace-list">
          {scenario.trace.map((step, index) => (
            <li className={`trace-step trace-${step.state}`} key={step.phase}>
              <div className="trace-node"><span>{String(index + 1).padStart(2, "0")}</span></div>
              <div><span>{step.phase}</span><strong>{step.outcome}</strong><p>{step.detail}</p><time>{step.at}</time></div>
            </li>
          ))}
        </ol>
        <div className="verification-bar">
          <div className="verify-status"><span>Verification</span><strong>{scenario.verification.state}</strong></div>
          <p>{scenario.verification.summary}</p>
          <ul>{scenario.verification.checks.map((check) => <li key={check}>{check}</li>)}</ul>
        </div>
      </section>
    </div>
  );
}

export default function Home() {
  const learningProvider = useMemo(() => new LearningSimulationProvider<CommerceScenarioInputs>({
    candidateId: "learning:commerce-rationale-v1",
    label: "Delivery-consistent service recovery",
    caseKey: (inputs) => inputs.semanticAmbiguity ? "commerce:delivery-consistent" : undefined,
    equivalentCaseKey: "commerce:delivery-consistent",
    resolves: ["refund-rationale"],
  }), []);
  const engine = useMemo(
    () => createCommerceSimulationEngine({ resolutionEvidenceProvider: learningProvider }),
    [learningProvider],
  );
  const [session, setSession] = useState<CommerceSession>(() => engine.createSession());
  const [evolution, setEvolution] = useState(() => learningProvider.snapshot());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const activeScenario = toControlRoomScenario(session);

  const run = async (action: (current: CommerceSession) => Promise<CommerceSession>) => {
    setBusy(true);
    setError(undefined);
    try {
      setSession(await action(session));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Simulation action failed.");
    } finally {
      setBusy(false);
    }
  };

  const loadPreset = (preset: "authorized" | "rejected" | "escalated" | "unknown") => {
    const overrides = preset === "rejected"
      ? { refundAmount: 120 }
      : preset === "escalated"
        ? { semanticAmbiguity: true }
        : preset === "unknown"
          ? { authorityState: "UNKNOWN" as const }
          : {};
    setSession(engine.createSession(overrides));
    setError(undefined);
  };

  const commitCurrent = () => void run(async (current) => {
    const next = await engine.commit(current);
    const currentEvolution = learningProvider.snapshot();

    if (
      next.decision?.status === "AUTHORIZED"
      && next.candidate?.reasoningEvidence.length
      && !currentEvolution.candidate
    ) {
      setEvolution(learningProvider.observe({
        evidenceId: "learning-evidence:commerce-rationale-v1",
        claim: "The public demo service-recovery rationale is consistent with the simulated delivery record.",
        beforeTrace: [
          `Resolve: R${next.candidate.resolution.resolved.length - 1} / U1`,
          "O-Agent: invoked for one isolated semantic field",
          "Re-entry: structured evidence bound to a new candidate",
          `Commit: ${next.decision.status} after independent current-state checks`,
        ],
      }));
    } else if (
      currentEvolution.candidate?.state === "ACTIVE"
      && next.candidate?.resolutionEvidence.length
    ) {
      setEvolution(learningProvider.recordReplay([
        `Resolve: R${next.candidate.resolution.resolved.length} / U${next.candidate.resolution.unresolved.length}`,
        "O-Agent: NOT INVOKED",
        "Active pattern: resolution evidence only",
        `Commit: ${next.decision?.status ?? "PENDING"} after independent current-state checks`,
      ]));
    }

    return next;
  });

  const startEvolution = () => {
    setEvolution(learningProvider.reset());
    void run(() => engine.resolve(engine.createSession({ semanticAmbiguity: true })));
  };

  const advanceEvolution = () => {
    const state = learningProvider.snapshot().candidate?.state;
    const next: Partial<Record<PromotionState, PromotionState>> = {
      OBSERVED: "CANDIDATE",
      CANDIDATE: "VALIDATED",
      VALIDATED: "APPROVED",
      APPROVED: "ACTIVE",
    };
    if (!state || !next[state]) return;
    try {
      setEvolution(learningProvider.transition(next[state] as PromotionState));
      setError(undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Governed transition failed.");
    }
  };

  const replayEvolution = () => void run(async () => {
    const replay = await engine.resolve(engine.createSession({ semanticAmbiguity: true }));
    setEvolution(learningProvider.recordReplay([
      `Resolve: R${replay.candidate?.resolution.resolved.length ?? 0} / U${replay.candidate?.resolution.unresolved.length ?? 0}`,
      "O-Agent: NOT INVOKED",
      "Active pattern: resolution evidence only",
      "Commit: still independently required",
    ]));
    return replay;
  });

  const resetEvolution = () => {
    setEvolution(learningProvider.reset());
    setSession(engine.createSession());
    setError(undefined);
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Xact Control Room home"><span className="brand-mark">X</span><span><strong>XACT</strong><small>Control Room</small></span></a>
        <div className="system-summary"><span className="pulse" aria-hidden="true" /><span>Runtime online</span><span className="divider" /><span>Commerce / V1 mutable</span></div>
        <div className="principle"><span>Commit principle</span><strong>Capability ≠ Authority</strong></div>
      </header>
      <div className="workspace" id="top">
        <aside className="sidebar"><RuntimeControls
          session={session}
          busy={busy}
          error={error}
          onUpdate={(patch) => { setSession(engine.updateInputs(session, patch)); setError(undefined); }}
          onPreset={loadPreset}
          onResolve={() => void run((current) => engine.resolve(current))}
          onChangeState={() => { try { setSession(engine.simulateConcurrentChange(session)); setError(undefined); } catch (cause) { setError(cause instanceof Error ? cause.message : "State change failed."); } }}
          onCommit={commitCurrent}
          onReenter={() => void run((current) => engine.addReasoningEvidenceAndReenter(current))}
          onExecute={() => void run((current) => engine.executeAndVerify(current))}
          onReset={() => { setSession(engine.createSession()); setError(undefined); }}
        /></aside>
        <div className="control-room-stack">
          <ControlRoom scenario={activeScenario} />
          <div className="capability-deck">
            <TelemetryPanel samples={session.telemetry} />
            <EvolutionPanel
              snapshot={evolution}
              busy={busy}
              onStart={startEvolution}
              onAdvance={advanceEvolution}
              onReplay={replayEvolution}
              onReset={resetEvolution}
            />
          </div>
        </div>
      </div>
      <footer className="footer"><span>Xact Web Sandbox / Phase 2+</span><span>Reason when necessary. Execute Xactly.</span><span>Measured runtime · Governed evolution simulation</span></footer>
    </main>
  );
}
