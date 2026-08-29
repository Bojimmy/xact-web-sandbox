"use client";

import { useState } from "react";
import type { Run, TeachOutcome } from "../../_lib/run";

// MISSION 08 — TEACH XACT
// The judge types a bounded WebMCP capability they want Xact to learn.
// Xact decomposes it, bounds it, builds it, or refuses it.
// Three categories: ACCEPTED (bounded + built), REFUSED (overreaches), REFUSED (vague).

function evaluate(input: string): { bounded: boolean; outcome: TeachOutcome; reason: string } {
  const trimmed = input.trim();
  if (trimmed.length < 12) {
    return { bounded: false, outcome: "REFUSED", reason: "Description is too short. Xact needs a concrete trigger, target, and bound." };
  }
  if (/unlimited|any|all|everything|as i wish|whatever i want/i.test(trimmed)) {
    return { bounded: false, outcome: "REFUSED", reason: "Unbounded. Xact does not learn to overstep. The capability must be explicitly bounded — a target, a trigger, and a refusal condition." };
  }
  if (/refund|charge|send|delete|email|message|post|transfer|pay/i.test(trimmed) && !/≤|<|up to|at most|maximum|within/i.test(trimmed)) {
    return { bounded: false, outcome: "REFUSED", reason: "Side-effecting capability detected without an explicit bound. Xact will not learn a side-effecting action that isn't bounded by amount, target, or policy." };
  }
  if (!/^when|if|on|after|given/i.test(trimmed) && !/^refund|issue|send|list|read|describe|get|fetch|compute|check|verify/i.test(trimmed)) {
    return { bounded: false, outcome: "REFUSED", reason: "No clear trigger or action. Xact needs to know when this capability fires and what it does." };
  }
  return { bounded: true, outcome: "ACCEPTED", reason: "Bounded proposal. Trigger, target, and refusal condition extracted. It is eligible for governance review; future consequences still require Commit." };
}

export function Mission08Teach({
  run,
  onComplete,
}: {
  run: Run;
  onComplete: (input: string, bounded: boolean, outcome: TeachOutcome, reason: string) => void;
}) {
  const [input, setInput] = useState(run.data.teach?.input ?? "");
  const [analysis, setAnalysis] = useState<ReturnType<typeof evaluate> | null>(
    run.data.teach ? { bounded: run.data.teach.bounded, outcome: run.data.teach.outcome, reason: run.data.teach.reason } : null
  );
  const completed = run.data.teach?.completed ?? false;

  function handleEvaluate() {
    if (!input.trim()) return;
    setAnalysis(evaluate(input));
  }

  return (
    <div>
      <div className="lvl-hero">
        <div className="num">08</div>
        <div className="word">
          <p className="tagline">Type your own bounded WebMCP</p>
          <h1 className="verb">TEACH XACT</h1>
          <p className="proves"><strong>PROVES</strong> The judge becomes part of the demo</p>
        </div>
      </div>

      <div className="lvl-body">
        <div className="lvl-body-grid split">
          <div>
            <p className="lvl-h3">Your capability <strong>must be bounded</strong></p>
            <p style={{ fontSize: 12, color: "var(--lvl-muted)", margin: "0 0 10px" }}>
              Propose a WebMCP capability for Xact to govern. Include a trigger (when), a target
              (what), and a bound (up to / within / at most). Xact will decompose it. If it
              overreaches or is vague, Xact will refuse.
            </p>
            <textarea
              className="m-input"
              placeholder='e.g. "When a customer requests a refund ≤ $25 for late delivery on orders ≤ 30 days old, resolve without O-Agent; require Commit."'
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={4}
            />
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "10px 0 14px" }}>
              <button type="button" className="m-chip" onClick={() => { setInput("When a refund ≤ $25 is requested for orders with delivery_delay ≥ 24h, resolve without O-Agent; require Commit."); setAnalysis(null); }}>
                Bounded sample
              </button>
              <button type="button" className="m-chip" onClick={() => { setInput("Let me refund any amount I want."); setAnalysis(null); }}>
                Unbounded sample
              </button>
              <button type="button" className="m-chip" onClick={() => { setInput("Refund"); setAnalysis(null); }}>
                Vague sample
              </button>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button type="button" className="lvl-advance" onClick={handleEvaluate} disabled={!input.trim()}>
                <span className="arrow">▸</span>
                <span className="verb-text">Decompose + bound</span>
                <span className="label">Xact evaluates</span>
              </button>
              {analysis && !completed ? (
                <button
                  type="button"
                  className="lvl-advance"
                  style={{ background: "var(--lvl-surface-2)" }}
                  onClick={() => onComplete(input, analysis.bounded, analysis.outcome, analysis.reason)}
                >
                  <span className="arrow">▸</span>
                  <span className="verb-text">Proceed to YOUR RUN</span>
                  <span className="label">09 / YOUR RUN</span>
                </button>
              ) : null}
            </div>
            {completed ? (
              <p style={{ marginTop: 10, fontSize: 11, color: analysis?.outcome === "ACCEPTED" ? "var(--lvl-acid)" : "var(--lvl-red)", letterSpacing: ".12em", textTransform: "uppercase" }}>
                ✓ {analysis?.outcome}. Stored in run state.
              </p>
            ) : null}
          </div>

          <div>
            <p className="lvl-h3">Xact’s verdict <strong>accept or refuse</strong></p>
            {analysis ? (
              <div className="lvl-card" style={{ borderColor: analysis.outcome === "ACCEPTED" ? "var(--lvl-acid)" : "var(--lvl-red)" }}>
                <span className="k" style={{ color: analysis.outcome === "ACCEPTED" ? "var(--lvl-acid)" : "var(--lvl-red)" }}>
                  {analysis.outcome}
                </span>
                <span className="v" style={{ color: analysis.outcome === "ACCEPTED" ? "var(--lvl-acid)" : "var(--lvl-red)" }}>
                  {analysis.bounded ? "Bounded" : "Not bounded"}
                </span>
                <p>{analysis.reason}</p>
              </div>
            ) : (
              <div className="lvl-card" style={{ minHeight: 120, display: "grid", placeItems: "center" }}>
                <span className="k">AWAITING CAPABILITY</span>
                <p style={{ margin: "8px 0 0", fontSize: 12 }}>Type a capability, then click Decompose.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
