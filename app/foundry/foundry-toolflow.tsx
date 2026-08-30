"use client";

import { useMemo, useRef, useState } from "react";
import { projectFoundryToolflow, toolflowStateLabel } from "../../src/flagship/foundry-toolflow";
import type { FoundryActivity } from "../../src/flagship/foundry-liaison";

export function FoundryToolflow({
  activity,
  invocation,
}: Readonly<{ activity: readonly FoundryActivity[]; invocation?: { status: string } }>) {
  const stages = useMemo(() => projectFoundryToolflow(activity, invocation), [activity, invocation]);
  const [selectedId, setSelectedId] = useState<string>();
  const selected = stages.find((stage) => stage.id === selectedId)
    ?? [...stages].reverse().find((stage) => stage.state !== "WAITING")
    ?? stages[0];
  const inspectorRef = useRef<HTMLElement>(null);
  function inspect(stageId: string) {
    setSelectedId(stageId);
    requestAnimationFrame(() => inspectorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }
  return <section className="foundry-toolflow" id="toolflow" aria-labelledby="toolflow-heading">
    <div className="foundry-toolflow-heading"><div><p className="foundry-kicker">LIVE FOUNDRY CANVAS</p><h2 id="toolflow-heading">Watch the WebMCP tool become real.</h2></div><p><b>SELECTED · {selected.label.toUpperCase()}</b>{selected.detail}</p></div>
    <ol className="foundry-toolflow-track" aria-label="WebMCP tool lifecycle">
      {stages.map((stage, index) => <li key={stage.id} data-state={stage.state}>
        <span className="foundry-toolflow-rail" aria-hidden="true">{index < stages.length - 1 ? "→" : ""}</span>
        <button className="foundry-toolflow-node" type="button" aria-controls="toolflow-inspector" aria-pressed={stage.id === selected.id} onClick={() => inspect(stage.id)}><span>{stage.state === "COMPLETE" ? "✓" : stage.state === "BLOCKED" ? "×" : stage.state === "ACTIVE" ? "◉" : "○"}</span><b>{stage.label}</b><small>{toolflowStateLabel(stage.state)}</small></button>
        <p>{stage.detail}</p>
      </li>)}
    </ol>
    <section className="foundry-toolflow-inspector" id="toolflow-inspector" ref={inspectorRef} aria-live="polite"><div><span className="foundry-state">INSPECTING · {selected.label.toUpperCase()}</span><h3>{toolflowStateLabel(selected.state)}</h3><p>{selected.detail}</p></div>{selected.events.length ? <ol>{selected.events.map((event, index) => <li key={`${event.type}-${index}`} data-status={event.status}><b>{event.label}</b><span>{event.detail}</span></li>)}</ol> : <p className="foundry-empty">This node has no emitted activity to inspect yet.</p>}</section>
    <p className="foundry-toolflow-boundary">The O-Agent can illuminate meaning. Only Xact can pass the Commit boundary. A real WebMCP host must still register, observe, and verify the composed tool.</p>
  </section>;
}
