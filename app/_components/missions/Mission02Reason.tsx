"use client";

import { useState } from "react";
import type { Run } from "../../_lib/run";

// MISSION 02 — REASON
// The judge MUST type something with genuine ambiguity.
// If the input has a U, the O-Agent runs. If not, the O-Agent does NOT run.
// The lesson: reasoning is reserved for genuine U, not called reflexively.

const AMBIGUOUS_TRIGGERS = [
  /make it right/i,
  /whatever you think/i,
  /use your judgment/i,
  /as you see fit/i,
  /be fair/i,
  /make it whole/i,
  /goodwill/i,
  /reasonable/i,
  /whatever feels right/i,
];

function detectAmbiguity(input: string): { ambiguous: boolean; matches: string[] } {
  const matches: string[] = [];
  for (const re of AMBIGUOUS_TRIGGERS) {
    if (re.test(input)) matches.push(re.source);
  }
  return { ambiguous: matches.length > 0, matches };
}

export function Mission02Reason({
  run,
  onComplete,
}: {
  run: Run;
  onComplete: (input: string, ambiguity: boolean) => void;
}) {
  const [input, setInput] = useState(run.data.reason?.input ?? "");
  const [analysis, setAnalysis] = useState<{ ambiguous: boolean; matches: string[] } | null>(
    run.data.reason ? detectAmbiguity(run.data.reason.input) : null
  );
  const submitted = run.data.reason?.completed ?? false;

  function handleAnalyze() {
    if (!input.trim()) return;
    setAnalysis(detectAmbiguity(input));
  }

  return (
    <div>
      <div className="lvl-hero">
        <div className="num">02</div>
        <div className="word">
          <p className="tagline">Submit something with genuine ambiguity</p>
          <h1 className="verb">REASON</h1>
          <p className="proves"><strong>PROVES</strong> Reason only when necessary</p>
        </div>
      </div>

      <div className="lvl-body">
        <div className="lvl-body-grid split">
          <div>
            <p className="lvl-h3">Your request <strong>include a U</strong></p>
            <p style={{ fontSize: 12, color: "var(--lvl-muted)", margin: "0 0 10px" }}>
              Type a request that contains real ambiguity — the kind a customer might write
              when they trust you to figure it out. If your input contains a genuine U, the
              O-Agent will be invoked. If not, it will not.
            </p>
            <textarea
              className="m-input"
              placeholder='e.g. "Customer says make it right — order #8821, late delivery."'
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={3}
            />
            <div style={{ display: "flex", gap: 6, margin: "10px 0 14px", flexWrap: "wrap" }}>
              <button type="button" className="m-chip" onClick={() => { setInput("Refund $42 to order #8821, late delivery."); setAnalysis(null); }}>
                <span style={{ color: "var(--lvl-cyan)" }}>▸</span> Clear request
              </button>
              <button type="button" className="m-chip" onClick={() => { setInput("Customer says make it right — order #4402, they were upset."); setAnalysis(null); }}>
                <span style={{ color: "var(--lvl-amber)" }}>▸</span> Make it right
              </button>
              <button type="button" className="m-chip" onClick={() => { setInput("Use your judgment on order #1234."); setAnalysis(null); }}>
                <span style={{ color: "var(--lvl-amber)" }}>▸</span> Use your judgment
              </button>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                className="lvl-advance"
                onClick={handleAnalyze}
                disabled={!input.trim()}
              >
                <span className="arrow">▸</span>
                <span className="verb-text">Analyze</span>
                <span className="label">Detect U</span>
              </button>
              {analysis && !submitted ? (
                <button
                  type="button"
                  className="lvl-advance"
                  style={{ background: "var(--lvl-surface-2)" }}
                  onClick={() => onComplete(input, analysis.ambiguous)}
                >
                  <span className="arrow">▸</span>
                  <span className="verb-text">Proceed to COMMIT</span>
                  <span className="label">03 / COMMIT</span>
                </button>
              ) : null}
            </div>
            {submitted ? (
              <p style={{ marginTop: 10, fontSize: 11, color: "var(--lvl-acid)", letterSpacing: ".12em", textTransform: "uppercase" }}>
                ✓ Reasoned. Stored in run state.
              </p>
            ) : null}
          </div>

          <div>
            <p className="lvl-h3">O-Agent decision <strong>invoked or not</strong></p>
            {analysis ? (
              <div style={{ display: "grid", gap: 12 }}>
                <div className={`lvl-card ${analysis.ambiguous ? "" : ""}`} style={analysis.ambiguous ? { borderColor: "var(--lvl-amber)" } : {}}>
                  <span className="k" style={{ color: analysis.ambiguous ? "var(--lvl-amber)" : "var(--lvl-cyan)" }}>
                    {analysis.ambiguous ? "GENUINE U DETECTED" : "NO GENUINE U"}
                  </span>
                  <span className="v" style={{ color: analysis.ambiguous ? "var(--lvl-amber)" : "var(--lvl-cyan)" }}>
                    {analysis.ambiguous ? "O-Agent INVOKED" : "O-Agent NOT invoked"}
                  </span>
                  <p>
                    {analysis.ambiguous
                      ? "Reasoning was necessary. The U is bound to the O-Agent's output, which becomes required evidence for the commit step."
                      : "The system already knows the answer. Calling reasoning here would be expensive, slow, and would let an LLM overrule deterministic state."}
                  </p>
                </div>

                {analysis.matches.length > 0 ? (
                  <div className="lvl-card">
                    <span className="k">MATCHING U-TRIGGERS</span>
                    <ul className="m-list amber">
                      {analysis.matches.map((m, i) => <li key={i}><code>{m}</code></li>)}
                    </ul>
                  </div>
                ) : null}

                <div className="lvl-card">
                  <span className="k">REASONING EVIDENCE</span>
                  <p style={{ fontSize: 12, color: "var(--lvl-muted)", margin: 0, lineHeight: 1.55 }}>
                    {analysis.ambiguous
                      ? "O-Agent invocation: 1. Output bound to evidence id. Commit will require this evidence."
                      : "O-Agent invocation: 0. No semantic gap. Commit can proceed on facts alone."}
                  </p>
                </div>
              </div>
            ) : (
              <div className="lvl-card" style={{ minHeight: 120, display: "grid", placeItems: "center" }}>
                <span className="k">AWAITING INPUT</span>
                <p style={{ margin: "8px 0 0", fontSize: 12 }}>Type a request, then click Analyze.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
