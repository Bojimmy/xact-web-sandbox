"use client";

import { useEffect } from "react";

// The dramatic full-bleed transition that appears between levels.
// Three variants:
//   "experience" → "EXPERIENCE GAINED" with a stat
//   "evolved"    → "XACT EVOLVED" with before/after numbers
//   "activated"  → "ABILITY ACTIVATED" with the dry qualifier
//   "evolve-stat"→ "−86.7%" headline stat (used for level 07)
export type TransitionKind = "experience" | "evolved" | "activated" | "evolve-stat" | "complete";

export function TransitionScreen({
  kind,
  stamp,
  headline,
  stat,
  before,
  after,
  qualifier,
  verdict,
  onContinue,
  autoContinueMs,
}: {
  kind: TransitionKind;
  stamp: string;
  headline?: string;
  stat?: string;
  before?: string;
  after?: string;
  qualifier?: string;
  verdict?: string;
  onContinue?: () => void;
  autoContinueMs?: number;
}) {
  useEffect(() => {
    if (!autoContinueMs || !onContinue) return;
    const id = window.setTimeout(onContinue, autoContinueMs);
    return () => window.clearTimeout(id);
  }, [autoContinueMs, onContinue]);

  return (
    <div className="lvl-transition" role="dialog" aria-live="assertive" aria-label={stamp}>
      <div style={{ textAlign: "center", maxWidth: 760, width: "100%" }}>
        <span className="stamp">{stamp}</span>

        {kind === "experience" && (
          <>
            <h1 className="reveal">{headline ?? "OBSERVED"}</h1>
            <div className="big-stat">{stat}</div>
            <p className="label">{verdict}</p>
          </>
        )}

        {kind === "evolved" && (
          <>
            <h1 className="reveal" style={{ color: "var(--lvl-acid)" }}>{headline ?? "XACT EVOLVED"}</h1>
            <div className="before-after">
              <div className="from">{before}</div>
              <div className="arrow">→</div>
              <div className="to">{after}</div>
            </div>
            {stat ? <div className="big-stat">{stat}</div> : null}
            {verdict ? <p className="verdict"><strong>{verdict}</strong></p> : null}
          </>
        )}

        {kind === "activated" && (
          <>
            <h1 className="reveal" style={{ color: "var(--lvl-acid)" }}>{headline ?? "ABILITY ACTIVATED"}</h1>
            <p className="label" style={{ marginBottom: 24 }}>{verdict}</p>
            {qualifier ? <p className="qualifier">{qualifier}</p> : null}
          </>
        )}

        {kind === "evolve-stat" && (
          <>
            <h1 className="reveal" style={{ color: "var(--lvl-muted)" }}>{headline ?? "REASONING REDUCTION"}</h1>
            <div className="big-stat">{stat}</div>
            <p className="label">{verdict}</p>
            {qualifier ? <p className="qualifier">{qualifier}</p> : null}
          </>
        )}

        {kind === "complete" && (
          <>
            <h1 className="reveal" style={{ color: "var(--lvl-text)" }}>{headline ?? "LEVEL COMPLETE"}</h1>
            {stat ? <div className="big-stat" style={{ fontSize: "clamp(64px, 9vw, 120px)" }}>{stat}</div> : null}
            {verdict ? <p className="verdict">{verdict}</p> : null}
            {qualifier ? <p className="qualifier">{qualifier}</p> : null}
          </>
        )}

        {onContinue ? (
          <button type="button" className="continue" onClick={onContinue}>
            Continue ▸
          </button>
        ) : null}
      </div>
    </div>
  );
}
