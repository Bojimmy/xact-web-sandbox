import type { OAgentProvider, ReasoningTelemetryKind } from "./o-agent-provider";

export type CostComparisonMode = "NAIVE_REASONING" | "XACT_HYBRID";
export type TelemetryKind = ReasoningTelemetryKind | "ESTIMATED_COST";

export interface DeterministicPathMetrics {
  kind: "LIVE_SANDBOX_MEASUREMENT";
  operations: number;
  schedulerTimeMs: number;
  throughputOpsPerSec: number;
  inferenceCalls: 0;
  inferenceTokens: 0;
  checksum: number;
}

export interface ReasoningPathMetrics {
  kind: ReasoningTelemetryKind;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  wallTimeMs: number;
  latencySamplesMs: number[];
}

export interface CostComparisonRun {
  mode: CostComparisonMode;
  totalOperations: number;
  deterministicOperations: number;
  reasoningOperations: number;
  deterministic: DeterministicPathMetrics;
  reasoning: ReasoningPathMetrics;
  verification: { timeMs: number; kind: "LIVE_SANDBOX_MEASUREMENT" };
  totalTimeMs: number;
  estimatedCostUsd?: { kind: "ESTIMATED_COST"; value: number; pricePer1kTokensUsd: number };
  checksum: number;
}

export interface CostComparisonSummary {
  mode: CostComparisonMode;
  samples: CostComparisonRun[];
  mean: { totalTimeMs: number; deterministicSchedulerTimeMs: number; reasoningWallTimeMs: number };
  stddev: { totalTimeMs: number; deterministicSchedulerTimeMs: number; reasoningWallTimeMs: number };
}

export interface DeterministicWorkloadProvider {
  run(): Promise<Pick<DeterministicPathMetrics, "operations" | "schedulerTimeMs" | "throughputOpsPerSec" | "checksum">>;
}

export interface CostTelemetryOptions {
  mode: CostComparisonMode;
  promoted?: boolean;
  estimatedPricePer1kTokensUsd?: number;
}

export const COST_TOTAL_OPERATIONS = 10_011;
export const COST_NAIVE_STAGE_CALLS = 47;
export const COST_HYBRID_UNRESOLVED_CALLS = 30;
export const COST_PROMOTED_HYBRID_CALLS = 4;
export const COST_VARIANCE_RUNS = 10;

function mean(values: readonly number[]): number {
  return values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0;
}

function stddev(values: readonly number[]): number {
  if (!values.length) return 0;
  const average = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - average) ** 2)));
}

/**
 * Cost accounting only. Provider output remains evidence; a caller must still
 * feed it through Resolve → re-entry → Commit before any consequence exists.
 */
export class DeterministicReasoningCostRunner {
  constructor(
    private readonly deterministicWorkload: DeterministicWorkloadProvider,
    private readonly oAgent: OAgentProvider,
  ) {}

  async run(options: CostTelemetryOptions): Promise<CostComparisonRun> {
    const started = performance.now();
    const deterministicResult = await this.deterministicWorkload.run();
    const deterministic: DeterministicPathMetrics = {
      kind: "LIVE_SANDBOX_MEASUREMENT",
      ...deterministicResult,
      inferenceCalls: 0,
      inferenceTokens: 0,
    };
    const calls = this.reasoningCalls(options.mode, Boolean(options.promoted));
    const reasoningStarted = performance.now();
    let inputTokens = 0;
    let outputTokens = 0;
    const latencySamplesMs: number[] = [];
    for (let index = 0; index < calls; index += 1) {
      const result = await this.oAgent.reason({
        context: { workload: "construction-cost-v1", mode: options.mode, ordinal: index },
        unresolved: [`construction:semantic-${index}`],
      });
      inputTokens += result.inputTokens;
      outputTokens += result.outputTokens;
      latencySamplesMs.push(result.latencyMs);
    }
    const reasoning: ReasoningPathMetrics = {
      kind: this.oAgent.telemetryKind,
      calls,
      inputTokens,
      outputTokens,
      totalTokens: inputTokens + outputTokens,
      wallTimeMs: Math.max(0, performance.now() - reasoningStarted),
      latencySamplesMs,
    };
    const verificationStarted = performance.now();
    const checksum = deterministic.checksum;
    // The cost experiment's artifact witness is deterministic and must remain
    // independent of reasoning fan-out.
    if (!Number.isInteger(checksum)) throw new Error("Deterministic workload produced no checksum witness.");
    const verification = { kind: "LIVE_SANDBOX_MEASUREMENT" as const, timeMs: Math.max(0, performance.now() - verificationStarted) };
    const estimatedCostUsd = options.estimatedPricePer1kTokensUsd === undefined ? undefined : {
      kind: "ESTIMATED_COST" as const,
      value: (reasoning.totalTokens / 1_000) * options.estimatedPricePer1kTokensUsd,
      pricePer1kTokensUsd: options.estimatedPricePer1kTokensUsd,
    };
    return {
      mode: options.mode,
      totalOperations: COST_TOTAL_OPERATIONS,
      deterministicOperations: COST_TOTAL_OPERATIONS - calls,
      reasoningOperations: calls,
      deterministic,
      reasoning,
      verification,
      totalTimeMs: Math.max(0, performance.now() - started),
      estimatedCostUsd,
      checksum,
    };
  }

  async runVariance(options: CostTelemetryOptions, runs = COST_VARIANCE_RUNS): Promise<CostComparisonSummary> {
    if (!Number.isInteger(runs) || runs < COST_VARIANCE_RUNS) throw new Error(`Variance protocol requires at least ${COST_VARIANCE_RUNS} serial runs.`);
    const samples: CostComparisonRun[] = [];
    for (let index = 0; index < runs; index += 1) samples.push(await this.run(options));
    const totals = samples.map((sample) => sample.totalTimeMs);
    const deterministic = samples.map((sample) => sample.deterministic.schedulerTimeMs);
    const reasoning = samples.map((sample) => sample.reasoning.wallTimeMs);
    return {
      mode: options.mode,
      samples,
      mean: { totalTimeMs: mean(totals), deterministicSchedulerTimeMs: mean(deterministic), reasoningWallTimeMs: mean(reasoning) },
      stddev: { totalTimeMs: stddev(totals), deterministicSchedulerTimeMs: stddev(deterministic), reasoningWallTimeMs: stddev(reasoning) },
    };
  }

  private reasoningCalls(mode: CostComparisonMode, promoted: boolean): number {
    if (mode === "NAIVE_REASONING") return COST_NAIVE_STAGE_CALLS;
    return promoted ? COST_PROMOTED_HYBRID_CALLS : COST_HYBRID_UNRESOLVED_CALLS;
  }
}
