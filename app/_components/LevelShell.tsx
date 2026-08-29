"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { LevelLadder } from "./LevelLadder";
import type { Run } from "../_lib/run";
import { LEVELS } from "../_lib/levels";

export function LevelShell({
  run,
  onJump,
  side,
  statusLabel,
  showLadder = true,
  showSide = true,
  children,
}: {
  run: Run;
  onJump: (i: number) => void;
  side?: ReactNode;
  statusLabel?: string;
  showLadder?: boolean;
  showSide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="lvl-root" data-now={LEVELS[run.currentLevel]?.accent ?? "cyan"}>
      <header className="lvl-top">
        <Link className="brand" href="/" aria-label="Xact campaign home">
          <span className="x">X</span>
          <strong>XACT</strong>
        </Link>
        <div className="center">
          <span className="now-color">▍</span>
          {statusLabel ?? `RUN ${run.id.slice(-6)}`}
        </div>
        <div className="right">
          <Link className="lvl-control-link" href="/control-room">Control Room</Link>
          <code>trace / {run.traceId}</code>
        </div>
      </header>

      <div className="lvl-shell">
        {showLadder ? <LevelLadder run={run} onJump={onJump} /> : null}
        <div>{children}</div>
        {showSide ? <aside className="lvl-side">{side}</aside> : null}
      </div>

      <footer className="lvl-foot">
        <span><span className="live" /> {statusLabel ?? `RUN ${run.id.slice(-6)}`}</span>
        <span><strong>Xact Web Sandbox</strong> · Governance Command Center</span>
        <span>{run.traceId}</span>
      </footer>
    </div>
  );
}
