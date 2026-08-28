"use client";

import { useMemo, useState } from "react";
import { FlagshipLearningRunner, type FlagshipLearningRun } from "./learning-run";
import { SimulatedOAgentProvider } from "../telemetry/o-agent-provider";

function seconds(ms: number): string { return `${(ms / 1_000).toFixed(3)} s`; }

function Clock({ label, provenance, value, note }: { label: string; provenance: string; value: string; note: string }) {
  return <article><span>{label}</span><strong>{value}</strong><small>{provenance} · {note}</small></article>;
}

export function FlagshipLearningPanel() {
  const runner = useMemo(() => new FlagshipLearningRunner(new SimulatedOAgentProvider()), []);
  const [cold, setCold] = useState<FlagshipLearningRun>();
  const [rebuild, setRebuild] = useState<FlagshipLearningRun>();
  const [activated, setActivated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const visible = rebuild ?? cold;

  const execute = async (isActivated: boolean) => {
    setBusy(true); setError(undefined);
    try {
      const run = await runner.run(isActivated);
      if (isActivated) setRebuild(run); else setCold(run);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Learning run failed."); }
    finally { setBusy(false); }
  };

  return <section className="construction-comparison cost-comparison" aria-labelledby="flagship-learning-title">
    <h3 id="flagship-learning-title">Flagship Part I — reasoning reduces future reasoning</h3>
    <p>All runs execute 10,011 construction operations. Governed ACTIVATED learning changes only which semantic nodes resolve deterministically.</p>
    <div className="construction-actions"><button type="button" disabled={busy} onClick={() => void execute(false)}>Run cold</button><button type="button" disabled={busy || !cold} onClick={() => setActivated(true)}>{activated ? "Governed capability ACTIVATED" : "Activate governed learning"}</button><button type="button" disabled={busy || !activated} onClick={() => void execute(true)}>Rebuild</button></div>
    {visible ? <><div className="construction-metrics"><Clock label="Decision" value="~9 μs" provenance="REFERENCE_XACT_CORE_BENCHMARK" note="displayed only; not sandbox-measured" /><Clock label="Work" value={seconds(visible.workTimeMs)} provenance="LIVE_SANDBOX_MEASUREMENT" note={`${visible.executedConstructionOperations.toLocaleString()} operations executed`} /><Clock label="Reasoning" value={seconds(visible.reasoningTimeMs)} provenance={visible.provenance} note={`${visible.reasoningOperations} U nodes · ${visible.provider}`} /></div>
      <table><thead><tr><th>Run</th><th>Resolved deterministically</th><th>Construction ops executed</th><th>Reasoning calls</th><th>Checksum</th></tr></thead><tbody><tr><td>Cold</td><td>{cold?.deterministicallyResolvedOperations.toLocaleString() ?? "—"}</td><td>{cold?.executedConstructionOperations.toLocaleString() ?? "—"}</td><td>{cold?.reasoningOperations ?? "—"}</td><td>{cold?.checksum ?? "—"}</td></tr><tr><td>ACTIVATED rebuild</td><td>{rebuild?.deterministicallyResolvedOperations.toLocaleString() ?? "—"}</td><td>{rebuild?.executedConstructionOperations.toLocaleString() ?? "—"}</td><td>{rebuild?.reasoningOperations ?? "—"}</td><td>{rebuild?.checksum ?? "—"}</td></tr></tbody></table>
      {cold && rebuild ? <p>{cold.checksum === rebuild.checksum ? "Verified checksum match: same constructed artifact; only reasoning demand changed." : "Checksum mismatch: rebuild is not accepted."}</p> : null}
      <details><summary>Inspect reasoning trace · {visible.trace.length} measured provider calls</summary><table><thead><tr><th>Node</th><th>Provider</th><th>Provenance</th><th>Latency</th><th>Tokens</th><th>Evidence</th></tr></thead><tbody>{visible.trace.map((event) => <tr key={event.node}><td>{event.node}</td><td>{event.provider}</td><td>{event.provenance}</td><td>{event.latencyMs.toFixed(2)} ms</td><td>{event.inputTokens} / {event.outputTokens}</td><td>{event.evidence}</td></tr>)}</tbody></table></details></> : <p>Run cold to capture the first inspectable reasoning trace.</p>}
    {error ? <p className="runtime-error">{error}</p> : null}
  </section>;
}
