"use client";

import { projectFoundryToolflow, toolflowStateLabel } from "../../src/flagship/foundry-toolflow";
import type { FoundryActivity } from "../../src/flagship/foundry-liaison";

export function FoundryToolflow({
  activity,
  invocation,
}: Readonly<{ activity: readonly FoundryActivity[]; invocation?: { status: string } }>) {
  const stages = projectFoundryToolflow(activity, invocation);
  return <section className="foundry-toolflow" id="toolflow" aria-labelledby="toolflow-heading">
    <div className="foundry-toolflow-heading"><div><p className="foundry-kicker">LIVE FOUNDRY CANVAS</p><h2 id="toolflow-heading">Watch the WebMCP tool become real.</h2></div><p>Every lit node is an event Xact actually emitted. A tool definition alone is not a running tool.</p></div>
    <ol className="foundry-toolflow-track" aria-label="WebMCP tool lifecycle">
      {stages.map((stage, index) => <li key={stage.id} data-state={stage.state}>
        <span className="foundry-toolflow-rail" aria-hidden="true">{index < stages.length - 1 ? "→" : ""}</span>
        <div className="foundry-toolflow-node"><span>{stage.state === "COMPLETE" ? "✓" : stage.state === "BLOCKED" ? "×" : stage.state === "ACTIVE" ? "◉" : "○"}</span><b>{stage.label}</b><small>{toolflowStateLabel(stage.state)}</small></div>
        <p>{stage.detail}</p>
      </li>)}
    </ol>
    <p className="foundry-toolflow-boundary">The O-Agent can illuminate meaning. Only Xact can pass the Commit boundary. A real WebMCP host must still register, observe, and verify the composed tool.</p>
  </section>;
}
