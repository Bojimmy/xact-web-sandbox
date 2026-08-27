import type { AuthorizationArtifact } from "../xact/contracts";
import type { AuthorizationArtifactStore } from "../xact/authorization-artifact";
import { validateAuthorizationArtifact } from "./artifact-guard";
import type {
  AuthorizedEffect,
  ExecutionAdapter,
  ExecutionResult,
  ExecutionValidation,
} from "./contracts";

/**
 * Transport boundary for WebMCP. It neither issues nor interprets an
 * AuthorizationArtifact; it only carries an effect already cleared by Commit.
 */
export interface WebMCPExecutionClient {
  isAvailable(): boolean;
  requestAction(effect: AuthorizedEffect): Promise<{ receipt: unknown }>;
  observeAction(receipt: unknown): Promise<unknown>;
}

/**
 * A consequential WebMCP adapter. The same public artifact guard used by the
 * local simulator is enforced before the transport call; transport failure is
 * explicitly a non-execution result and never a fabricated receipt.
 */
export class WebMCPExecutionAdapter implements ExecutionAdapter {
  readonly substrate = "WEBMCP" as const;

  constructor(
    private readonly client: WebMCPExecutionClient,
    private readonly store: AuthorizationArtifactStore,
    private readonly now: () => number = Date.now,
  ) {}

  canHandle(effect: AuthorizedEffect): boolean {
    return effect.substrate === this.substrate && this.client.isAvailable();
  }

  async validate(
    artifact: AuthorizationArtifact,
    payload: unknown,
    currentStateFingerprint: string,
  ): Promise<ExecutionValidation> {
    return validateAuthorizationArtifact(this.store, artifact, payload, currentStateFingerprint, this.now);
  }

  async execute(effect: AuthorizedEffect): Promise<ExecutionResult> {
    // Compare-and-mark happens immediately before the consequential request.
    // If the transport fails, the nonce deliberately remains spent: retrying a
    // potentially ambiguous consequence requires a fresh Commit decision.
    if (!this.store.consumeNonce(effect.artifact.nonce)) {
      return {
        executed: false,
        substrate: this.substrate,
        error: "Nonce already consumed (replay blocked).",
      };
    }

    try {
      const response = await this.client.requestAction(effect);
      if (response.receipt === undefined || response.receipt === null || response.receipt === "") {
        return {
          executed: false,
          substrate: this.substrate,
          error: "WebMCP request returned no execution receipt.",
        };
      }
      return { executed: true, substrate: this.substrate, receipt: response.receipt };
    } catch (cause) {
      return {
        executed: false,
        substrate: this.substrate,
        error: cause instanceof Error ? cause.message : "WebMCP transport failed.",
      };
    }
  }

  async observe(_effect: AuthorizedEffect, execution: ExecutionResult): Promise<unknown> {
    if (!execution.executed || execution.receipt === undefined) {
      return { observed: false, reason: "No executed WebMCP receipt to observe." };
    }
    try {
      return await this.client.observeAction(execution.receipt);
    } catch (cause) {
      return {
        observed: false,
        reason: cause instanceof Error ? cause.message : "WebMCP observation failed.",
      };
    }
  }
}
