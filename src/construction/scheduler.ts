import type { ConstructionOperation } from "./contracts";

export interface SchedulerResult {
  operations: ConstructionOperation[];
  xNodesUsed: number;
  peakParallelOperations: number;
  averageActiveOperations: number;
  dependencyStages: number;
  sequentialEquivalentTimeMs: number;
  schedulerTimeMs: number;
  criticalPathTimeMs: number;
}

/** Bounded deterministic worker pool. Workers run only already-authorized handlers. */
export class ConstructionScheduler {
  async execute(
    operations: ConstructionOperation[],
    concurrency: number,
    handler: (operation: ConstructionOperation) => Promise<void>,
  ): Promise<SchedulerResult> {
    if (!Number.isInteger(concurrency) || concurrency < 1) throw new Error("Concurrency must be a positive integer.");
    const pending = operations.map((operation) => ({ ...operation }));
    const schedulerStarted = performance.now();
    const completed = new Set<string>();
    let peak = 0;
    let workersUsed = 0;
    let dependencyStages = 0;
    let activeSamples = 0;
    let activeTotal = 0;
    let sequentialEquivalentTimeMs = 0;
    let criticalPathTimeMs = 0;

    while (completed.size < pending.length) {
      const ready = pending
        .filter((operation) => operation.status === "AUTHORIZED" && operation.dependencies.every((dependency) => completed.has(dependency)));
      if (!ready.length) break;
      dependencyStages += 1;
      let stageCriticalTimeMs = 0;
      // A deterministic ready-set is dispatched in bounded batches. Every
      // operation in a batch has already passed the Commit gate.
      for (let start = 0; start < ready.length; start += concurrency) {
        const batch = ready.slice(start, start + concurrency);
        workersUsed = Math.max(workersUsed, batch.length);
        peak = Math.max(peak, batch.length);
        activeSamples += 1;
        activeTotal += batch.length;
        batch.forEach((operation) => { operation.status = "RUNNING"; });
        const durations = await Promise.all(batch.map(async (operation) => {
          const operationStarted = performance.now();
          await Promise.resolve();
          await handler(operation);
          operation.status = "COMPLETE";
          completed.add(operation.id);
          return Math.max(0, performance.now() - operationStarted);
        }));
        sequentialEquivalentTimeMs += durations.reduce((total, duration) => total + duration, 0);
        stageCriticalTimeMs = Math.max(stageCriticalTimeMs, ...durations);
      }
      criticalPathTimeMs += stageCriticalTimeMs;
    }
    const unfinished = pending.filter((operation) => operation.status !== "COMPLETE");
    if (unfinished.length) throw new Error(`Construction scheduler could not complete: ${unfinished.map((operation) => operation.id).join(", ")}`);
    return {
      operations: pending,
      xNodesUsed: workersUsed,
      peakParallelOperations: peak,
      averageActiveOperations: activeSamples ? activeTotal / activeSamples : 0,
      dependencyStages,
      sequentialEquivalentTimeMs,
      schedulerTimeMs: Math.max(0, performance.now() - schedulerStarted),
      criticalPathTimeMs,
    };
  }
}
