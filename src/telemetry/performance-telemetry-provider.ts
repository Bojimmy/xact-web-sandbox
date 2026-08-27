import type { TelemetryProvider, TelemetrySample, TelemetryStage } from "./contracts";

type Clock = () => number;

export class PerformanceTelemetryProvider implements TelemetryProvider {
  private readonly samples: TelemetrySample[] = [];

  constructor(private readonly nowMilliseconds: Clock = () => performance.now()) {}

  checkpoint(): number {
    return this.samples.length;
  }

  async measure<T>(stage: TelemetryStage, operation: () => T | Promise<T>): Promise<T> {
    const started = this.nowMilliseconds();
    try {
      return await operation();
    } finally {
      const durationUs = Math.max(0, (this.nowMilliseconds() - started) * 1_000);
      this.samples.push({
        kind: "LIVE_SANDBOX_MEASUREMENT",
        stage,
        durationUs,
        measuredAt: new Date().toISOString(),
      });
    }
  }

  samplesSince(checkpoint: number): TelemetrySample[] {
    return this.samples.slice(checkpoint).map((sample) => ({ ...sample }));
  }
}
