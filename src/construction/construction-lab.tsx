"use client";

import { useMemo, useState } from "react";
import type { ConstructionRun, DeterministicScaleRun, Product } from "./contracts";
import { ConstructionBenchmarkEngine, inventoryBenchmarkRequest, orderBenchmarkRequest } from "./engine";
import { LearningSimulationProvider } from "../evolution/learning-simulation-provider";
import type { PromotionState } from "../evolution/contracts";
import { BrowserScaleWorkloadRunner } from "./browser-scale-runner";
import { DeterministicReasoningCostPanel } from "../telemetry/deterministic-reasoning-cost-panel";

const levels = [1, 10, 25, 50, 100] as const;

function formatMs(value: number): string { return `${value.toFixed(2)} ms`; }

function InventoryDashboard({ products: initial }: { products: Product[] }) {
  const [products, setProducts] = useState(initial);
  const [lowOnly, setLowOnly] = useState(false);
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState(1);
  const [reorderPoint, setReorderPoint] = useState(1);
  const visible = products.filter((product) => !lowOnly || product.quantity < product.reorderPoint);
  const value = products.reduce((total, product) => total + product.quantity * product.unitPrice, 0);
  const add = () => {
    if (!name.trim() || quantity < 0 || unitPrice < 0 || reorderPoint < 0) return;
    setProducts((current) => [...current, { id: `SKU-${String(current.length + 1).padStart(2, "0")}`, name: name.trim(), quantity, unitPrice, reorderPoint }]);
    setName("");
  };
  const adjust = (id: string, delta: number) => setProducts((current) => current.map((product) => product.id === id
    ? { ...product, quantity: Math.max(0, product.quantity + delta) }
    : product));

  return <section className="construction-artifact" aria-labelledby="inventory-artifact-title">
    <div className="construction-heading"><div><span>Assembled artifact</span><h3 id="inventory-artifact-title">Inventory dashboard</h3></div><strong>${value.toFixed(2)} total value</strong></div>
    <div className="inventory-toolbar"><label><input type="checkbox" checked={lowOnly} onChange={(event) => setLowOnly(event.target.checked)} /> Low stock only</label><span>{visible.length} shown</span></div>
    <table><thead><tr><th>Product</th><th>On hand</th><th>Value</th><th>Warning</th><th>Adjust</th></tr></thead><tbody>{visible.map((product) => <tr key={product.id}>
      <td>{product.name}</td><td>{product.quantity}</td><td>${(product.quantity * product.unitPrice).toFixed(2)}</td><td>{product.quantity < product.reorderPoint ? <b>LOW · &lt; {product.reorderPoint}</b> : "—"}</td>
      <td><button type="button" onClick={() => adjust(product.id, -1)}>-</button><button type="button" onClick={() => adjust(product.id, 1)}>+</button></td>
    </tr>)}</tbody></table>
    <div className="inventory-add"><input placeholder="Product name" value={name} onChange={(event) => setName(event.target.value)} /><input aria-label="Quantity" type="number" min="0" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} /><input aria-label="Unit price" type="number" min="0" value={unitPrice} onChange={(event) => setUnitPrice(Number(event.target.value))} /><input aria-label="Reorder point" type="number" min="0" value={reorderPoint} onChange={(event) => setReorderPoint(Number(event.target.value))} /><button type="button" onClick={add}>Add product</button></div>
  </section>;
}

