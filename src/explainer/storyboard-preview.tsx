"use client";

import { useEffect, useMemo, useState } from "react";
import type { Storyboard } from "./storyboard";

/**
 * Lightweight, renderer-independent storyboard preview. Mount with a built
 * Storyboard to watch it advance card by card — no TTS, video, or E4/E5
 * infrastructure required. Codex can drop this at the end of the flagship
 * "EXPLAIN THIS RUN" terminal.
 */

const TRUTH_BADGE: Record<string, { label: string; color: string }> = {
  REFERENCE: { label: "REFERENCE", color: "#7c6f1d" },
  SIMULATED: { label: "SIMULATED", color: "#8a5cf6" },
  LIVE: { label: "LIVE", color: "#1d7a3f" },
};

const CLOCK_BADGE: Record<string, string> = {
  DECISION: "DECISION CLOCK",
  WORK: "WORK CLOCK",
  REASONING: "REASONING CLOCK",
};

export function StoryboardPreview({
  storyboard,
  autoplay = false,
  stepMs = 4000,
}: {
  storyboard: Storyboard;
  autoplay?: boolean;
  stepMs?: number;
}) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(autoplay);
  const card = storyboard.cards[index];

  useEffect(() => {
    if (!playing || storyboard.cards.length === 0) return;
    const timer = setInterval(() => setIndex((current) => (current + 1) % storyboard.cards.length), stepMs);
    return () => clearInterval(timer);
  }, [playing, storyboard.cards.length, stepMs]);

  const progress = useMemo(
    () => (storyboard.cards.length ? ((index + 1) / storyboard.cards.length) * 100 : 0),
    [index, storyboard.cards.length],
  );

  if (!card) {
    return <div style={{ padding: 24, fontFamily: "monospace" }}>No storyboard cards to preview.</div>;
  }

  const primary = card.facts.find((fact) => fact.role === "PRIMARY");
  const supporting = card.facts.filter((fact) => fact.role === "SUPPORTING");
  const badge = TRUTH_BADGE[card.provenanceBadge] ?? TRUTH_BADGE.LIVE;

  return (
    <div style={{ border: "1px solid #d9e0da", borderRadius: 8, padding: 20, maxWidth: 680, fontFamily: "system-ui, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "#78847e" }}>
          {index + 1} / {storyboard.cards.length} · {Math.round(card.durationMs / 1000)}s
        </span>
        <span style={{ display: "inline-flex", gap: 6 }}>
          {card.facts.length > 0 ? (
            <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, color: "#fff", background: badge.color, fontWeight: 700 }}>{badge.label}</span>
          ) : null}
          {card.clock ? <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, border: "1px solid #9ba8a0", color: "#56635d" }}>{CLOCK_BADGE[card.clock] ?? card.clock}</span> : null}
        </span>
      </div>

      <h3 style={{ margin: "0 0 4px", fontSize: 22 }}>{card.title}</h3>
      {card.transition ? <p style={{ margin: "0 0 14px", fontSize: 13, color: "#56635d", fontStyle: "italic" }}>{card.transition}</p> : null}

      {primary ? (
        <div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.15, margin: "12px 0" }}>{primary.text}</div>
      ) : card.transition ? (
        <div style={{ fontSize: 26, fontWeight: 800, margin: "12px 0" }}>{card.transition}</div>
      ) : null}

      {supporting.length ? (
        <ul style={{ margin: "0 0 12px", paddingLeft: 18, fontSize: 14, color: "#3c4742" }}>
          {supporting.map((fact, i) => (
            <li key={i} style={{ marginBottom: 4 }}>{fact.text}</li>
          ))}
        </ul>
      ) : null}

      <div style={{ fontSize: 10, color: "#9aa59e", fontFamily: "monospace", marginTop: 8 }}>
        evidence refs: {card.evidenceRefs.length}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button type="button" onClick={() => setIndex((current) => (current - 1 + storyboard.cards.length) % storyboard.cards.length)} disabled={index === 0}>← prev</button>
        <button type="button" onClick={() => setPlaying((value) => !value)}>{playing ? "pause" : "play"}</button>
        <button type="button" onClick={() => setIndex((current) => (current + 1) % storyboard.cards.length)} disabled={index === storyboard.cards.length - 1}>next →</button>
      </div>

      <div style={{ height: 3, background: "#e6ebe7", marginTop: 12, borderRadius: 2 }}>
        <div style={{ height: 3, width: `${progress}%`, background: "#1d7a3f", borderRadius: 2, transition: "width 200ms" }} />
      </div>
    </div>
  );
}
