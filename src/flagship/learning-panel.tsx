"use client";

import { useMemo, useState } from "react";
import type { PromotionState } from "../evolution/contracts";
import { LearningSimulationProvider } from "../evolution/learning-simulation-provider";
import { SimulatedOAgentProvider } from "../telemetry/o-agent-provider";
import { FlagshipLearningRunner, type FlagshipLearningRun } from "./learning-run";

function seconds(ms: number): string { return `${(ms / 1_000).toFixed(3)} s`; }

function Clock({ label, provenance, value, note }: { label: string; provenance: string; value: string; note: string }) {
  return <article><span>{label}</span><strong>{value}</strong><small>{provenance} · {note}</small></article>;
}

const nextPromotion: Record<PromotionState, PromotionState | undefined> = {
  OBSERVED: "CANDIDATE", CANDIDATE: "VALIDATED", VALIDATED: "APPROVED", APPROVED: "ACTIVATED", ACTIVATED: undefined,
};

export function FlagshipLearningPanel() {
  const runner = useMemo(() => new FlagshipLearningRunner(new SimulatedOAgentProvider()), []);
  const learning = useMemo(() => new LearningSimulationProvider<{ caseKey: string }>({
    candidateId: "flagship:semantic-construction-pattern",
    label: "Repeated semantic construction pattern",
    caseKey: (input) => input.caseKey,
    equivalentCaseKey: "flagship:construction-v1",
    resolves: ["semantic construction intent"],
  }), []);
  const [evolution, setEvolution] = useState(() => learning.snapshot());
  const [cold, setCold] = useState<FlagshipLearningRun>();
  const [rebuild, setRebuild] = useState<FlagshipLearningRun>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const visible = rebuild ?? cold;
  const promotion = evolution.candidate?.state;
  const next = promotion ? nextPromotion[promotion] : undefined;

  const runCold = async () => {
    setBusy(true); setError(undefined);
    try {
      const run = await runner.run(false);
      setCold(run);
      setEvolution(learning.observe({ evidenceId: "flagship:cold-run-evidence", claim: "Repeated semantic construction requests were measured in the cold run.", beforeTrace: run.trace.map((event) => event.node) }));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Learning run failed."); }
    finally { setBusy(false); }
  };

  const advanceGovernance = () => {
    if (!next) return;
    try { setError(undefined); setEvolution(learning.transition(next)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Governance transition failed."); }
  };

  const runRebuild = async () => {
    setBusy(true); setError(undefined);
    try {
      const run = await runner.run(true);
      setRebuild(run);
      setEvolution(learning.recordReplay(run.trace.map((event) => event.node)));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Rebuild failed."); }
    finally { setBusy(false); }
  };

  const reset = () => { setEvolution(learning.reset()); setCold(undefined); setRebuild(undefined); setError(undefined); };

  return <section className="construction-comparison cost-comparison" aria-labelledby="flagship-learning-title">
    <h3 id="flagship-learning-title">Flagship Part I — reasoning reduces future reasoning</h3>
    <p>All runs execute 10,011 construction operations. Governed ACTIVATED learning changes only which semantic nodes resolve deterministically.</p>
    <div className="construction-actions"><button type="button" disabled={busy || Boolean(promotion)} onClick={() => void runCold()}>Run cold</button><button type="button" disabled={busy || !next} onClick={advanceGovernance}>{next ? `Advance governance → ${next}` : "Governed capability ACTIVATED"}</button><button type="button" disabled={busy || promotion !== "ACTIVATED"} onClick={() => void runRebuild()}>Rebuild</button><button type="button" disabled={busy || !promotion} onClick={reset}>Reset learning</button></div>
    <p>Governed lifecycle: <strong>{promotion ?? "NOT OBSERVED"}</strong>. ACTIVATED may resolve U → R; it does not authorize execution.</p>
    {visible ? <><div className="construction-metrics"><Clock label="Decision" value="~9 μs" provenance="REFERENCE_XACT_CORE_BENCHMARK" note="displayed only; not sandbox-measured" /><Clock label="Work" value={seconds(visible.workTimeMs)} provenance="LIVE_SANDBOX_MEASUREMENT" note={`${visible.executedConstructionOperations.toLocaleString()} operations executed`} /><Clock label="Reasoning" value={seconds(visible.reasoningTimeMs)} provenance={visible.provenance} note={`${visible.reasoningOperations} U nodes · ${visible.provider}`} /></div>
      <table><thead><tr><th>Run</th><th>Resolved deterministically</th><th>Construction ops executed</th><th>Reasoning calls</th><th>Checksum</th></tr></thead><tbody><tr><td>Cold</td><td>{cold?.deterministicallyResolvedOperations.toLocaleString() ?? "—"}</td><td>{cold?.executedConstructionOperations.toLocaleString() ?? "—"}</td><td>{cold?.reasoningOperations ?? "—"}</td><td>{cold?.checksum ?? "—"}</td></tr><tr><td>ACTIVATED rebuild</td><td>{rebuild?.deterministicallyResolvedOperations.toLocaleString() ?? "—"}</td><td>{rebuild?.executedConstructionOperations.toLocaleString() ?? "—"}</td><td>{rebuild?.reasoningOperations ?? "—"}</td><td>{rebuild?.checksum ?? "—"}</td></tr></tbody></table>
      {cold && rebuild ? <p>{cold.checksum === rebuild.checksum ? "Verified checksum match: same constructed artifact; only reasoning demand changed." : "Checksum mismatch: rebuild is not accepted."}</p> : null}
      <details><summary>Inspect reasoning trace · {visible.trace.length} measured provider calls</summary><table><thead><tr><th>Node</th><th>Provider</th><th>Provenance</th><th>Latency</th><th>Tokens</th><th>Evidence</th></tr></thead><tbody>{visible.trace.map((event) => <tr key={event.node}><td>{event.node}</td><td>{event.provider}</td><td>{event.provenance}</td><td>{event.latencyMs.toFixed(2)} ms</td><td>{event.inputTokens} / {event.outputTokens}</td><td>{event.evidence}</td></tr>)}</tbody></table></details></> : <p>Run cold to capture the first inspectable reasoning trace.</p>}
    {error ? <p className="runtime-error">{error}</p> : null}
  </section>;
}
