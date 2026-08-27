import type { AuthorizationArtifact } from "../xact/contracts";

export type ExecutionSubstrate =
  | "LOCAL"
  | "WEBMCP"
  | "DOM"
  | "VISION"
  | "NATIVE_API";

/** An effect an adapter is asked to cause, plus the artifact authorizing it. */
export interface AuthorizedEffect {
  artifact: AuthorizationArtifact;
  substrate: ExecutionSubstrate;
  payload: unknown;
}

export interface ExecutionResult {
  executed: boolean;
  substrate: ExecutionSubstrate;
  receipt?: unknown;
  error?: string;
}

/** Read-only guard result. `checks` is the human-readable audit trace. */
export interface ExecutionValidation {
  valid: boolean;
  reason?: string;
  checks: string[];
}

/**
 * Substrate-neutral execution contract. Every consequential adapter implements
 * this; a WebMCP adapter is just another ExecutionAdapter behind the same
 * validate + execute + observe boundary (see ADR 0004 + 0005).
 */
export interface ExecutionAdapter {
  readonly substrate: ExecutionSubstrate;

  /** Capability routing: can this adapter cause this exact authorized effect? */
  canHandle(effect: AuthorizedEffect): boolean;

  /** ADR 0004 guard: authentic → well-formed → unexpired → unreplayed → effect-bound → state-fresh. */
  validate(
    artifact: AuthorizationArtifact,
    payload: unknown,
    currentStateFingerprint: string,
  ): Promise<ExecutionValidation>;

  /** Atomic nonce consume, then cause the effect. No side effect without a valid artifact. */
  execute(effect: AuthorizedEffect): Promise<ExecutionResult>;

  /** Read what ACTUALLY happened (post-execution state) for independent verification. */
  observe(effect: AuthorizedEffect, execution: ExecutionResult): Promise<unknown>;
}
