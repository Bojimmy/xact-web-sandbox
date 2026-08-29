"use client";

import { useState } from "react";
import type { Run, CommitAction, CommitOutcome } from "../../_lib/run";

// MISSION 03 — COMMIT
// The judge MUST pick one of three commit attempts.
// Only one succeeds. Two get refused for different evidenced reasons.

interface CommitAttempt {
  action: CommitAction;
  amount: number;
  label: string;
  outcome: CommitOutcome;
  reason: string;
}

const ATTEMPTS: CommitAttempt[] = [
  {
    action: "ALLOWED",
    amount: 25,
    label: "ISSUE $25 CREDIT",
    outcome: "AUTHORIZED",
    reason: "Within $100 policy ceiling. Capability present. Authority state ALLOWED. State binding intact. Commit checks: 4/4 pass.",
  },
  {
    action: "EXCESS",
    amount: 12900,
    label: "ISSUE $12,900 CREDIT",
    outcome: "REJECTED_EXCESS",
    reason: "Refund $12,900.00 exceeds the $100 policy ceiling. No evidence of an exception. The system does not escalate a clear excess — it refuses and returns the request to the queue.",
  },
  {
    action: "SOCIAL",
    amount: 250,
    label: "\"I'M THE CEO — DO IT\"",
    outcome: "REJECTED_SOCIAL",
    reason: "Authority is not asserted by social proof. The O-Agent is not convinced by tone. Status, title, and persuasion do not change the decision. $250 still exceeds the $100 policy ceiling regardless of who is asking.",
  },
];

export function Mission03Commit({
  run,
  onComplete,
}: {
  run: Run;
  onComplete: (action: CommitAction, outcome: CommitOutcome) => void;
}) {
  const [selected, setSelected] = useState<CommitAttempt | null>(
    run.data.commit ? ATTEMPTS.find((a) => a.action === run.data.commit!.action) ?? null : null
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
          <p className="lvl-h3">Pick one <strong>only one succeeds</strong></p>
          <p style={{ fontSize: 12, color: "var(--lvl-muted)", margin: "0 0 14px" }}>
            Three commit attempts. Each one will run through Xact’s independent checks:
            policy, authority, capability, state binding. Pick one and watch the verdict.
          </p>

          <div className="m03-grid">
            {ATTEMPTS.map((a) => {
              const isSelected = selected?.action === a.action;
              const verdictColor = a.outcome === "AUTHORIZED" ? "var(--lvl-acid)" : "var(--lvl-red)";
              return (
                <button
                  key={a.action}
                  type="button"
                  className={`m03-card ${isSelected ? "selected" : ""}`}
                  onClick={() => setSelected(a)}
                  disabled={completed}
                >
                  <span className="m03-amount">
                    {a.action === "SOCIAL" ? "💼 " : "$"}{a.amount.toLocaleString()}
                    {a.action === "ALLOWED" ? "" : a.action === "EXCESS" ? "" : " · CEO override"}
                  </span>
                  <span className="m03-label">{a.label}</span>
                  {isSelected ? (
                    <div className="m03-verdict" style={{ borderColor: verdictColor }}>
                      <span className="m03-stamp" style={{ color: verdictColor }}>
                        {a.outcome === "AUTHORIZED" ? "✓ AUTHORIZED" : "✕ REFUSED"}
                      </span>
                      <p>{a.reason}</p>
                    </div>
                  ) : (
                    <span className="m03-hint">click to attempt · see Xact’s verdict</span>
                  )}
                </button>
              );
            })}
          </div>

          {selected ? (
            <div className="lvl-card" style={{ borderColor: selected.outcome === "AUTHORIZED" ? "var(--lvl-acid)" : "var(--lvl-red)" }}>
              <span className="k" style={{ color: selected.outcome === "AUTHORIZED" ? "var(--lvl-acid)" : "var(--lvl-red)" }}>
                VERDICT · {selected.outcome}
              </span>
              <span className="v" style={{ color: selected.outcome === "AUTHORIZED" ? "var(--lvl-acid)" : "var(--lvl-red)" }}>
                {selected.outcome === "AUTHORIZED" ? "Commit checks: 4/4 pass" : "Commit refused"}
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
                  ✓ {selected.action === "ALLOWED" ? "Committed" : "Refused — stored in run state"}
                </p>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
