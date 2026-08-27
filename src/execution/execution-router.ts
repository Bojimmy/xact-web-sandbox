import type {
  AuthorizedEffect,
  ExecutionAdapter,
  ExecutionSubstrate,
} from "./contracts";

export interface ExecutionRouterSelection {
  adapter: ExecutionAdapter | null; // null → no capable adapter (fail closed)
  effect: AuthorizedEffect | null; // same artifact + payload, routed substrate only
  reason: string; // human-readable selection trace
}

/**
 * Capability routing after Commit — never authority determination. Selects the
 * most deterministic capable adapter by EXPLICIT policy priority (never array
 * order, never model choice) and explains its decision.
 */
export interface ExecutionRouter {
  select(
    effect: AuthorizedEffect,
    availableAdapters: ExecutionAdapter[],
  ): Promise<ExecutionRouterSelection>;
}

export const DEFAULT_SUBSTRATE_PRIORITY: ExecutionSubstrate[] = [
  "LOCAL",
  "WEBMCP",
  "DOM",
  "VISION",
  "NATIVE_API",
];

export class DeterministicExecutionRouter implements ExecutionRouter {
  constructor(
    private readonly priority: ExecutionSubstrate[] = DEFAULT_SUBSTRATE_PRIORITY,
  ) {}

  async select(
    effect: AuthorizedEffect,
    availableAdapters: ExecutionAdapter[],
  ): Promise<ExecutionRouterSelection> {
    const bySubstrate = new Map(availableAdapters.map((a) => [a.substrate, a]));
    const unavailable: string[] = [];

    for (const substrate of this.priority) {
      const adapter = bySubstrate.get(substrate);
      // Routing changes only HOW the already-bound effect is delivered. The
      // artifact and payload are preserved exactly; adapters cannot alter them.
      const routedEffect: AuthorizedEffect = { ...effect, substrate };
      if (adapter && adapter.canHandle(routedEffect)) {
        const prefix = unavailable.length
          ? `${unavailable.join(" unavailable → ")} unavailable → `
          : "";
        const note = unavailable.length
          ? "fallback substrate"
          : "policy-preferred structured substrate";
        return {
          adapter,
          effect: routedEffect,
          reason: `${prefix}${substrate} selected — capability available + ${note}`,
        };
      }
      unavailable.push(substrate);
    }

    return {
      adapter: null,
      effect: null,
      reason: `${unavailable.join(" unavailable → ")} unavailable — no capable adapter (fail closed)`,
    };
  }
}
