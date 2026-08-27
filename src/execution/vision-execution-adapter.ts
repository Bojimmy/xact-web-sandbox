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
import { targetFromPayload } from "./targeted-payload";

/**
 * A vision capability may locate a visual target, but it may not replace the
 * target bound in the effect or decide whether activation is permitted.
 */
export interface VisionExecutionClient {
  isAvailable(): boolean;
  locate(target: string): Promise<{ target: string }>;
  activateLocatedTarget(target: string, effect: AuthorizedEffect): Promise<{ receipt: unknown }>;
  observeAction(effect: AuthorizedEffect, receipt: unknown): Promise<ExecutionObservation>;
}

export class VisionExecutionAdapter implements ExecutionAdapter {
  readonly substrate = "VISION" as const;

  constructor(
    private readonly client: VisionExecutionClient,
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
      const target = targetFromPayload(effect.payload);
      const located = await this.client.locate(target);
      if (located.target !== target) {
        return { executed: false, substrate: this.substrate, error: "Vision located a target different from the authorized effect." };
      }
      const { receipt } = await this.client.activateLocatedTarget(target, effect);
      if (receipt === undefined || receipt === null || receipt === "") {
        return { executed: false, substrate: this.substrate, error: "Vision activation returned no execution receipt." };
      }
      return { executed: true, substrate: this.substrate, receipt };
    } catch (cause) {
      return { executed: false, substrate: this.substrate, error: cause instanceof Error ? cause.message : "Vision activation failed." };
    }
  }

  async observe(effect: AuthorizedEffect, execution: ExecutionResult): Promise<ExecutionObservation> {
    if (!execution.executed || execution.receipt === undefined) throw new Error("No executed Vision receipt to observe.");
    return this.client.observeAction(effect, execution.receipt);
  }
}
