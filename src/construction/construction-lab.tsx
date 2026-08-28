"use client";

import { useMemo, useState } from "react";
import type { ConstructionRun, DeterministicScaleRun, ServiceOperationsConsoleArtifact } from "./contracts";
import { ConstructionBenchmarkEngine, serviceOperationsBenchmarkRequest, serviceOperationsSemanticRequest } from "./engine";
import { LearningSimulationProvider } from "../evolution/learning-simulation-provider";
import type { PromotionState } from "../evolution/contracts";
import { BrowserScaleWorkloadRunner } from "./browser-scale-runner";
import { DeterministicReasoningCostPanel } from "../telemetry/deterministic-reasoning-cost-panel";
import { FlagshipLearningPanel } from "../flagship/learning-panel";
import { type ServiceCreditEngine, type ServiceCreditSession } from "../runtime/service-operations-engine";

const levels = [1, 10, 25, 50, 100] as const;

function formatMs(value: number): string { return `${value.toFixed(2)} ms`; }

function ServiceCreditExecution({ engine }: { engine: ServiceCreditEngine }) {
  const [session, setSession] = useState<ServiceCreditSession>(() => engine.createSession());
  const [busy, setBusy] = useState(false);
  const artifact = session.decision?.status === "AUTHORIZED" ? session.decision.artifact : undefined;
  const authorized = Boolean(artifact);
  const run = async (action: () => Promise<ServiceCreditSession>) => {
    setBusy(true);
    try { setSession(await action()); }
    finally { setBusy(false); }
  };
  const activateBoundTarget = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (!artifact || event.currentTarget.getAttribute("data-xact-dispatch-nonce") !== artifact.nonce) return;
    const receipt = `service-credit:${artifact.commitId.replace(/[^a-zA-Z0-9]/g, "_")}`;
    event.currentTarget.setAttribute("data-xact-receipt", receipt);
    event.currentTarget.setAttribute("data-xact-effect-fingerprint", artifact.effectFingerprint);
  };

  return <section className="service-credit-execution" aria-labelledby="service-credit-execution-title">
    <div><span>Stage 2B · artifact-bound execution</span><h4 id="service-credit-execution-title">Apply service credit to customer 1042</h4><p>Capability is visible before Commit. The target becomes activatable only after this runtime issues an exact AuthorizationArtifact.</p></div>
    <div className="construction-actions"><button type="button" disabled={busy || session.phase !== "READY"} onClick={() => void run(() => engine.resolve(session))}>1 · Resolve</button><button type="button" disabled={busy || session.phase !== "RESOLVED"} onClick={() => void run(() => engine.commit(session))}>2 · Commit</button><button type="button" disabled={busy || !authorized || Boolean(session.execution)} onClick={() => void run(() => engine.executeAndVerify(session))}>3 · Route, execute, observe, verify</button></div>
    <dl><div><dt>Commit</dt><dd>{session.decision?.status ?? "PENDING"}</dd></div><div><dt>Artifact</dt><dd>{authorized ? "ISSUED" : "NONE"}</dd></div><div><dt>Route</dt><dd>{session.selectedSubstrate}</dd></div><div><dt>Verification</dt><dd>{session.verification?.verified ? "VERIFIED" : session.phase === "OBSERVATION_FAILED" ? "WITHHELD" : "NOT RUN"}</dd></div></dl>
    <button type="button" data-xact-target="customer:1042/service-credit" data-xact-effect-fingerprint={artifact?.effectFingerprint} data-xact-commit-id={artifact?.commitId} disabled={!authorized} aria-disabled={!authorized} onClick={activateBoundTarget}>Apply $42.00 service credit</button>
    <ol>{session.trace.map((event) => <li key={`${event.sequence}:${event.phase}`}><strong>{event.phase} · {event.outcome}</strong><span>{event.detail}</span></li>)}</ol>
  </section>;
}

