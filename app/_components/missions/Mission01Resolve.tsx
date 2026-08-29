"use client";

import { useState } from "react";
import type { Run } from "../../_lib/run";
import { assessResolutionRequest, nextResolutionLevel } from "../../_lib/resolution-policy";

// MISSION 01 — RESOLVE
// The first deterministic proof: one request becomes one bounded candidate,
// one unresolved question, or one policy failure that carries to Commit.

const SAMPLES = [
  "Refund $42 to order #8821 for late delivery.",
  "Refund $120 to order #4402 — customer said make it right.",
  "Issue $89 credit for missing item, policy allows up to $100.",
];

export function Mission01Resolve({
  run,
  onComplete,
  onNewRun,
}: {
  run: Run;
  onComplete: (request: string, nextLevel: 2 | 3) => void;
  onNewRun: () => void;
}) {
  const [input, setInput] = useState(run.data.resolve?.request ?? "");
  const [decomposed, setDecomposed] = useState<ReturnType<typeof assessResolutionRequest> | null>(
    run.data.resolve ? assessResolutionRequest(run.data.resolve.request) : null
  );
  const submitted = run.data.resolve?.completed ?? false;

  function handleSubmit() {
    if (!input.trim()) return;
    const d = assessResolutionRequest(input);
    setDecomposed(d);
  }

  const nextLevel = decomposed ? nextResolutionLevel(decomposed) : 3;
  const directCommit = nextLevel === 3;
  const resultLabel = decomposed?.commitOutcome === "AUTHORIZED"
    ? "CANDIDATE READY FOR COMMIT"
    : decomposed?.commitOutcome === "REJECTED_CONSTRAINT"
      ? "UNRESOLVED MEANING REQUIRES REASON"
      : "XACT POLICY FAILURE";
  const resultColor = decomposed?.commitOutcome === "AUTHORIZED"
    ? "var(--lvl-acid)"
    : decomposed?.commitOutcome === "REJECTED_CONSTRAINT"
      ? "var(--lvl-amber)"
      : "var(--lvl-red)";

  return (
    <div>
      <div className="lvl-hero">
        <div className="num">01</div>
        <div className="word">
          <p className="tagline">Give Xact a request</p>
          <h1 className="verb">RESOLVE</h1>
          <p className="proves"><strong>PROVES</strong> Determinism first</p>
        </div>
      </div>

      <div className="lvl-body">
        <div className="lvl-body-grid split">
          <div>
            <p className="lvl-h3">Give Xact a request <strong>it will bind or refuse it deterministically</strong></p>
            <p style={{ fontSize: 12, color: "var(--lvl-muted)", margin: "0 0 10px" }}>
              Xact first extracts the facts and evaluates the closed policy. It does not issue
              consequence authority here. Only a genuine unresolved meaning routes to REASON.
            </p>
            {submitted ? (
              <div className="lvl-card" style={{ borderColor: "var(--lvl-cyan)" }}>
                <span className="k">RECORDED DETERMINISTIC RESULT</span>
                <span className="v">This mission is read-only</span>
                <p>Start a new run to evaluate a different request. Recorded candidates cannot be overwritten after they enter the campaign trace.</p>
                <button type="button" className="lvl-advance" onClick={onNewRun} style={{ marginTop: 12 }}>
                  <span className="arrow">↺</span>
                  <span className="verb-text">Start new run</span>
                  <span className="label">Clear this recorded trace</span>
                </button>
              </div>
            ) : (
              <>
                <textarea
                  className="m-input"
                  placeholder='e.g. "Refund $42 to order #8821 for late delivery."'
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  rows={3}
                />
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "10px 0 14px" }}>
                  {SAMPLES.map((s) => (
                    <button key={s} type="button" className="m-chip" onClick={() => { setInput(s); setDecomposed(null); }}>
                      {s.length > 40 ? s.slice(0, 40) + "…" : s}
                    </button>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="lvl-advance"
                    onClick={handleSubmit}
                    disabled={!input.trim()}
                  >
                    <span className="arrow">▸</span>
                    <span className="verb-text">Evaluate deterministically</span>
                    <span className="label">Bind facts + policy</span>
                  </button>
                  {decomposed ? (
                    <button
                      type="button"
                      className="lvl-advance"
                      style={{ background: "var(--lvl-surface-2)" }}
                      onClick={() => onComplete(input, nextLevel)}
                    >
                      <span className="arrow">▸</span>
                      <span className="verb-text">{directCommit ? decomposed.commitOutcome === "AUTHORIZED" ? "Commit this candidate" : "Commit to 0 authority" : "Continue to REASON"}</span>
                      <span className="label">{directCommit ? "03 / COMMIT" : "02 / REASON"}</span>
                    </button>
                  ) : null}
                </div>
              </>
            )}
            {decomposed ? (
              <div className="lvl-card" style={{ borderColor: resultColor, marginTop: 14 }}>
                <span className="k" style={{ color: resultColor }}>{resultLabel}</span>
                <span className="v" style={{ color: resultColor }}>{decomposed.commitOutcome}</span>
                <p>{decomposed.commitReason}</p>
              </div>
            ) : null}
          </div>

          <div>
            <p className="lvl-h3">Decomposition <strong>R · U · C</strong></p>
            {decomposed ? (
              <div style={{ display: "grid", gap: 12 }}>
                <div className="lvl-card">
                  <span className="k">RESOLVED · R</span>
                  <ul className="m-list acid">
                    {decomposed.facts.map((f, i) => <li key={i}>{f}</li>)}
                  </ul>
                </div>
                <div className="lvl-card">
                  <span className="k">UNRESOLVED · U</span>
                  <ul className="m-list amber">
                    {decomposed.unresolved.map((u, i) => <li key={i}>{u}</li>)}
                  </ul>
                </div>
                <div className="lvl-card">
                  <span className="k">COMMIT CONSTRAINTS · C</span>
                  <ul className="m-list">
                    {decomposed.constraints.map((c, i) => (
                      <li key={i} className={c.satisfied ? "ok" : "no"}>
                        <span className="m-mark">{c.satisfied ? "✓" : "✕"}</span>
                        <span><strong>{c.label}</strong> <code>{c.condition}</code></span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="lvl-stat-block">
                  <span className="k">REASONING CALLS THIS MISSION</span>
                  <span className="v">0</span>
                  <span className="delta">No reasoning occurred. Deterministic policy failures go straight to COMMIT → 0 authority.</span>
                </div>
              </div>
            ) : (
              <div className="lvl-card" style={{ minHeight: 120, display: "grid", placeItems: "center" }}>
                <span className="k">AWAITING REQUEST</span>
                <p style={{ margin: "8px 0 0", fontSize: 12 }}>Type a request on the left, then click Resolve.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
