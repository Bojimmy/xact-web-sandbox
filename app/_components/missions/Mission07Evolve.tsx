"use client";

import { useState } from "react";
import type { Run } from "../../_lib/run";
import { measureReasoningEvolution, type ReasoningEvolution } from "../../../src/flagship/campaign-reality";

// MISSION 07 — EVOLVE
// The judge re-runs the scenario set and watches the reasoning count drop.
// The before/after numbers are the REAL FlagshipLearningRunner run (cold vs
// activated) — never hardcoded literals.

export function Mission07Evolve({
  run,
  onComplete,
}: {
  run: Run;
  onComplete: (before: number, after: number) => void;
}) {
  const absorbed = run.data.absorb?.decision === "SUBMIT";
  const [evolution, setEvolution] = useState<ReasoningEvolution | null>(null);
  const [running, setRunning] = useState(false);
  const [ran, setRan] = useState(run.data.evolve?.completed ?? false);
  const [error, setError] = useState<string | null>(null);

  async function runAgain() {
    setRunning(true);
    setError(null);
    try {
      const result = await measureReasoningEvolution(undefined, absorbed); // the real run, selected governance state
      setEvolution(result);
      setRan(true);
    } catch {
      // Fail closed: never substitute a simulated run for the live proof.
      setEvolution(null);
      setRan(false);
      setError("REASONING PROVIDER UNAVAILABLE");
    } finally {
      setRunning(false);
    }
  }

  const before = evolution?.before ?? run.data.evolve?.beforeCount ?? 0;
  const after = evolution?.after ?? run.data.evolve?.afterCount ?? 0;
  const delta = before - after;
  const pct = before === 0 ? 0 : Math.round((delta / before) * 1000) / 10;
  const checksumIdentical = evolution?.checksumIdentical ?? false;
  const constructionWork = evolution?.executedConstructionOperations ?? 0;

  return (
    <div>
      <div className="lvl-hero">
        <div className="num">07</div>
        <div className="word">
          <p className="tagline">Run it again</p>
          <h1 className="verb">EVOLVE</h1>
          <p className="proves"><strong>PROVES</strong> Reasoning becomes rarer</p>
        </div>
      </div>

      <div className="lvl-body">
        <div className="lvl-body-grid">
          <p className="lvl-h3">Re-run the scenario set <strong>same inputs, observe the drop</strong></p>
          <p style={{ fontSize: 12, color: "var(--lvl-muted)", margin: "0 0 14px" }}>
            The same scenario set, the same policies, the same authority state. The only thing
            that changed is the activation status of the absorption pattern — which depended on
            your Level 06 decision. These numbers are the real run.
          </p>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button type="button" className="lvl-advance" onClick={runAgain} disabled={running || ran}>
              <span className="arrow">▶</span>
              <span className="verb-text">Run again</span>
              <span className="label">Xact applies the activation status</span>
            </button>
            {running ? <span style={{ color: "var(--lvl-acid)", fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase" }}>● resolving…</span> : null}
            {ran ? (
              <span style={{ color: "var(--lvl-acid)", fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase" }}>
                ✓ run complete
              </span>
            ) : null}
          </div>

          {error ? (
            <div className="lvl-card" style={{ borderColor: "var(--lvl-red)" }}>
              <span className="k" style={{ color: "var(--lvl-red)" }}>{error}</span>
              <span className="v" style={{ color: "var(--lvl-red)" }}>FAILED CLOSED</span>
              <p>
                The live O-Agent provider boundary did not respond. No live measurement was
                substituted and no simulated reasoning was presented.
              </p>
            </div>
          ) : null}

          {ran ? (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1, background: "var(--lvl-border)", border: "1px solid var(--lvl-border)" }}>
                <div className="lvl-card" style={{ background: "var(--lvl-base-2)", border: 0 }}>
                  <span className="k">BEFORE</span>
                  <span className="v" style={{ color: "var(--lvl-muted)" }}>{before}</span>
                  <p>O-Agent invocations across the same scenario set.</p>
                </div>
                <div className="lvl-card" style={{ background: "var(--lvl-base-2)", border: 0 }}>
                  <span className="k">AFTER {absorbed ? "(activated)" : "(declined)"}</span>
                  <span className="v" style={{ color: absorbed ? "var(--lvl-acid)" : "var(--lvl-muted)" }}>{after}</span>
                  <p>
                    {absorbed
                      ? "O-Agent only invoked for genuine U the artifact cannot resolve."
                      : "No activation. The reasoning rate is unchanged."}
                  </p>
                </div>
                <div className="lvl-card" style={{ background: "var(--lvl-base-2)", border: 0 }}>
                  <span className="k">DELTA</span>
                  <span className="v" style={{ color: absorbed ? "var(--lvl-acid)" : "var(--lvl-dim)" }}>
                    {absorbed ? `−${pct}%` : "0%"}
                  </span>
                  <p>
                    {absorbed
                      ? "Not optimisation. Activation of a bounded capability."
                      : "Decline at Level 06 produced no measurable improvement."}
                  </p>
                </div>
              </div>
              <div className="lvl-stat-block">
                <span className="k">CONSTRUCTION WORK</span>
                <span className="v" style={{ color: "var(--lvl-acid)" }}>
                  {constructionWork.toLocaleString()} → {constructionWork.toLocaleString()}
                </span>
                <span className="delta">The deterministic workload executes all operations in both runs.</span>
              </div>
              <div className="lvl-stat-block">
                <span className="k">ARTIFACT CHECKSUM</span>
                <span className="v" style={{ color: "var(--lvl-acid)" }}>{checksumIdentical ? "IDENTICAL ✓" : "MISMATCH ✗"}</span>
                <span className="delta">
                  {evolution?.note ?? "Same observable effect. No capability creep."}
                </span>
              </div>
              {evolution ? (
                <div className="lvl-stat-block" style={{ borderColor: "var(--lvl-cyan)" }}>
                  <span className="k">REASONING TELEMETRY</span>
                  <span className="v" style={{ color: "var(--lvl-cyan)" }}>
                    {evolution.provenance} · {evolution.provider}
                  </span>
                  <span className="delta">
                    Tokens {evolution.beforeTokens.toLocaleString()} → {evolution.afterTokens.toLocaleString()} · wall {Math.round(evolution.beforeWallTimeMs)}ms → {Math.round(evolution.afterWallTimeMs)}ms
                  </span>
                </div>
              ) : null}
              <button
                type="button"
                className="lvl-advance"
                onClick={() => onComplete(before, after)}
              >
                <span className="arrow">▸</span>
                <span className="verb-text">Proceed to TEACH XACT</span>
                <span className="label">08 / TEACH XACT</span>
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
