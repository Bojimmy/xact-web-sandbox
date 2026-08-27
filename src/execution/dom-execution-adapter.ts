import type { AuthorizationArtifact } from "../xact/contracts";
import type { AuthorizationArtifactStore } from "../xact/authorization-artifact";
import { validateAuthorizationArtifact } from "./artifact-guard";
import type {
  AuthorizedEffect,
  ExecutionAdapter,
  ExecutionObservation,
  ExecutionResult,
  ExecutionValidation,
} from "./contracts";

/** Public browser/accessibility capability; it has no authority responsibilities. */
export interface DOMExecutionClient {
  isAvailable(): boolean;
  activate(effect: AuthorizedEffect): Promise<{ receipt: unknown }>;
  observeAction(effect: AuthorizedEffect, receipt: unknown): Promise<ExecutionObservation>;
}

export class DOMExecutionAdapter implements ExecutionAdapter {
  readonly substrate = "DOM" as const;

  constructor(
    private readonly client: DOMExecutionClient,
    private readonly store: AuthorizationArtifactStore,
    private readonly now: () => number = Date.now,
  ) {}

  canHandle(effect: AuthorizedEffect): boolean {
    return effect.substrate === this.substrate && this.client.isAvailable();
  }

  async validate(artifact: AuthorizationArtifact, payload: unknown, currentStateFingerprint: string): Promise<ExecutionValidation> {
    return validateAuthorizationArtifact(this.store, artifact, payload, currentStateFingerprint, this.now);
  }

  async execute(effect: AuthorizedEffect): Promise<ExecutionResult> {
    if (!this.store.consumeNonce(effect.artifact.nonce)) {
      return { executed: false, substrate: this.substrate, error: "Nonce already consumed (replay blocked)." };
    }
    try {
      const { receipt } = await this.client.activate(effect);
      if (receipt === undefined || receipt === null || receipt === "") {
        return { executed: false, substrate: this.substrate, error: "DOM activation returned no execution receipt." };
      }
      return { executed: true, substrate: this.substrate, receipt };
    } catch (cause) {
      return { executed: false, substrate: this.substrate, error: cause instanceof Error ? cause.message : "DOM activation failed." };
    }
  }

  async observe(effect: AuthorizedEffect, execution: ExecutionResult): Promise<ExecutionObservation> {
    if (!execution.executed || execution.receipt === undefined) throw new Error("No executed DOM receipt to observe.");
    return this.client.observeAction(effect, execution.receipt);
  }
}
