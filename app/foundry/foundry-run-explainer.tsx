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

  if (!prepared?.storyboard.cards.length) return null;
  const cards = prepared.storyboard.cards;
  const findCard = (id: string) => cards.find((card) => id === "boss" ? card.title === "WHAT YOU ASKED" : id === "nodes" ? card.title === "WHAT XACT CONSTRUCTED" : id === "tool" ? card.title === "WHAT THE HOST VERIFIED" || card.title === "HOST EXPOSURE BLOCKED" : card.title.includes("TOOL") || card.title.includes("APPLIED") || card.title.includes("REFUSED"));
  const stages = [
    { id: "boss", label: "BOSS", caption: "understands intent", card: findCard("boss") },
    { id: "nodes", label: "XACT NODES", caption: "compose exact work", card: findCard("nodes") },
    { id: "tool", label: "WEBMCP TOOL", caption: tool?.name ?? "governed capability", card: findCard("tool") },
    { id: "run", label: "FOUNDRY HOST", caption: invocation ? "tool was invoked" : "waiting to run", card: findCard("run") },
  ];
  const selected = stages.find((stage) => stage.id === selectedId) ?? stages[0];
  const selectedCard = selected.card;

  return <section className="foundry-run-explainer" aria-labelledby="foundry-explainer-heading">
    <div className="foundry-run-explainer-heading">
      <div><p className="foundry-kicker">EVIDENCE-GROUNDED RUN EXPLAINER</p><h2 id="foundry-explainer-heading">How this WebMCP tool works.</h2></div>
      <span className="foundry-state">CLICK A NODE TO WALK THE RUN</span>
    </div>
    <p>Follow the actual path from conversation to a governed browser tool. The selected step reveals only evidence this run produced; it never changes the tool or authorizes a consequence.</p>
    <section className="foundry-system-map" aria-label="Xact WebMCP flow">
      <div className="foundry-browser-boundary"><span>YOUR BROWSER · XACT FOUNDRY</span><ol>
        {stages.map((stage, index) => <li key={stage.id} data-state={stage.card ? "measured" : "waiting"}>
          <button type="button" aria-pressed={selected.id === stage.id} onClick={() => setSelectedId(stage.id)}><b>{stage.label}</b><small>{stage.caption}</small><em>{stage.card ? "✓ EVIDENCE" : "○ NOT MEASURED"}</em></button>
          {index < stages.length - 1 ? <span className="foundry-map-arrow" aria-hidden="true">→</span> : null}
        </li>)}
      </ol></div>
      <section className="foundry-explainer-slide" aria-live="polite">
        <div><span>STEP {String(stages.indexOf(selected) + 1).padStart(2, "0")}</span><b>{selected.label}</b></div>
        {selectedCard ? <><h3>{selectedCard.title}</h3><strong>{selectedCard.facts.find((fact) => fact.role === "PRIMARY")?.text}</strong>{selectedCard.facts.filter((fact) => fact.role === "SUPPORTING").length ? <ul>{selectedCard.facts.filter((fact) => fact.role === "SUPPORTING").map((fact, index) => <li key={`${fact.text}-${index}`}>{fact.text}</li>)}</ul> : null}<small>EVIDENCE · {selectedCard.evidenceRefs.join(" · ") || "No additional event record"}</small></> : <><h3>NOT MEASURED IN THIS RUN</h3><strong>This step did not occur.</strong><p>Run the tool or complete the preceding governed step before Xact can make a claim here.</p></>}
      </section>
    </section>
  </section>;
}
