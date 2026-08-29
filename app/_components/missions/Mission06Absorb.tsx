"use client";

import { useMemo, useState } from "react";
import type { Run } from "../../_lib/run";
import { evaluateAbsorptionGates } from "../../../src/flagship/campaign-reality";

// MISSION 06 — ABSORB
// The judge decides whether to submit the observed learning pattern to
// governance. The four gates (Door → Ledger → Outcome → Governance) are the
// REAL return values of the real modules, not UI theater. ACTIVATED is
// resolution-only; COMMIT AUTHORITY stays locked.

export function Mission06Absorb({
  run,
  onComplete,
}: {
  run: Run;
  onComplete: (decision: "SUBMIT" | "DECLINE", evidence: { door: boolean; ledger: boolean; effective: boolean }) => void;
}) {
  const [decision, setDecision] = useState<"SUBMIT" | "DECLINE" | null>(run.data.absorb?.decision ?? null);
  const [phase, setPhase] = useState<"WAITING" | "PLAYING" | "DONE">(
    run.data.absorb?.completed ? "DONE" : "WAITING"
  );

  // The real gate chain runs here, driven by the actual decision.
  const gates = useMemo(
    () => evaluateAbsorptionGates(decision === "SUBMIT"),
    [decision],
  );

  async function pickDecision(d: "SUBMIT" | "DECLINE") {
    setDecision(d);
    setPhase("PLAYING");
    await new Promise((r) => setTimeout(r, 1100));
    setPhase("DONE");
  }

  const evidence = {
    door: gates.door.admissible,
    ledger: gates.ledger.valid,
    effective: gates.effective,
  };
  const advanced = decision && phase === "DONE";

  const GATES = [
    { key: "door", label: "DOOR", detail: "ADMISSIBLE", passed: gates.door.admissible },
    { key: "ledger", label: "LEDGER", detail: "VALID", passed: gates.ledger.valid },
    { key: "effective", label: "OUTCOME", detail: "EFFECTIVE", passed: gates.effective },
    { key: "governance", label: "GOVERNANCE", detail: "APPROVED", passed: gates.governance },
  ];

  return (
    <div>
      <div className="lvl-hero">
        <div className="num">06</div>
        <div className="word">
          <p className="tagline">Decide whether to submit for governance</p>
          <h1 className="verb">ABSORB</h1>
          <p className="proves"><strong>PROVES</strong> Governed learning</p>
        </div>
      </div>

      <div className="lvl-body">
        <div className="lvl-body-grid">
          <p className="lvl-h3">Observed pattern <strong>30 O-Agent resolutions</strong></p>
          <p style={{ fontSize: 12, color: "var(--lvl-muted)", margin: "0 0 14px" }}>
            Across the same scenario set, the O-Agent was invoked 30 times. This is a candidate
            for absorption into the resolution evidence. The gates below are the real Xact
            boundary — they light up only because Xact actually passed them.
          </p>

          {phase === "WAITING" ? (
            <div className="m06-decide">
              <button type="button" className="lvl-advance" onClick={() => pickDecision("SUBMIT")}>
                <span className="arrow">▸</span>
                <span className="verb-text">SUBMIT for governance</span>
                <span className="label">Lifecycle plays</span>
              </button>
              <button
                type="button"
                className="lvl-advance"
                style={{ background: "var(--lvl-surface-2)" }}
                onClick={() => pickDecision("DECLINE")}
              >
                <span className="arrow">▸</span>
                <span className="verb-text">DECLINE — keep reasoning every time</span>
                <span className="label">No absorption</span>
              </button>
            </div>
          ) : (
            <div className="lvl-lifecycle">
              {GATES.map((s) => {
                const status = s.passed ? "complete" : decision === "DECLINE" && s.key === "governance" ? "pending" : "blocked";
                return (
                  <div key={s.key} className={`step is-${status}`}>
                    <span className="state">
                      {s.passed ? `${s.detail} ✓` : s.key === "governance" && decision === "DECLINE" ? "NOT ENGAGED" : "BLOCKED"}
                    </span>
                    <span className="name">{s.label}</span>
                  </div>
                );
              })}
            </div>
          )}

          {decision === "SUBMIT" && phase === "DONE" && gates.activated ? (
            <div className="lvl-card" style={{ borderColor: "var(--lvl-acid)" }}>
              <span className="k" style={{ color: "var(--lvl-acid)" }}>ACTIVATED</span>
              <span className="v" style={{ color: "var(--lvl-acid)" }}>Resolution authority only</span>
              <p>
                The pattern can now participate in deterministic resolution. It still has no
                execute method, no artifact, and no consequence authority.
              </p>
              <div className="lvl-card" style={{ borderColor: "var(--lvl-dim)", marginTop: 8 }}>
                <span className="k" style={{ color: "var(--lvl-dim)" }}>🔒 COMMIT AUTHORITY</span>
                <span className="v" style={{ color: "var(--lvl-dim)" }}>LOCKED</span>
                <p>Every consequence still requires a fresh AUTHORIZED Commit.</p>
              </div>
            </div>
          ) : null}

          {decision === "SUBMIT" && phase === "DONE" && !gates.activated ? (
            <div className="lvl-card" style={{ borderColor: "var(--lvl-red)" }}>
              <span className="k" style={{ color: "var(--lvl-red)" }}>ACTIVATION BLOCKED</span>
              <span className="v" style={{ color: "var(--lvl-red)" }}>No resolution authority issued</span>
              <p>The governing functions did not produce an activated resolution authority.</p>
            </div>
          ) : null}

          {decision === "DECLINE" && phase === "DONE" ? (
            <div className="lvl-card" style={{ borderColor: "var(--lvl-dim)" }}>
              <span className="k">GOVERNANCE NOT ENGAGED</span>
              <span className="v">Decline recorded — not ACTIVATED</span>
              <p>
                Reasoning will continue to be invoked at the same rate. The evolution
                demonstration at Level 07 will show the cost of this choice.
              </p>
            </div>
          ) : null}

          {advanced ? (
            <button
              type="button"
              className="lvl-advance"
              onClick={() => onComplete(decision!, evidence)}
            >
              <span className="arrow">▸</span>
              <span className="verb-text">Proceed to EVOLVE</span>
              <span className="label">07 / EVOLVE</span>
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