function ServiceOperationsConsole({ artifact, serviceCreditEngine }: { artifact: ServiceOperationsConsoleArtifact; serviceCreditEngine: ServiceCreditEngine }) {
  const [customerId, setCustomerId] = useState("1042");
  const customer = artifact.customers.find((candidate) => candidate.id === customerId) ?? artifact.customers[0];
  const auditHistory = artifact.auditHistory.filter((event) => event.id.split(":")[1] === customer.id);

  return <section className="construction-artifact service-operations-console" aria-labelledby="service-operations-title">
    <div className="construction-heading"><div><span>Assembled artifact · constructed capability manifest</span><h3 id="service-operations-title">{artifact.title}</h3></div><strong>READ + REQUEST SURFACE</strong></div>
    <p className="artifact-boundary-note">The console renders capabilities only. Consequential requests have no handler until a fresh Commit issues an AuthorizationArtifact.</p>
    <label className="service-customer-picker">Customer <select value={customer.id} onChange={(event) => setCustomerId(event.target.value)}>{artifact.customers.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.id} · {candidate.name}</option>)}</select></label>
    <div className="service-summary"><article><span>Customer</span><strong>{customer.name}</strong><small>#{customer.id}</small></article><article><span>Account</span><strong>{customer.accountStatus}</strong><small>{customer.servicePlan}</small></article><article><span>Service credit available</span><strong>${customer.availableServiceCredit.toFixed(2)}</strong><small>reported eligibility</small></article></div>
    <div className="service-console-grid"><section><h4>Available actions</h4><ul>{customer.availableActions.map((action) => <li key={action}>{action}</li>)}</ul><button type="button" disabled aria-disabled="true">Change service plan · Commit required</button></section><section><h4>Audit history</h4><ol>{auditHistory.map((event) => <li key={event.id}><span>{event.detail}</span><time>{event.recordedAt}</time></li>)}</ol></section></div>
    <ServiceCreditExecution engine={serviceCreditEngine} />
    <details className="service-tool-manifest"><summary>Inspect constructed capability manifest · {artifact.tools.length} tools</summary><table><thead><tr><th>Tool</th><th>Kind</th><th>Boundary</th></tr></thead><tbody>{artifact.tools.map((tool) => <tr key={tool.name}><td><code>{tool.name}</code><small>{tool.description}</small></td><td>{tool.kind}</td><td>{tool.requiresCommit ? "Commit required" : "Read only"}</td></tr>)}</tbody></table></details>
  </section>;
}