export function ConstructionLab() {
  const engine = useMemo(() => new ConstructionBenchmarkEngine(), []);
  const scaleRunner = useMemo(() => new BrowserScaleWorkloadRunner(), []);
  const learning = useMemo(() => new LearningSimulationProvider({
    candidateId: "construction:order-composition-v1", label: "Order dashboard composition", equivalentCaseKey: "order:dashboard-v1",
    caseKey: () => "order:dashboard-v1", resolves: ["order-composition"],
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
      for (const concurrency of levels) results.push(await engine.run({ request: inventoryBenchmarkRequest, concurrency }));
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
      setEvolution(learning.observe({ evidenceId: "construction:composition-evidence", claim: "Bounded order composition was observed in a governed construction run.", beforeTrace: ["Cold order request: one composition U"] }));
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
    <div className="construction-actions"><button type="button" onClick={() => void execute(inventoryBenchmarkRequest)} disabled={busy}>Pass 1 · Run cold inventory</button><button type="button" onClick={() => void execute(orderBenchmarkRequest)} disabled={busy}>Inspect related U</button><button type="button" onClick={advance} disabled={busy || active}>{active ? "Composition ACTIVATED" : evolution.candidate ? `Promote ${evolution.candidate.state}` : "Pass 2 · Start governed evolution"}</button><button type="button" onClick={() => void execute(orderBenchmarkRequest, active)} disabled={busy || !active}>Pass 3 · Run hot order</button><button type="button" onClick={() => void benchmark()} disabled={busy}>6A.1 · Compare structural scheduler</button><button type="button" onClick={() => void runScale()} disabled={busy || !scaleRunner.available()}>6A.2 · Run deterministic scale workload</button><button type="button" onClick={() => setShowAI((value) => !value)}>{showAI ? "Show all operations" : "Show me what required AI"}</button></div>
    <div className="construction-metrics">{[
      ["Deterministic operations", metrics?.deterministicOperations ?? "—"], ["Reasoning events", metrics?.oAgentCalls ?? "—"], ["Tokens used", metrics?.oAgentTokens ?? "—"], ["Active X-Nodes", metrics?.peakParallelOperations ?? "—"], ["Total build time", metrics ? formatMs(metrics.totalTimeToWorkingAppMs) : "—"],
    ].map(([label, value]) => <article key={String(label)}><span>{label}</span><strong>{value}</strong></article>)}</div>
    {run ? <><div className="construction-run-meta"><strong>{run.metrics.finalResult}</strong><span>{run.metrics.totalOperations} operations · concurrency {run.concurrency} · {run.metrics.unresolvedOperations} unresolved</span></div><div className="parallelism-panel"><h3>Parallelism</h3><dl><div><dt>Operations</dt><dd>{run.metrics.totalOperations}</dd></div><div><dt>Dependency stages</dt><dd>{run.metrics.dependencyStages}</dd></div><div><dt>Configured X-Nodes</dt><dd>{run.concurrency}</dd></div><div><dt>Peak active X-Nodes</dt><dd>{run.metrics.peakParallelOperations}</dd></div><div><dt>Average active X-Nodes</dt><dd>{run.metrics.averageActiveOperations.toFixed(1)}</dd></div><div><dt>Sequential equivalent</dt><dd>{formatMs(run.metrics.sequentialEquivalentTimeMs)}</dd></div><div><dt>Critical-path time</dt><dd>{formatMs(run.metrics.criticalPathTimeMs)}</dd></div><div><dt>Actual scheduler time</dt><dd>{formatMs(run.metrics.schedulerTimeMs)}</dd></div><div><dt>Measured speedup</dt><dd>{run.metrics.measuredSpeedup.toFixed(2)}×</dd></div></dl></div><div className="construction-graph">{(showAI ? run.reasoningOperations : run.operations).map((operation) => <div className={operation.classification === "UNRESOLVED" ? "operation-node unresolved" : "operation-node"} key={operation.id}><span>{operation.classification === "UNRESOLVED" ? "O" : "X"}</span><strong>{operation.primitive}</strong><small>{operation.id}</small></div>)}{showAI && !run.reasoningOperations.length ? <p>No operation crossed the reasoning boundary in this run.</p> : null}</div><ol className="construction-trace">{run.trace.map((entry) => <li key={entry}>{entry}</li>)}</ol>{run.artifact?.kind === "INVENTORY_DASHBOARD" ? <InventoryDashboard products={run.artifact.products} /> : null}</> : <p className="construction-empty">Run the bounded inventory request to assemble and inspect the local dashboard.</p>}
    {comparison.length ? <div className="construction-comparison"><h3>Measured concurrency comparison</h3><table><thead><tr><th>Configured</th><th>Stages</th><th>Peak / avg active</th><th>Scheduler time</th><th>Speedup</th><th>Result</th></tr></thead><tbody>{comparison.map((item) => <tr key={item.concurrency}><td>{item.concurrency}</td><td>{item.metrics.dependencyStages}</td><td>{item.metrics.peakParallelOperations} / {item.metrics.averageActiveOperations.toFixed(1)}</td><td>{formatMs(item.metrics.schedulerTimeMs)}</td><td>{item.metrics.measuredSpeedup.toFixed(2)}×</td><td>{item.metrics.finalResult}</td></tr>)}</tbody></table><p>These are measured local runs. They are not the reference Xact decision-rate benchmark.</p></div> : null}
    {scaleError ? <p className="runtime-error">{scaleError}</p> : null}
    {scaleRuns.length ? <div className="construction-comparison scale-comparison"><h3>Experiment 6A.2 — deterministic scale workload</h3><table><thead><tr><th>Configured workers</th><th>Peak / avg active</th><th>Operations / stages</th><th>Scheduler time</th><th>Throughput</th><th>Speedup vs 1</th></tr></thead><tbody>{scaleRuns.map((item) => { const baseline = scaleRuns.find((run) => run.configuredWorkers === 1); const speedup = baseline ? baseline.schedulerTimeMs / item.schedulerTimeMs : 0; return <tr key={item.configuredWorkers}><td>{item.configuredWorkers}</td><td>{item.peakActiveWorkers} / {item.averageActiveWorkers.toFixed(1)}</td><td>{item.totalOperations.toLocaleString()} / {item.dependencyStages}</td><td>{formatMs(item.schedulerTimeMs)}</td><td>{item.throughputOperationsPerSecond.toFixed(0)} ops/s</td><td>{speedup.toFixed(2)}×</td></tr>; })}</tbody></table><p>Actual browser Web Worker runs. Hardware concurrency: {scaleRuns[0].environment.hardwareConcurrency ?? "unknown"}. No reference-benchmark figures are used here.</p></div> : null}
    <DeterministicReasoningCostPanel />
  </section>;
}
