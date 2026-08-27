import { BrowserScaleWorkloadRunner } from "../construction/browser-scale-runner";
import type { DeterministicWorkloadProvider } from "./deterministic-reasoning-cost";

/** Bridges the measured 6A.2 browser workload into ADR 0011 cost accounting. */
export class BrowserDeterministicWorkloadProvider implements DeterministicWorkloadProvider {
  constructor(private readonly runner = new BrowserScaleWorkloadRunner()) {}

  available(): boolean { return this.runner.available(); }

  async run() {
    const result = await this.runner.run(10);
    return {
      operations: result.totalOperations,
      schedulerTimeMs: result.schedulerTimeMs,
      throughputOpsPerSec: result.throughputOperationsPerSecond,
      checksum: result.checksum,
    };
  }
}
