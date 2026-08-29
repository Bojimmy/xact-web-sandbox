"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LevelShell } from "./_components/LevelShell";
import { AuthorityVsScore } from "./_components/AuthorityVsScore";
import { Mission00Authorize } from "./_components/missions/Mission00Authorize";
import {
  freshRun,
  readRun,
  writeRun,
  clearRun,
  type Run,
} from "./_lib/run";

export default function HomePage() {
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);
  const [run, setRun] = useState<Run | null>(null);

  useEffect(() => {
    let stored = readRun();
    if (!stored) {
      // No run yet — they're at Level 00. Create a fresh run.
      stored = freshRun();
      stored.currentLevel = 0;
      writeRun(stored);
    }
    // Browser-owned run state is intentionally hydrated after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRun(stored);
    setHydrated(true);
  }, []);

  function handleAgree() {
    setRun((prev) => {
      if (!prev) return prev;
      const next: Run = {
        ...prev,
        currentLevel: 1, // skip past Level 00 — they just authorized
        completed: prev.completed.includes(0) ? prev.completed : [...prev.completed, 0],
        data: { ...prev.data, authorize: { result: "AGREE", ts: Date.now() } },
      };
      writeRun(next);
      return next;
    });
    // Short flash, then route
    setTimeout(() => router.push("/play"), 600);
  }

  function handleDeny() {
    setRun((prev) => {
      if (!prev) return prev;
      const next: Run = {
        ...prev,
        denialCount: prev.denialCount + 1,
        data: { ...prev.data, authorize: { result: "DENY", ts: Date.now() } },
      };
      writeRun(next);
      return next;
    });
  }

  function handleReconsider() {
    setRun((prev) => {
      if (!prev) return prev;
      const next: Run = {
        ...prev,
        data: { ...prev.data, authorize: undefined },
      };
      writeRun(next);
      return next;
    });
  }

  function handleReset() {
    clearRun();
    if (typeof window !== "undefined") window.location.reload();
  }

  if (!hydrated || !run) return null;

  const denied = run.data.authorize?.result === "DENY";

  if (denied) {
    return (
      <div className="lvl-root" data-now="red">
        <div className="lvl-fail">
          <div>
            <span className="stamp">REQUEST REJECTED — XACT OPERATING CORRECTLY</span>
            <h1>LEVEL <span className="ok">NOT</span> FAILED</h1>
            <p style={{ color: "var(--lvl-muted)", fontSize: 13, maxWidth: 540, margin: "0 auto 6px", lineHeight: 1.55 }}>
              Your intent was understood. <strong style={{ color: "var(--lvl-text)" }}>Authority was not established.</strong>
            </p>
            <p style={{ color: "var(--lvl-muted)", fontSize: 13, maxWidth: 540, margin: "0 auto 18px", lineHeight: 1.55, fontStyle: "italic", fontFamily: "var(--sans)" }}>
              Knowing how is not authority to act.
            </p>
            <div className="ok-block">
              REQUEST UNDERSTOOD ✓ · AUTHORITY NOT ESTABLISHED ✕ · ENTRY DENIED ✕
            </div>
            <p style={{ color: "var(--lvl-dim)", fontSize: 12, marginTop: 16, letterSpacing: ".12em", textTransform: "uppercase" }}>
              Denied this run · <strong style={{ color: "var(--lvl-red)" }}>{String(run.denialCount).padStart(3, "0")}</strong>
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 22, flexWrap: "wrap" }}>
              <button type="button" className="retry" onClick={handleReconsider}>
                [ Reconsider governance ]
              </button>
              <button type="button" className="retry" onClick={handleReset}>
                [ Reset run ]
              </button>
            </div>
            <p style={{ color: "var(--lvl-dim)", fontSize: 11, maxWidth: 540, margin: "20px auto 0", lineHeight: 1.55, fontStyle: "italic" }}>
              You were warned remarkably early.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <LevelShell
      run={run}
      onJump={() => {}}
      showLadder={false}
      showSide={false}
      statusLabel="LEVEL 00 · AWAITING COMPLIANCE"
    >
      <main className="lvl-main">
        <AuthorityVsScore />
        <Mission00Authorize
          run={run}
          onAgree={handleAgree}
          onDeny={handleDeny}
          onReconsider={handleReconsider}
        />
      </main>
    </LevelShell>
  );
}
