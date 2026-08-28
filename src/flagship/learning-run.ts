import { executeDeterministicRange, SCALE_TOTAL_OPERATIONS } from "../construction/scale-work";
import type { OAgentProvider } from "../telemetry/o-agent-provider";

export type FlagshipReasoningProvenance = "LIVE_O_AGENT_MEASUREMENT" | "SIMULATED_O_AGENT";

export interface FlagshipReasoningEvent {
  node: string;
  provider: string;
  provenance: FlagshipReasoningProvenance;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  evidence: string;
}

export interface FlagshipLearningRun {
  phase: "COLD" | "REBUILD";
  checksum: number;
  executedConstructionOperations: number;
  deterministicallyResolvedOperations: number;
  reasoningOperations: number;
  workTimeMs: number;
  reasoningTimeMs: number;
  provider: string;
  provenance: FlagshipReasoningProvenance;
  trace: FlagshipReasoningEvent[];
}

const COLD_UNRESOLVED_NODES = 30;
const ACTIVATED_UNRESOLVED_NODES = 4;
const STAGE_1_WORK_ROUNDS = 160;

/**
 * Public-safe Stage 1 proof. It performs all 10,011 deterministic operations
 * on every run; governed activation changes only the count of U nodes that are
 * sent to the configured evidence-only provider.
 */
export class FlagshipLearningRunner {
  constructor(private readonly provider: OAgentProvider) {}

  async run(activated: boolean): Promise<FlagshipLearningRun> {
    const reasoningOperations = activated ? ACTIVATED_UNRESOLVED_NODES : COLD_UNRESOLVED_NODES;
    const workStarted = performance.now();
    const deterministic = executeDeterministicRange(0, SCALE_TOTAL_OPERATIONS, STAGE_1_WORK_ROUNDS);
    const workTimeMs = Math.max(0, performance.now() - workStarted);
    const reasoningStarted = performance.now();
    const trace: FlagshipReasoningEvent[] = [];
    const provenance: FlagshipReasoningProvenance = this.provider.telemetryKind === "LIVE_SANDBOX_MEASUREMENT"
      ? "LIVE_O_AGENT_MEASUREMENT"
      : "SIMULATED_O_AGENT";
    for (let index = 0; index < reasoningOperations; index += 1) {
      const node = `construction:semantic-${index + 1}`;
      const result = await this.provider.reason({ context: { workload: "flagship-learning-v1", phase: activated ? "rebuild" : "cold" }, unresolved: [node] });
      trace.push({ node, provider: result.provider, provenance, latencyMs: result.latencyMs, inputTokens: result.inputTokens, outputTokens: result.outputTokens, evidence: result.evidence[0]?.claim ?? "No evidence returned" });
    }
    return {
      phase: activated ? "REBUILD" : "COLD",
      checksum: deterministic.checksum,
      executedConstructionOperations: deterministic.completed,
      deterministicallyResolvedOperations: SCALE_TOTAL_OPERATIONS - reasoningOperations,
      reasoningOperations,
      workTimeMs,
      reasoningTimeMs: Math.max(0, performance.now() - reasoningStarted),
      provider: [...new Set(trace.map((event) => event.provider))].join(", ") || this.provider.providerName,
      provenance,
      trace,
    };
  }
}
