import { referenceXactBenchmark } from "./reference-benchmark";
import type { TelemetrySample, TelemetryStage } from "./contracts";

function formatDuration(durationUs: number | undefined): string {
  if (durationUs === undefined) return "NOT RUN";
  if (durationUs >= 1_000) return `${(durationUs / 1_000).toFixed(2)} ms`;
  return `${durationUs.toFixed(1)} μs`;
}

function sumStage(samples: TelemetrySample[], stage: TelemetryStage): number | undefined {
  const matching = samples.filter((sample) => sample.stage === stage);
  return matching.length
    ? matching.reduce((total, sample) => total + sample.durationUs, 0)
    : undefined;
}

export function TelemetryPanel({ samples }: { samples: TelemetrySample[] }) {
  const reasoningDuration = sumStage(samples, "REASONING");
  const deterministicStages: TelemetryStage[] = ["RESOLVE", "COMMIT", "REENTRY", "VERIFICATION"];
  const deterministicTotal = samples
    .filter((sample) => deterministicStages.includes(sample.stage))
    .reduce((total, sample) => total + sample.durationUs, 0);
  const oAgentInvoked = reasoningDuration !== undefined;
  const metrics: Array<{ label: string; value: string; note: string }> = [
    { label: "Resolve", value: formatDuration(sumStage(samples, "RESOLVE")), note: "Live provider measurement" },
    { label: "Policy", value: formatDuration(sumStage(samples, "POLICY")), note: "Included within Commit total" },
    { label: "Commit", value: formatDuration(sumStage(samples, "COMMIT")), note: "Current-state decision" },
    { label: "Verification", value: formatDuration(sumStage(samples, "VERIFICATION")), note: "Exact post-effect check" },
    { label: "Deterministic total", value: samples.length ? formatDuration(deterministicTotal) : "NOT RUN", note: "Policy not double-counted" },
    { label: "Reasoning", value: oAgentInvoked ? formatDuration(reasoningDuration) : "NOT INVOKED", note: oAgentInvoked ? "Simulated provider · tokens 0" : "Tokens: 0" },
  ];

  return (
    <section className="capability-panel telemetry-panel" id="telemetry" aria-labelledby="telemetry-title">
      <div className="capability-heading">
        <div><span className="section-kicker">05 / Xact telemetry</span><h2 id="telemetry-title">Measured here. Referenced there.</h2></div>
        <span className={`path-chip ${oAgentInvoked ? "semantic" : "deterministic"}`}>
          {oAgentInvoked ? "Semantic path" : "Deterministic path"}
        </span>
      </div>

      <div className="telemetry-layout">
        <div className="live-telemetry">
          <div className="evidence-label live-label"><strong>Live sandbox telemetry</strong><span>Actual browser runtime · this session</span></div>
          <div className="metric-grid">
            {metrics.map((metric) => (
              <article key={metric.label} className="metric-card">
                <span>{metric.label}</span><strong>{metric.value}</strong><small>{metric.note}</small>
              </article>
            ))}
          </div>
          <div className="telemetry-disclosure">
            <span>O-Agent invoked</span><strong>{oAgentInvoked ? "YES" : "NO"}</strong>
            <p>Durations use the runtime performance clock. Values vary by device and are not reference Xact benchmarks.</p>
          </div>
        </div>

        <aside className="reference-card" aria-label="Reference Xact benchmark">
          <div className="evidence-label reference-label"><strong>Reference Xact benchmark</strong><span>Historical evidence · not this sandbox</span></div>
          <div className="reference-hero"><strong>{referenceXactBenchmark.meanDecisionLatencyUs.toFixed(1)} μs</strong><span>mean decision latency</span></div>
          <dl className="reference-grid">
            <div><dt>Median</dt><dd>{referenceXactBenchmark.medianDecisionLatencyUs.toFixed(1)} μs</dd></div>
            <div><dt>P95</dt><dd>{referenceXactBenchmark.p95DecisionLatencyUs.toFixed(1)} μs</dd></div>
            <div><dt>P99</dt><dd>{referenceXactBenchmark.p99DecisionLatencyUs.toFixed(1)} μs</dd></div>
            <div><dt>Decisions / second</dt><dd>≈{referenceXactBenchmark.throughputDecisionsPerSecond.toLocaleString()}</dd></div>
          </dl>
          <p>{referenceXactBenchmark.substrate} · {referenceXactBenchmark.iterations.toLocaleString()} iterations</p>
        </aside>
      </div>
    </section>
  );
}