export function ConstructionLab({ serviceCreditEngine }: { serviceCreditEngine: ServiceCreditEngine }) {
  const engine = useMemo(() => new ConstructionBenchmarkEngine(), []);
  const scaleRunner = useMemo(() => new BrowserScaleWorkloadRunner(), []);
  const learning = useMemo(() => new LearningSimulationProvider({
    candidateId: "construction:service-operations-composition-v1", label: "Service Operations Console composition", equivalentCaseKey: "service-operations:console-v1",
    caseKey: () => "service-operations:console-v1", resolves: ["service-operations-composition"],
  }), []);
  const [run, setRun] = useState<ConstructionRun>();
  const [comparison, setComparison] = useState<ConstructionRun[]>([]);
  const [showAI, setShowAI] = useState(false);
  const [busy, setBusy] = useState(false);
  const [evolution, setEvolution] = useState(() => learning.snapshot());
  const [scaleRuns, setScaleRuns] = useState<DeterministicScaleRun[]>([]);
  const [scaleError, setScaleError] = useState<string>();

  const execute = async (request: string, activeComposition = false) => {
    setBusy(true);
    try {
      const result = await engine.run({ request, concurrency: 10, activeComposition });
      setRun(result);
    } finally { setBusy(false); }
  };
  const benchmark = async () => {
    setBusy(true);
    try {
      const results: ConstructionRun[] = [];
      for (const concurrency of levels) results.push(await engine.run({ request: serviceOperationsBenchmarkRequest, concurrency }));
      setComparison(results);
    }
    finally { setBusy(false); }
  };
  const runScale = async () => {
    setBusy(true);
    setScaleError(undefined);
    try {
      const results: DeterministicScaleRun[] = [];
      for (const workers of levels) results.push(await scaleRunner.run(workers));
      setScaleRuns(results);
    }
    catch (cause) { setScaleError(cause instanceof Error ? cause.message : "Scale workload failed."); }
    finally { setBusy(false); }
  };
  const advance = () => {
    if (!evolution.candidate) {
      setEvolution(learning.observe({ evidenceId: "construction:composition-evidence", claim: "Bounded Service Operations composition was observed in a governed construction run.", beforeTrace: ["Related Service Operations request: one composition U"] }));
      return;
    }
    const next: Partial<Record<PromotionState, PromotionState>> = { OBSERVED: "CANDIDATE", CANDIDATE: "VALIDATED", VALIDATED: "APPROVED", APPROVED: "ACTIVATED" };
    const target = next[evolution.candidate.state];
    if (target) setEvolution(learning.transition(target));
  };
  const active = evolution.candidate?.state === "ACTIVATED";
  const metrics = run?.metrics;

  return <section className="construction-lab" id="construction-lab" aria-labelledby="construction-title">
    <header className="construction-heading"><div><span className="section-kicker">07 / Experimental proof branch</span><h2 id="construction-title">XACT CONSTRUCTION LAB</h2><p>Allowlisted primitives, deterministic workers, and measured public-safe construction runs.</p></div><span className="simulation-boundary">Live construction benchmark</span></header>
    <div className="construction-actions"><button type="button" onClick={() => void execute(serviceOperationsBenchmarkRequest)} disabled={busy}>Pass 1 · Run cold console</button><button type="button" onClick={() => void execute(serviceOperationsSemanticRequest)} disabled={busy}>Inspect related U</button><button type="button" onClick={advance} disabled={busy || active}>{active ? "Composition ACTIVATED" : evolution.candidate ? `Promote ${evolution.candidate.state}` : "Pass 2 · Start governed evolution"}</button><button type="button" onClick={() => void execute(serviceOperationsSemanticRequest, active)} disabled={busy || !active}>Pass 3 · Run hot console</button><button type="button" onClick={() => void benchmark()} disabled={busy}>6A.1 · Compare structural scheduler</button><button type="button" onClick={() => void runScale()} disabled={busy || !scaleRunner.available()}>6A.2 · Run deterministic scale workload</button><button type="button" onClick={() => setShowAI((value) => !value)}>{showAI ? "Show all operations" : "Show me what required AI"}</button></div>
    <div className="construction-metrics">{[
      ["Deterministic operations", metrics?.deterministicOperations ?? "—"], ["Reasoning events", metrics?.oAgentCalls ?? "—"], ["Tokens used", metrics?.oAgentTokens ?? "—"], ["Active X-Nodes", metrics?.peakParallelOperations ?? "—"], ["Total build time", metrics ? formatMs(metrics.totalTimeToWorkingAppMs) : "—"],
    ].map(([label, value]) => <article key={String(label)}><span>{label}</span><strong>{value}</strong></article>)}</div>
    {run ? <><div className="construction-run-meta"><strong>{run.metrics.finalResult}</strong><span>{run.metrics.totalOperations} operations · concurrency {run.concurrency} · {run.metrics.unresolvedOperations} unresolved</span></div><div className="parallelism-panel"><h3>Parallelism</h3><dl><div><dt>Operations</dt><dd>{run.metrics.totalOperations}</dd></div><div><dt>Dependency stages</dt><dd>{run.metrics.dependencyStages}</dd></div><div><dt>Configured X-Nodes</dt><dd>{run.concurrency}</dd></div><div><dt>Peak active X-Nodes</dt><dd>{run.metrics.peakParallelOperations}</dd></div><div><dt>Average active X-Nodes</dt><dd>{run.metrics.averageActiveOperations.toFixed(1)}</dd></div><div><dt>Sequential equivalent</dt><dd>{formatMs(run.metrics.sequentialEquivalentTimeMs)}</dd></div><div><dt>Critical-path time</dt><dd>{formatMs(run.metrics.criticalPathTimeMs)}</dd></div><div><dt>Actual scheduler time</dt><dd>{formatMs(run.metrics.schedulerTimeMs)}</dd></div><div><dt>Measured speedup</dt><dd>{run.metrics.measuredSpeedup.toFixed(2)}×</dd></div></dl></div><div className="construction-graph">{(showAI ? run.reasoningOperations : run.operations).map((operation) => <div className={operation.classification === "UNRESOLVED" ? "operation-node unresolved" : "operation-node"} key={operation.id}><span>{operation.classification === "UNRESOLVED" ? "O" : "X"}</span><strong>{operation.primitive}</strong><small>{operation.id}</small></div>)}{showAI && !run.reasoningOperations.length ? <p>No operation crossed the reasoning boundary in this run.</p> : null}</div><ol className="construction-trace">{run.trace.map((entry) => <li key={entry}>{entry}</li>)}</ol>{run.artifact ? <ServiceOperationsConsole artifact={run.artifact} serviceCreditEngine={serviceCreditEngine} /> : null}</> : <p className="construction-empty">Run the bounded Service Operations request to assemble and inspect the constructed console.</p>}
    {comparison.length ? <div className="construction-comparison"><h3>Measured concurrency comparison</h3><table><thead><tr><th>Configured</th><th>Stages</th><th>Peak / avg active</th><th>Scheduler time</th><th>Speedup</th><th>Result</th></tr></thead><tbody>{comparison.map((item) => <tr key={item.concurrency}><td>{item.concurrency}</td><td>{item.metrics.dependencyStages}</td><td>{item.metrics.peakParallelOperations} / {item.metrics.averageActiveOperations.toFixed(1)}</td><td>{formatMs(item.metrics.schedulerTimeMs)}</td><td>{item.metrics.measuredSpeedup.toFixed(2)}×</td><td>{item.metrics.finalResult}</td></tr>)}</tbody></table><p>These are measured local runs. They are not the reference Xact decision-rate benchmark.</p></div> : null}
    {scaleError ? <p className="runtime-error">{scaleError}</p> : null}
    {scaleRuns.length ? <div className="construction-comparison scale-comparison"><h3>Experiment 6A.2 — deterministic scale workload</h3><table><thead><tr><th>Configured workers</th><th>Peak / avg active</th><th>Operations / stages</th><th>Scheduler time</th><th>Throughput</th><th>Speedup vs 1</th></tr></thead><tbody>{scaleRuns.map((item) => { const baseline = scaleRuns.find((run) => run.configuredWorkers === 1); const speedup = baseline ? baseline.schedulerTimeMs / item.schedulerTimeMs : 0; return <tr key={item.configuredWorkers}><td>{item.configuredWorkers}</td><td>{item.peakActiveWorkers} / {item.averageActiveWorkers.toFixed(1)}</td><td>{item.totalOperations.toLocaleString()} / {item.dependencyStages}</td><td>{formatMs(item.schedulerTimeMs)}</td><td>{item.throughputOperationsPerSecond.toFixed(0)} ops/s</td><td>{speedup.toFixed(2)}×</td></tr>; })}</tbody></table><p>Actual browser Web Worker runs. Hardware concurrency: {scaleRuns[0].environment.hardwareConcurrency ?? "unknown"}. No reference-benchmark figures are used here.</p></div> : null}
    <DeterministicReasoningCostPanel />
    <FlagshipLearningPanel />
  </section>;
}
