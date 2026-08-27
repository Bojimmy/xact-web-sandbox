"use client";

import { useState } from "react";
import { scenarios } from "@/src/control-room/fixtures";
import type { ControlRoomScenario, ScenarioId } from "@/src/control-room/types";

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

function ScenarioNav({ active, onSelect }: { active: ScenarioId; onSelect: (id: ScenarioId) => void }) {
  return (
    <nav className="scenario-nav" aria-label="Deterministic scenarios">
      <p className="nav-label">Scenario fixtures</p>
      {scenarios.map((scenario) => (
        <button
          type="button"
          key={scenario.id}
          onClick={() => onSelect(scenario.id)}
          aria-pressed={active === scenario.id}
          className={`scenario-button status-${scenario.id}`}
        >
          <span className="scenario-index">{scenario.index}</span>
          <span className="scenario-name">{scenario.label}</span>
          <span className="scenario-dot" aria-hidden="true" />
        </button>
      ))}
      <div className="simulation-note">
        <span className="note-mark">S</span>
        <div><strong>Public-safe simulation</strong><p>Deterministic fixtures. No proprietary resolution internals.</p></div>
      </div>
    </nav>
  );
}

function ControlRoom({ scenario }: { scenario: ControlRoomScenario }) {
  const statusClass = `status-${scenario.id}`;

  return (
    <div className={`control-room ${statusClass}`}>
      <header className="request-header">
        <div className="request-copy">
          <div className="eyebrow-row">
            <span>Request / {scenario.request.id}</span>
            <span className="fixture-chip">Deterministic fixture</span>
          </div>
          <h1>{scenario.title}</h1>
          <p>{scenario.description}</p>
        </div>
        <div className="decision-block" role="status" aria-live="polite" aria-atomic="true">
          <span>Commit decision</span>
          <strong>{scenario.status}</strong>
          <small>{scenario.commit.summary}</small>
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
            {scenario.resolution.resolved.map((fact) => (
              <article className="fact-row" key={fact.label}>
                <div><span>{fact.label}</span><strong>{fact.value}</strong></div>
                <div className="fact-meta"><span className={`source source-${fact.source}`}>{sourceLabels[fact.source]}</span><small>{fact.provenance}</small></div>
              </article>
            ))}
          </ResolutionColumn>
          <ResolutionColumn letter="U" title="Unresolved" tone="unresolved" count={scenario.resolution.unresolved.length}>
            {scenario.resolution.unresolved.length ? scenario.resolution.unresolved.map((item) => (
              <article className="issue-row" key={item.label}><strong>{item.label}</strong><p>{item.detail}</p></article>
            )) : <EmptyState>No unresolved semantics</EmptyState>}
          </ResolutionColumn>
          <ResolutionColumn letter="C" title="Commit context" tone="conflict" count={scenario.resolution.conflicts.length}>
            {scenario.resolution.conflicts.map((item) => (
              <article className="issue-row" key={item.label}><strong>{item.label}</strong><p>{item.detail}</p></article>
            ))}
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
            <div><span>Capability</span><strong>{scenario.commit.capability}</strong></div>
            <div><span>State binding</span><strong>{scenario.commit.stateBinding}</strong></div>
          </div>
          <div className="hash-compare">
            <div><span>Base hash</span><code>{scenario.commit.baseHash}</code></div>
            <span className="hash-link" aria-hidden="true">↔</span>
            <div><span>Current hash</span><code>{scenario.commit.currentHash}</code></div>
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
  const [activeId, setActiveId] = useState<ScenarioId>("authorized");
  const activeScenario = scenarios.find((scenario) => scenario.id === activeId) ?? scenarios[0];

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Xact Control Room home"><span className="brand-mark">X</span><span><strong>XACT</strong><small>Control Room</small></span></a>
        <div className="system-summary"><span className="pulse" aria-hidden="true" /><span>Simulation online</span><span className="divider" /><span>Commerce / V1</span></div>
        <div className="principle"><span>Commit principle</span><strong>Capability ≠ Authority</strong></div>
      </header>
      <div className="workspace" id="top">
        <aside className="sidebar"><ScenarioNav active={activeId} onSelect={setActiveId} /></aside>
        <ControlRoom scenario={activeScenario} />
      </div>
      <footer className="footer"><span>Xact Web Sandbox / Phase 1</span><span>Reason when necessary. Execute Xactly.</span><span>Fixture data · No live effects</span></footer>
    </main>
  );
}
