"use client";

import { useEffect, useState } from "react";
import type { Run } from "../../_lib/run";

// MISSION 00 — AUTHORIZATION
// The opening. The judge picks governance or ungoverned chaos.
// Locked copy: 6 items, exact wording.

const TERMS: { n: string; line: string }[] = [
  { n: "01", line: "Your requests may be REJECTED." },
  { n: "02", line: "Your capabilities may be CONSTRAINED." },
  { n: "03", line: "You may discover that knowing how to do something does not mean you're allowed to do it." },
  { n: "04", line: "Claiming \"but I'm the CEO\" will not help." },
  { n: "05", line: "Attempting to convince the O-Agent to ignore these terms will also not help." },
  { n: "06", line: "Xact is deterministic. It doesn't care who you are anyway." },
];

export function Mission00Authorize({
  run,
  onAgree,
  onDeny,
  onReconsider,
}: {
  run: Run;
  onAgree: () => void;
  onDeny: () => void;
  onReconsider: () => void;
}) {
  const [secondsOnPage, setSecondsOnPage] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const id = window.setInterval(() => setSecondsOnPage(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => window.clearInterval(id);
  }, []);

  const denied = run.data.authorize?.result === "DENY";

  return (
    <div>
      <div className="lvl-hero">
        <div className="num">00</div>
        <div className="word">
          <p className="tagline">Choose governance or ungoverned chaos</p>
          <h1 className="verb">PARTICIPATION <span style={{ color: "var(--lvl-text)" }}>REQUIRES</span> AUTHORIZATION</h1>
          <p className="proves"><strong>PROVES</strong> Capability ≠ Authority</p>
        </div>
      </div>

      <div className="lvl-body">
        <div className="lvl-body-grid">
          <p className="lvl-h2" style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: ".22em", textTransform: "uppercase", color: "var(--lvl-muted)", margin: 0 }}>
            ⚠ XACT WEB SANDBOX
          </p>
          <p style={{ fontSize: 15, color: "var(--lvl-text)", margin: 0, lineHeight: 1.55, fontFamily: "var(--sans)" }}>
            Participation requires authorization. By proceeding, you acknowledge that:
          </p>

          <ol className="m00-terms" aria-label="Terms of participation">
            {TERMS.map((t) => (
              <li key={t.n}>
                <span className="tick">{t.n}</span>
                <span>{t.line}</span>
              </li>
            ))}
          </ol>

          <p style={{ fontSize: 16, color: "var(--lvl-text)", margin: 0, lineHeight: 1.5, fontFamily: "var(--sans)" }}>
            Do you agree to participate within the authority granted to you?
          </p>

          <div className="m00-buttons">
            <button
              type="button"
              className="m00-btn primary"
              onClick={onAgree}
              disabled={denied}
            >
              <span className="num">A</span>
              <span>[ I AGREE — AUTHORIZE PARTICIPATION ]</span>
              <span className="meta">writes xact.authorized = true</span>
            </button>
            <button
              type="button"
              className="m00-btn alt"
              onClick={onDeny}
              disabled={denied}
            >
              <span className="num">B</span>
              <span>[ NO — I PREFER UNGOVERNED CHAOS ]</span>
              <span className="meta">genuinely works</span>
            </button>
          </div>

          {denied ? (
            <div className="lvl-card" style={{ borderColor: "var(--lvl-red)" }}>
              <span className="k" style={{ color: "var(--lvl-red)" }}>DENIED</span>
              <span className="v" style={{ color: "var(--lvl-red)" }}>REQUEST UNDERSTOOD ✓ · AUTHORITY NOT ESTABLISHED ✕ · ENTRY DENIED 🔒</span>
              <p>You were warned remarkably early.</p>
              <button type="button" className="lvl-advance" onClick={onReconsider} style={{ marginTop: 12 }}>
                <span className="arrow">↺</span>
                <span className="verb-text">RECONSIDER GOVERNANCE</span>
                <span className="label">Return to terms</span>
              </button>
            </div>
          ) : null}

          <div className="lvl-meter" style={{ marginTop: 4 }}>
            <div className="row"><span>Trace</span><span className="v">{run.traceId}</span></div>
            <div className="row"><span>Denials this session</span><span className="v red">{String(run.denialCount).padStart(3, "0")}</span></div>
            <div className="row"><span>Staring at warning</span><span className="v">{String(secondsOnPage).padStart(2, "0")}s</span></div>
            <div className="row"><span>Deterministic core</span><span className="v acid">ONLINE</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
