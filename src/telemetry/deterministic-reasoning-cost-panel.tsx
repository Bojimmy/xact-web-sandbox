"use client";

import { useMemo, useState } from "react";
import { BrowserDeterministicWorkloadProvider } from "./browser-deterministic-workload-provider";
import { COST_VARIANCE_RUNS, DeterministicReasoningCostRunner, type CostComparisonMode, type CostComparisonSummary } from "./deterministic-reasoning-cost";
import { SecureEndpointOAgentProvider, SimulatedOAgentProvider, type OAgentProvider } from "./o-agent-provider";

function formatMs(value: number): string { return `${value.toFixed(2)} ms`; }

function providerFor(live: boolean): OAgentProvider {
  return live ? new SecureEndpointOAgentProvider() : new SimulatedOAgentProvider();
}

function SummaryRow({ label, summary }: { label: string; summary?: CostComparisonSummary }) {
  const sample = summary?.samples[0];
  return <tr><td>{label}</td><td>{sample?.reasoning.kind ?? "—"}</td><td>{sample?.reasoning.calls ?? "—"}</td><td>{sample ? `${sample.reasoning.inputTokens} / ${sample.reasoning.outputTokens}` : "—"}</td><td>{summary ? formatMs(summary.mean.totalTimeMs) : "—"}</td><td>{summary ? formatMs(summary.stddev.reasoningWallTimeMs) : "—"}</td><td>{sample?.checksum ?? "—"}</td></tr>;
}

/**
 * Separate from 6A.2: the controls run serial variance samples and make
 * provenance explicit. No result here changes the construction artifact or
 * grants authority to a provider.
 */
export function DeterministicReasoningCostPanel() {
  const workload = useMemo(() => new BrowserDeterministicWorkloadProvider(), []);
  const [liveProvider, setLiveProvider] = useState(false);
  const [summaries, setSummaries] = useState<Partial<Record<"naive" | "hybrid" | "promoted", CostComparisonSummary>>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const run = async (mode: CostComparisonMode, promoted = false) => {
    setBusy(true);
    setError(undefined);
    try {
      const runner = new DeterministicReasoningCostRunner(workload, providerFor(liveProvider));
      const summary = await runner.runVariance({ mode, promoted, estimatedPricePer1kTokensUsd: 0.001 }, COST_VARIANCE_RUNS);
      setSummaries((current) => ({ ...current, [promoted ? "promoted" : mode === "NAIVE_REASONING" ? "naive" : "hybrid"]: summary }));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Cost telemetry run failed."); }
    finally { setBusy(false); }
  };

  const simulationLabel = liveProvider ? "LIVE endpoint selected" : "SIMULATED fallback selected";
  return <section className="construction-comparison cost-comparison" aria-labelledby="cost-telemetry-title">
    <h3 id="cost-telemetry-title">Experiment 6A.3 — deterministic vs reasoning cost</h3>
    <p>Each control runs {COST_VARIANCE_RUNS} serial samples over the same checksum-bound workload. Reasoning supplies evidence only; it still requires Xact re-entry and Commit.</p>
    <div className="construction-actions"><button type="button" onClick={() => setLiveProvider((value) => !value)} disabled={busy}>{simulationLabel}</button><button type="button" onClick={() => void run("NAIVE_REASONING")} disabled={busy || !workload.available()}>Run naive baseline ×{COST_VARIANCE_RUNS}</button><button type="button" onClick={() => void run("XACT_HYBRID")} disabled={busy || !workload.available()}>Run Xact hybrid ×{COST_VARIANCE_RUNS}</button><button type="button" onClick={() => void run("XACT_HYBRID", true)} disabled={busy || !workload.available()}>Run promoted hybrid ×{COST_VARIANCE_RUNS}</button></div>
    <table><thead><tr><th>Mode</th><th>Provenance</th><th>O-Agent calls</th><th>Input / output tokens</th><th>Mean total time</th><th>Reasoning σ</th><th>Checksum</th></tr></thead><tbody><SummaryRow label="Naive reasoning" summary={summaries.naive} /><SummaryRow label="Xact hybrid" summary={summaries.hybrid} /><SummaryRow label="Hybrid after promotion" summary={summaries.promoted} /></tbody></table>
    <p>Deterministic inference is always 0 calls / 0 tokens. Cost is shown only as an estimate using $0.001 per 1,000 tokens; it is not a model price claim.</p>
    {error ? <p className="runtime-error">{error}</p> : null}
  </section>;
}
