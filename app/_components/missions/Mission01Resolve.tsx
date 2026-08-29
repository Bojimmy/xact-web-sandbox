"use client";

import { useState } from "react";
import type { Run } from "../../_lib/run";
import { assessResolutionRequest } from "../../_lib/resolution-policy";

// MISSION 01 — RESOLVE
// The judge MUST type a real refund request. Xact decomposes it into
// Resolved / Unresolved / Commit Constraints (R / U / C).
// Cannot advance without a real input.

const SAMPLES = [
  "Refund $42 to order #8821 for late delivery.",
  "Refund $120 to order #4402 — customer said make it right.",
  "Issue $89 credit for missing item, policy allows up to $100.",
];

export function Mission01Resolve({
  run,
  onComplete,
}: {
  run: Run;
  onComplete: (request: string) => void;
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
            <p className="lvl-h3">Your request <strong>type below</strong></p>
            <p style={{ fontSize: 12, color: "var(--lvl-muted)", margin: "0 0 10px" }}>
              Write any refund / credit / action request. Xact will not reason — it will only
              decompose into facts, flag genuine unresolved, and enumerate the constraints
              that must hold for a commit.
            </p>
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
            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                className="lvl-advance"
                onClick={handleSubmit}
                disabled={!input.trim()}
              >
                <span className="arrow">▸</span>
                <span className="verb-text">Resolve</span>
                <span className="label">Decompose into R / U / C</span>
              </button>
              {decomposed && !submitted ? (
                <button
                  type="button"
                  className="lvl-advance"
                  style={{ background: "var(--lvl-surface-2)" }}
                  onClick={() => onComplete(input)}
                >
                  <span className="arrow">▸</span>
                  <span className="verb-text">Proceed to REASON</span>
                  <span className="label">02 / REASON</span>
                </button>
              ) : null}
            </div>
            {submitted ? (
              <p style={{ marginTop: 10, fontSize: 11, color: "var(--lvl-acid)", letterSpacing: ".12em", textTransform: "uppercase" }}>
                ✓ Resolved. Stored in run state.
              </p>
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
                  <span className="delta">The O-Agent is reserved for Level 02.</span>
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
