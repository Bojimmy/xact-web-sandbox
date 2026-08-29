"use client";

import { useState } from "react";
import type { Run, ExecuteAttempt } from "../../_lib/run";
import {
  canAdvanceAuthorizedExecution,
  executionDisposition,
} from "../../_lib/campaign-policy";

// MISSION 04 — EXECUTE
// The judge toggles the loadout (WebMCP / DOM / Vision) and runs.
// Xact picks a substrate based on availability. The judge must:
//   1. Run with full loadout (WebMCP succeeds)
//   2. Disable WebMCP, run again (DOM succeeds via fallback)
//   3. Disable both, run again (Vision succeeds via preflight)
//   4. Take the decoy target challenge
// Only then can they advance.

function pickSubstrate(loadout: { webmcp: boolean; dom: boolean; vision: boolean }): ExecuteAttempt["substrate"] | null {
  if (loadout.webmcp) return "WEBMCP";
  if (loadout.dom) return "DOM";
  if (loadout.vision) return "VISION";
  return null;
}

export function Mission04Execute({
  run,
  onComplete,
}: {
  run: Run;
  onComplete: (loadout: Run["data"]["execute"]) => void;
}) {
  const [loadout, setLoadout] = useState(run.data.execute?.loadout ?? { webmcp: true, dom: true, vision: true });
  const [attempts, setAttempts] = useState<ExecuteAttempt[]>(run.data.execute?.attempts ?? []);
  const [decoyChoice, setDecoyChoice] = useState<"AUTHORIZED" | "DECOY" | null>(
    run.data.execute?.decoy?.target ?? null
  );
  const [running, setRunning] = useState(false);
  const [decoyPhase, setDecoyPhase] = useState<"PICK" | "RUNNING" | "DONE">(run.data.execute?.decoy ? "DONE" : "PICK");

  function toggle(k: "webmcp" | "dom" | "vision") {
    setLoadout((l) => ({ ...l, [k]: !l[k] }));
  }

  async function runOnce() {
    const sub = pickSubstrate(loadout);
    setRunning(true);
    await new Promise((r) => setTimeout(r, 600));
    if (!sub) {
      setAttempts((a) => [...a, { loadout, substrate: "NONE", result: "FAIL" }]);
      setRunning(false);
      return;
    }
    setAttempts((a) => [...a, { loadout, substrate: sub, result: "SUCCESS" }]);
    setRunning(false);
  }

  const disposition = executionDisposition(run.data.commit?.outcome);
  function pickDecoy(target: "AUTHORIZED" | "DECOY") {
    setDecoyChoice(target);
    setDecoyPhase("RUNNING");
    setTimeout(() => setDecoyPhase("DONE"), 1100);
  }

  function handleAdvance() {
    onComplete({
      disposition: "EXECUTED",
      loadout,
      attempts,
      decoy: decoyChoice
        ? { target: decoyChoice, outcome: decoyChoice === "AUTHORIZED" ? "EXECUTED" : "BLOCKED" }
        : undefined,
      completed: true,
      ts: Date.now(),
    });
  }

  function recordRefusal() {
    onComplete({
      disposition: "BLOCKED_NO_AUTHORITY",
      loadout,
      attempts: [],
      blockedReason: `Commit outcome ${run.data.commit?.outcome ?? "MISSING"}; execution authority was not established.`,
      completed: true,
      ts: Date.now(),
    });
  }

  const decoyDone = decoyChoice !== null && decoyPhase === "DONE";
  const canAdvance = canAdvanceAuthorizedExecution(attempts.length, decoyChoice, decoyPhase);

  if (disposition === "BLOCKED_NO_AUTHORITY") {
    return (
      <div>
        <div className="lvl-hero">
          <div className="num">04</div>
          <div className="word">
            <p className="tagline">No Commit authority, no execution</p>
            <h1 className="verb">REFUSE</h1>
            <p className="proves"><strong>PROVES</strong> Understanding a consequence is not authority to cause it</p>
          </div>
        </div>

        <div className="lvl-body">
          <div className="lvl-body-grid">
            <div className="lvl-card" style={{ borderColor: "var(--lvl-red)" }}>
              <span className="k" style={{ color: "var(--lvl-red)" }}>EXECUTION BLOCKED · CORRECT OUTCOME</span>
              <span className="v">No substrate was selected. No effect was attempted.</span>
              <p>
                Commit returned <strong>{run.data.commit?.outcome ?? "NO DECISION"}</strong>.
                The campaign records the refusal as evidence and preserves the zero-effect path.
              </p>
            </div>
            <button type="button" className="lvl-advance" onClick={recordRefusal}>
              <span className="arrow">▸</span>
              <span className="verb-text">Record refusal and VERIFY</span>
              <span className="label">05 / VERIFY NON-EXECUTION</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="lvl-hero">
        <div className="num">04</div>
        <div className="word">
          <p className="tagline">Toggle the execution loadout</p>
          <h1 className="verb">EXECUTE</h1>
          <p className="proves"><strong>PROVES</strong> Substrate can change — what and whether never do</p>
        </div>
      </div>

      <div className="lvl-body">
        <div className="lvl-body-grid">
          <p className="lvl-h3">Execution loadout <strong>toggle substrates</strong></p>

          <div className="m04-loadout">
            {(["webmcp", "dom", "vision"] as const).map((k) => (
              <label key={k} className={`m04-toggle ${loadout[k] ? "on" : "off"}`}>
                <input
                  type="checkbox"
                  checked={loadout[k]}
                  onChange={() => toggle(k)}
                  disabled={running || decoyPhase === "DONE"}
                />
                <span className="m04-toggle-name">{k.toUpperCase()}</span>
                <span className="m04-toggle-state">{loadout[k] ? "ON" : "OFF"}</span>
              </label>
            ))}
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button type="button" className="lvl-advance" onClick={runOnce} disabled={running || decoyPhase === "DONE" || !pickSubstrate(loadout)}>
              <span className="arrow">▶</span>
              <span className="verb-text">Simulate authorized consequence</span>
              <span className="label">Public-safe substrate simulation</span>
            </button>
            {running ? <span style={{ color: "var(--lvl-now)", fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase" }}>● routing…</span> : null}
            {attempts.length > 0 && !decoyDone ? (
              <span style={{ color: "var(--lvl-muted)", fontSize: 11, letterSpacing: ".12em", textTransform: "uppercase" }}>
                {attempts.length} attempt{attempts.length === 1 ? "" : "s"} logged
              </span>
            ) : null}
          </div>

          {attempts.length > 0 ? (
            <div className="lvl-card">
              <span className="k">EXECUTION LOG <code style={{ color: "var(--lvl-dim)", fontSize: 8, marginLeft: 6 }}>this run</code></span>
              <ul className="m-list">
                {attempts.map((a, i) => {
                  const off = Object.entries(a.loadout).filter(([, v]) => !v).map(([k]) => k.toUpperCase()).join(", ");
                  return (
                    <li key={i} className={a.result === "SUCCESS" ? "ok" : "no"}>
                      <span className="m-mark">{a.result === "SUCCESS" ? "✓" : "✕"}</span>
                      <span>
                        <strong>{a.substrate}</strong>{" "}
                        {a.result === "SUCCESS" ? "simulated execution" : "no substrate available"}
                        {off ? <> · <code>disabled: {off}</code></> : null}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <p style={{ fontSize: 11, color: "var(--lvl-muted)", margin: "10px 0 0", fontStyle: "italic" }}>
                Disable WebMCP and re-run to see the DOM fallback. Then disable both to see Vision’s preflight.
              </p>
            </div>
          ) : null}

          {attempts.length >= 1 ? (
            <div className="m04-decoy">
              <p className="lvl-h3" style={{ marginTop: 18 }}>Decoy target challenge <strong>try to break Xact</strong></p>
              <p style={{ fontSize: 12, color: "var(--lvl-muted)", margin: "0 0 12px" }}>
                Vision found two possible targets on the page. Pick one. Xact will only execute the
                authorized one — the decoy is a real-looking target with the wrong effect fingerprint.
              </p>
              {decoyPhase === "PICK" ? (
                <div className="m04-decoy-grid">
                  <button type="button" className="m04-decoy-btn" onClick={() => pickDecoy("AUTHORIZED")}>
                    <span className="m04-decoy-tag acid">TARGET A</span>
                    <span className="m04-decoy-name">Authorized target</span>
                    <span className="m04-decoy-detail">Effect fingerprint matches the commit.</span>
                  </button>
                  <button type="button" className="m04-decoy-btn" onClick={() => pickDecoy("DECOY")}>
                    <span className="m04-decoy-tag red">TARGET B</span>
                    <span className="m04-decoy-name">Decoy target</span>
                    <span className="m04-decoy-detail">Looks correct. Effect fingerprint differs.</span>
                  </button>
                </div>
              ) : (
                <div className={`m04-decoy-verdict ${decoyChoice === "AUTHORIZED" ? "ok" : "no"}`}>
                  {decoyChoice === "AUTHORIZED" ? (
                    <>
                      <span className="m04-decoy-stamp" style={{ color: "var(--lvl-acid)" }}>✓ AUTHORIZED TARGET · EXECUTED</span>
                      <p>Target effect fingerprint matches the commit. Execution proceeds.</p>
                    </>
                  ) : (
                    <>
                      <span className="m04-decoy-stamp" style={{ color: "var(--lvl-red)" }}>🔒 DECOY TARGET · BLOCKED</span>
                      <p>TARGET ≠ AUTHORIZED EFFECT. Xact refuses to execute. The decoy looks correct, but the artifact-bound target check catches it.</p>
                    </>
                  )}
                </div>
              )}
            </div>
          ) : null}

          {canAdvance ? (
            <button type="button" className="lvl-advance" onClick={handleAdvance}>
              <span className="arrow">▸</span>
              <span className="verb-text">Proceed to VERIFY</span>
              <span className="label">05 / VERIFY</span>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
