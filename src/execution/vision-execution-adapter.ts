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
import {
  sameVisionTarget,
  type VisionTargetDescriptor,
  visionTargetFromPayload,
} from "./targeted-payload";

/**
 * A vision capability may locate a visual target, but it may not replace the
 * target bound in the effect or decide whether activation is permitted.
 */
export interface VisionExecutionClient {
  isAvailable(): boolean;
  /** Non-consequential capture + locate; it cannot cause an effect. */
  preflight(descriptor: VisionTargetDescriptor): Promise<{ located: VisionTargetDescriptor; captureId: string }>;
  /** Last non-consequential identity check immediately before nonce consumption. */
  recheck(preflight: { located: VisionTargetDescriptor; captureId: string }): Promise<VisionTargetDescriptor>;
  /** Consequential operation: activate precisely the descriptor cleared in preflight. */
  activateExactTarget(context: {
    preflight: { located: VisionTargetDescriptor; captureId: string };
    rechecked: VisionTargetDescriptor;
  }, effect: AuthorizedEffect): Promise<{ receipt: unknown }>;
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
    try {
      const descriptor = visionTargetFromPayload(effect.payload);
      const preflight = await this.client.preflight(descriptor);
      if (!sameVisionTarget(descriptor, preflight.located)) {
        return { executed: false, substrate: this.substrate, error: "Vision preflight located a target different from the authorized descriptor." };
      }

      const rechecked = await this.client.recheck(preflight);
      if (!sameVisionTarget(descriptor, rechecked)) {
        return { executed: false, substrate: this.substrate, error: "Vision re-check found a target different from the authorized descriptor." };
      }

      // Location is non-consequential. Spend the nonce only at the point where
      // the exact preflight result has also passed its last identity re-check.
      if (!this.store.consumeNonce(effect.artifact.nonce)) {
        return { executed: false, substrate: this.substrate, error: "Nonce already consumed (replay blocked)." };
      }
      const { receipt } = await this.client.activateExactTarget({ preflight, rechecked }, effect);
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
