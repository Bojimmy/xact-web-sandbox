/**
 * The only contract through which optional model reasoning enters the sandbox.
 * It returns evidence for a later Xact re-entry; it has no Commit, execution,
 * policy, capability, or state-mutation method.
 */
export type ReasoningTelemetryKind = "LIVE_SANDBOX_MEASUREMENT" | "SIMULATED_O_AGENT";

export interface ReasoningRequest {
  context: Readonly<Record<string, unknown>>;
  unresolved: readonly string[];
}

export interface ReasoningEvidence {
  claim: string;
  resolves: readonly string[];
}

export interface ReasoningResult {
  evidence: readonly ReasoningEvidence[];
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
}

export interface OAgentProvider {
  readonly telemetryKind: ReasoningTelemetryKind;
  readonly providerName: string;
  reason(request: ReasoningRequest): Promise<ReasoningResult>;
}

function validateResult(value: unknown): ReasoningResult {
  if (!value || typeof value !== "object") throw new Error("O-Agent provider returned no structured result.");
  const candidate = value as Partial<ReasoningResult>;
  if (!Array.isArray(candidate.evidence) || !Number.isFinite(candidate.inputTokens) || !Number.isFinite(candidate.outputTokens) || !Number.isFinite(candidate.latencyMs)) {
    throw new Error("O-Agent provider returned an invalid structured result.");
  }
  if (candidate.evidence.some((item) => !item || typeof item.claim !== "string" || !Array.isArray(item.resolves) || Array.from(item.resolves).some((field: unknown) => typeof field !== "string"))) {
    throw new Error("O-Agent provider returned invalid evidence.");
  }
  return candidate as ReasoningResult;
}

/** Public-safe offline fallback. Its provenance can never be presented as live. */
export class SimulatedOAgentProvider implements OAgentProvider {
  readonly telemetryKind = "SIMULATED_O_AGENT" as const;
  readonly providerName = "Public-safe simulated O-Agent";

  async reason(request: ReasoningRequest): Promise<ReasoningResult> {
    const started = performance.now();
    const fields = request.unresolved.filter((field) => typeof field === "string" && field.length > 0);
    return {
      evidence: fields.map((field) => ({ claim: `Public-safe simulated evidence resolves ${field}.`, resolves: [field] })),
      inputTokens: 12 + fields.length * 3,
      outputTokens: 8 + fields.length * 2,
      latencyMs: Math.max(0, performance.now() - started),
    };
  }
}

/**
 * Browser-side client for a protected same-origin endpoint. It never receives
 * a model credential and rejects an endpoint that labels simulated output live.
 */
export class SecureEndpointOAgentProvider implements OAgentProvider {
  readonly telemetryKind = "LIVE_SANDBOX_MEASUREMENT" as const;
  readonly providerName = "Secure O-Agent endpoint";

  constructor(
    private readonly endpoint = "/api/o-agent",
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async reason(request: ReasoningRequest): Promise<ReasoningResult> {
    const response = await this.fetcher(this.endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
    });
    if (!response.ok) throw new Error(`Secure O-Agent endpoint unavailable (${response.status}).`);
    const payload = await response.json() as { kind?: ReasoningTelemetryKind; result?: unknown };
    if (payload.kind !== "LIVE_SANDBOX_MEASUREMENT") throw new Error("Secure O-Agent endpoint did not attest a live measurement.");
    return validateResult(payload.result);
  }
}
