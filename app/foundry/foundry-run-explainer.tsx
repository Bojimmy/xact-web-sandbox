"use client";

import { useMemo, useState } from "react";
import { prepareFoundryRunExplainer } from "../../src/explainer";
import type { FoundryActivity } from "../../src/flagship/foundry-liaison";
import type { FoundryInvocationResult } from "../../src/flagship/foundry-runtime";
import type { WebMCPToolDefinition } from "../../src/flagship/webmcp-tool-builder";

export function FoundryRunExplainer({
  prompt,
  tool,
  activity,
  invocation,
}: Readonly<{
  prompt?: string;
  tool?: WebMCPToolDefinition;
  activity: readonly FoundryActivity[];
  invocation?: FoundryInvocationResult;
}>) {
  const prepared = useMemo(
    () => prepareFoundryRunExplainer({ prompt, tool, activity, invocation }),
    [prompt, tool, activity, invocation],
  );
  const [selectedId, setSelectedId] = useState("boss");
  const [slideOpen, setSlideOpen] = useState(false);

  if (!prepared?.storyboard.cards.length) return null;
  const cards = prepared.storyboard.cards;
  const findCard = (id: string) => cards.find((card) => id === "boss" ? card.title === "WHAT YOU ASKED" : id === "nodes" ? card.title === "WHAT XACT CONSTRUCTED" : id === "tool" ? card.title === "WHAT THE HOST VERIFIED" || card.title === "HOST EXPOSURE BLOCKED" : id === "run" ? card.title.includes("TOOL") || card.title.includes("APPLIED") || card.title.includes("REFUSED") : false);
  const reasoningOccurred = activity.some((event) => event.type === "REASON_STARTED" || event.type === "REASON_EVIDENCE");
  const stages = [
    { id: "boss", label: "BOSS", caption: "understands intent", card: findCard("boss") },
    { id: "nodes", label: "XACT NODES", caption: "compose exact work", card: findCard("nodes") },
    { id: "tool", label: "WEBMCP TOOL", caption: tool?.name ?? "governed capability", card: findCard("tool") },
    { id: "run", label: "FOUNDRY HOST", caption: invocation ? "tool was invoked" : "waiting to run", card: findCard("run") },
    { id: "summary", label: "RUN SUMMARY", caption: reasoningOccurred ? "reasoning was recorded" : "deterministic run", card: undefined },
  ];
  const selected = stages.find((stage) => stage.id === selectedId) ?? stages[0];
  const selectedCard = selected.card;
  const selectedIndex = stages.indexOf(selected);
  function moveSlide(direction: -1 | 1) {
    const next = stages[selectedIndex + direction];
    if (next) setSelectedId(next.id);
  }
  function openWalkthrough() {
    setSelectedId("boss");
    setSlideOpen(true);
  }

  return <section className="foundry-run-explainer" aria-labelledby="foundry-explainer-heading">
    <div className="foundry-run-explainer-heading">
      <div><p className="foundry-kicker">EVIDENCE-GROUNDED RUN EXPLAINER</p><h2 id="foundry-explainer-heading">How this WebMCP tool works.</h2></div>
      <button className="foundry-explain-button" type="button" onClick={openWalkthrough}>EXPLAIN WHAT JUST HAPPENED →</button>
    </div>
    <p>This walkthrough follows the actual path from conversation to a governed browser tool. It never changes the tool or authorizes a consequence.</p>
    <section className="foundry-system-map" aria-label="Xact WebMCP flow">
      <div className="foundry-browser-boundary"><span>YOUR BROWSER · XACT FOUNDRY</span><ol>
        {stages.map((stage, index) => <li key={stage.id} data-state={stage.card ? "measured" : "waiting"}>
          <div className="foundry-map-node"><b>{stage.label}</b><small>{stage.caption}</small><em>{stage.card ? "✓ EVIDENCE" : stage.id === "summary" ? "✓ DERIVED FROM RUN" : "○ NOT MEASURED"}</em></div>
          {index < stages.length - 1 ? <span className="foundry-map-arrow" aria-hidden="true">→</span> : null}
        </li>)}
      </ol></div>
    </section>
    {slideOpen ? <div className="foundry-slide-backdrop" role="presentation" onMouseDown={() => setSlideOpen(false)}><section className="foundry-explainer-slide" role="dialog" aria-modal="true" aria-labelledby="foundry-slide-title" onMouseDown={(event) => event.stopPropagation()}>
      <header><div><span>STEP {String(selectedIndex + 1).padStart(2, "0")} / {String(stages.length).padStart(2, "0")}</span><b>{selected.label}</b></div><button type="button" aria-label="Close explanation" onClick={() => setSlideOpen(false)}>×</button></header>
      <div className="foundry-slide-progress" aria-hidden="true">{stages.map((stage, index) => <i key={stage.id} data-active={index === selectedIndex} data-measured={Boolean(stage.card)} />)}</div>
      {selected.id === "summary" ? <><h3 id="foundry-slide-title">WHAT THIS RUN PROVED</h3><strong>{reasoningOccurred ? "This run included O-Agent reasoning where deterministic matching ended." : "No O-Agent reasoning occurred to build or run this tool."}</strong><p>{reasoningOccurred ? "Reasoning activity was recorded in the earlier slides. Xact still governed the construction and any consequence." : "The governed tool construction and its read-only run were deterministic. No O-Agent token spend was recorded for this run."}</p><small>EVIDENCE · activity stream and runtime audit for this run</small></> : selectedCard ? <><h3 id="foundry-slide-title">{selectedCard.title}</h3><strong>{selectedCard.facts.find((fact) => fact.role === "PRIMARY")?.text}</strong>{selectedCard.facts.filter((fact) => fact.role === "SUPPORTING").length ? <ul>{selectedCard.facts.filter((fact) => fact.role === "SUPPORTING").map((fact, index) => <li key={`${fact.text}-${index}`}>{fact.text}</li>)}</ul> : null}<small>EVIDENCE · {selectedCard.evidenceRefs.join(" · ") || "No additional event record"}</small></> : <><h3 id="foundry-slide-title">NOT MEASURED IN THIS RUN</h3><strong>This step did not occur.</strong><p>Run the tool or complete the preceding governed step before Xact can make a claim here.</p></>}
      <footer><button type="button" onClick={() => moveSlide(-1)} disabled={selectedIndex === 0}>← PREVIOUS</button><button type="button" onClick={() => moveSlide(1)} disabled={selectedIndex === stages.length - 1}>NEXT →</button></footer>
    </section></div> : null}
  </section>;
}
