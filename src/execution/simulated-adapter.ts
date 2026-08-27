import type { AuthorizationArtifact } from "../xact/contracts";
import type { AuthorizationArtifactStore } from "../xact/authorization-artifact";
import type {
  AuthorizedEffect,
  ExecutionAdapter,
  ExecutionResult,
  ExecutionSubstrate,
  ExecutionValidation,
} from "./contracts";
import { validateAuthorizationArtifact } from "./artifact-guard";

/**
 * A public-safe simulated adapter implementing the substrate-neutral contract.
 * It causes no real effect; it demonstrates the boundary: validate → atomic
 * nonce consume → (simulated) execute → observe.
 */
export class SimulatedExecutionAdapter implements ExecutionAdapter {
  readonly substrate: ExecutionSubstrate;

  constructor(
    substrate: ExecutionSubstrate,
    private readonly store: AuthorizationArtifactStore,
    private readonly now: () => number = Date.now,
  ) {
    this.substrate = substrate;
  }

  canHandle(effect: AuthorizedEffect): boolean {
    return effect.substrate === this.substrate;
  }

  async validate(
    artifact: AuthorizationArtifact,
    payload: unknown,
    currentStateFingerprint: string,
  ): Promise<ExecutionValidation> {
    return validateAuthorizationArtifact(this.store, artifact, payload, currentStateFingerprint, this.now);
  }

  async execute(effect: AuthorizedEffect): Promise<ExecutionResult> {
    // Atomic nonce consumption at the execution boundary: two concurrent calls
    // for the same nonce yield exactly one success.
    if (!this.store.consumeNonce(effect.artifact.nonce)) {
      return {
        executed: false,
        substrate: this.substrate,
        error: "Nonce already consumed (replay blocked).",
      };
    }
    return {
      executed: true,
      substrate: this.substrate,
      receipt: `sim_receipt_${effect.artifact.commitId.replace(/[^a-zA-Z0-9]/g, "_")}`,
    };
  }

  async observe(_effect: AuthorizedEffect, execution: ExecutionResult): Promise<unknown> {
    // The simulated "world" is the scenario state; the engine applies the effect
    // and this seam reports what the adapter can observe. A real adapter would
    // read actual post-execution state here.
    return { substrate: this.substrate, receipt: execution.receipt };
  }
}
