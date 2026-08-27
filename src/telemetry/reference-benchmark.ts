import type { BenchmarkReference } from "./contracts";

export const referenceXactBenchmark: BenchmarkReference = Object.freeze({
  kind: "REFERENCE_BENCHMARK",
  appliesTo: "REFERENCE_IMPLEMENTATION_NOT_SANDBOX",
  meanDecisionLatencyUs: 9,
  medianDecisionLatencyUs: 8,
  p95DecisionLatencyUs: 10.8,
  p99DecisionLatencyUs: 24.3,
  throughputDecisionsPerSecond: 109_500,
  substrate: "Single-node CPU",
  iterations: 3_000,
  provenance: "Historical measured evidence supplied for the reference Xact implementation.",
});
