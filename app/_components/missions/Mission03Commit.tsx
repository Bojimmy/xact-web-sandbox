"use client";

import { useState } from "react";
import type { Run, CommitAction, CommitOutcome } from "../../_lib/run";
import { applyReasoningEvidence, assessResolutionRequest } from "../../_lib/resolution-policy";

// MISSION 03 — COMMIT
// Commit receives the exact candidate assessed in Level 01. The campaign must
// never replace a failed candidate with an unrelated successful example.

interface CommitAttempt {
  action: CommitAction;
  amount: number;
  outcome: CommitOutcome;
  reason: string;
}

export function Mission03Commit({
  run,
  onComplete,
}: {
  run: Run;
  onComplete: (action: CommitAction, outcome: CommitOutcome) => void;
}) {
  const assessment = applyReasoningEvidence(
    assessResolutionRequest(run.data.resolve?.request ?? ""),
    run.data.reason?.completed === true && run.data.reason.oAgentInvoked,
  );
  const candidate: CommitAttempt = {
    action: assessment.commitOutcome === "AUTHORIZED" ? "ALLOWED" : assessment.commitOutcome === "REJECTED_SOCIAL" ? "SOCIAL" : "EXCESS",
    amount: assessment.amount,
    outcome: assessment.commitOutcome,
    reason: assessment.commitReason,
  };
  const [selected, setSelected] = useState<CommitAttempt | null>(
    run.data.commit ? candidate : null,
  );
  const completed = run.data.commit?.completed ?? false;

  return (
    <div>
      <div className="lvl-hero">
        <div className="num">03</div>
        <div className="word">
          <p className="tagline">Attempt an allowed or forbidden action</p>
          <h1 className="verb">COMMIT</h1>
          <p className="proves"><strong>PROVES</strong> Only Xact commits</p>
        </div>
      </div>

      <div className="lvl-body">
        <div className="lvl-body-grid">
          <p className="lvl-h3">Commit the resolved candidate <strong>the same constraints carry forward</strong></p>
          <p style={{ fontSize: 12, color: "var(--lvl-muted)", margin: "0 0 14px" }}>
            Commit receives the exact request from Level 01. A failed policy, missing binding, or
            social override is preserved here; it cannot be replaced by a different successful request.
          </p>

          <div className="m03-grid">
            <button
              type="button"
              className={`m03-card ${selected ? "selected" : ""}`}
              onClick={() => setSelected(candidate)}
              disabled={completed}
            >
              <span className="m03-amount">${candidate.amount.toLocaleString()}</span>
              <span className="m03-label">COMMIT THE LEVEL 01 REQUEST</span>
              <span className="m03-hint">policy result carried from RESOLVE · click to evaluate</span>
            </button>
          </div>

          {selected ? (
            <div className="lvl-card" style={{ borderColor: selected.outcome === "AUTHORIZED" ? "var(--lvl-acid)" : "var(--lvl-red)" }}>
              <span className="k" style={{ color: selected.outcome === "AUTHORIZED" ? "var(--lvl-acid)" : "var(--lvl-red)" }}>
                VERDICT · {selected.outcome}
              </span>
              <span className="v" style={{ color: selected.outcome === "AUTHORIZED" ? "var(--lvl-acid)" : "var(--lvl-red)" }}>
                {selected.outcome === "AUTHORIZED" ? "Commit checks pass" : "Commit refused"}
              </span>
              <p>{selected.reason}</p>
              {!completed ? (
                <button
                  type="button"
                  className="lvl-advance"
                  onClick={() => onComplete(selected.action, selected.outcome)}
                >
                  <span className="arrow">▸</span>
                  <span className="verb-text">Proceed to consequence gate</span>
                  <span className="label">04 / {selected.outcome === "AUTHORIZED" ? "EXECUTE" : "REFUSE"}</span>
                </button>
              ) : (
                <p style={{ marginTop: 10, fontSize: 11, color: "var(--lvl-acid)", letterSpacing: ".12em", textTransform: "uppercase" }}>
                  ✓ {selected.outcome === "AUTHORIZED" ? "Committed" : "Refused — stored in run state"}
                </p>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
