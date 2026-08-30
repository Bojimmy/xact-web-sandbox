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
  const [open, setOpen] = useState(false);

  if (!prepared?.storyboard.cards.length) return null;

  return <section className="foundry-run-explainer" aria-labelledby="foundry-explainer-heading">
    <div className="foundry-run-explainer-heading">
      <div><p className="foundry-kicker">EVIDENCE-GROUNDED RUN EXPLAINER</p><h2 id="foundry-explainer-heading">Explain what just happened.</h2></div>
      <button className="foundry-explain-button" type="button" onClick={() => setOpen((value) => !value)}>{open ? "HIDE EXPLANATION" : "EXPLAIN WHAT JUST HAPPENED →"}</button>
    </div>
    <p>Prepared from the activity and runtime result that actually occurred. This read-only preview cannot change a tool, authorize use, render, or publish.</p>
    {open ? <ol className="foundry-explainer-cards" aria-live="polite">
      {prepared.storyboard.cards.map((card, index) => <li key={card.id}>
        <div><span>{String(index + 1).padStart(2, "0")}</span><b>{card.provenanceBadge}</b></div>
        <h3>{card.title}</h3>
        <strong>{card.facts.find((fact) => fact.role === "PRIMARY")?.text}</strong>
        {card.facts.filter((fact) => fact.role === "SUPPORTING").length ? <ul>{card.facts.filter((fact) => fact.role === "SUPPORTING").map((fact, detailIndex) => <li key={`${fact.text}-${detailIndex}`}>{fact.text}</li>)}</ul> : null}
        <small>EVIDENCE · {card.evidenceRefs.join(" · ") || "No additional event record"}</small>
      </li>)}
    </ol> : null}
  </section>;
}
