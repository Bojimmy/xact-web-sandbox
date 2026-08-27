import type { DeterministicScaleRun } from "./contracts";
import { createScaleGraph, SCALE_TOTAL_OPERATIONS } from "./scale-work";

interface WorkerResponse { id: number; checksum?: number; completed?: number; durationMs?: number; error?: string; }

/**
 * Browser-worker execution model for the wide deterministic experiment. It is
 * intentionally separate from 6A.1's structural scheduler and does no I/O,
 * code generation, or arbitrary capability acquisition.
 */
export class BrowserScaleWorkloadRunner {
  available(): boolean { return typeof Worker !== "undefined"; }

  async run(configuredWorkers: 1 | 10 | 25 | 50 | 100): Promise<DeterministicScaleRun> {
    if (!this.available()) throw new Error("Browser Web Workers are unavailable; scale run not measured.");
    const graph = createScaleGraph();
    const workerCount = Math.min(configuredWorkers, Math.max(...graph.map((stage) => stage.count)));
    const workers = Array.from({ length: workerCount }, () => new Worker(new URL("./scale-worker.ts", import.meta.url), { type: "module" }));
    let checksum = 0;
    let workerComputeTimeMs = 0;
    let activeTotal = 0;
    let activeSamples = 0;
    const started = performance.now();

    try {
      for (const stage of graph) {
        const batches = this.batches(stage.start, stage.count, workerCount);
        activeTotal += batches.length;
        activeSamples += 1;
        const results = await Promise.all(batches.map((batch, index) => this.dispatch(workers[index], index, batch.start, batch.count)));
        for (const result of results) {
          checksum = (checksum ^ result.checksum) >>> 0;
          workerComputeTimeMs += result.durationMs;
        }
      }
    } finally {
      workers.forEach((worker) => worker.terminate());
    }

    const schedulerTimeMs = Math.max(0, performance.now() - started);
    return {
      kind: "LIVE_CONSTRUCTION_SCALE_WORKLOAD",
      totalOperations: SCALE_TOTAL_OPERATIONS,
      dependencyStages: graph.length,
      configuredWorkers,
      peakActiveWorkers: workerCount,
      averageActiveWorkers: activeSamples ? activeTotal / activeSamples : 0,
      schedulerTimeMs,
      workerComputeTimeMs,
      throughputOperationsPerSecond: schedulerTimeMs ? SCALE_TOTAL_OPERATIONS / (schedulerTimeMs / 1_000) : 0,
      checksum,
      environment: {
        runtime: "BROWSER_WEB_WORKERS",
        hardwareConcurrency: typeof navigator === "undefined" ? undefined : navigator.hardwareConcurrency,
        userAgent: typeof navigator === "undefined" ? undefined : navigator.userAgent,
      },
    };
  }

  private batches(start: number, count: number, workers: number): Array<{ start: number; count: number }> {
    const batchSize = Math.ceil(count / workers);
    return Array.from({ length: workers }, (_, index) => ({ start: start + index * batchSize, count: Math.max(0, Math.min(batchSize, count - index * batchSize)) })).filter((batch) => batch.count > 0);
  }

  private dispatch(worker: Worker, id: number, start: number, count: number): Promise<Required<Pick<WorkerResponse, "checksum" | "durationMs">>> {
    return new Promise((resolve, reject) => {
      const onMessage = (event: MessageEvent<WorkerResponse>) => {
        if (event.data.id !== id) return;
        cleanup();
        if (event.data.error || event.data.checksum === undefined || event.data.durationMs === undefined) reject(new Error(event.data.error ?? "Scale worker returned an incomplete result."));
        else resolve({ checksum: event.data.checksum, durationMs: event.data.durationMs });
      };
      const onError = () => { cleanup(); reject(new Error("Scale worker execution failed.")); };
      const cleanup = () => { worker.removeEventListener("message", onMessage); worker.removeEventListener("error", onError); };
      worker.addEventListener("message", onMessage);
      worker.addEventListener("error", onError);
      worker.postMessage({ id, start, count });
    });
  }
}
