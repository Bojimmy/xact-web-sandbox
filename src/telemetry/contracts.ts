export type TelemetryStage =
  | "RESOLVE"
  | "POLICY"
  | "COMMIT"
  | "REASONING"
  | "REENTRY"
  | "VERIFICATION";

export interface TelemetrySample {
  kind: "LIVE_SANDBOX_MEASUREMENT";
  stage: TelemetryStage;
  durationUs: number;
  measuredAt: string;
}

export interface TelemetryProvider {
  checkpoint(): number;
  measure<T>(stage: TelemetryStage, operation: () => T | Promise<T>): Promise<T>;
  samplesSince(checkpoint: number): TelemetrySample[];
}

export interface BenchmarkReference {
  kind: "REFERENCE_BENCHMARK";
  appliesTo: "REFERENCE_IMPLEMENTATION_NOT_SANDBOX";
  meanDecisionLatencyUs: number;
  medianDecisionLatencyUs: number;
  p95DecisionLatencyUs: number;
  p99DecisionLatencyUs: number;
  throughputDecisionsPerSecond: number;
  substrate: string;
  iterations: number;
  provenance: string;
}
