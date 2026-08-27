import type { AuthorizationArtifact } from "../xact/contracts";
import {
  InMemoryAuthorizationArtifactStore,
  stableFingerprint,
} from "../xact/authorization-artifact";
import type {
  AuthorizedEffect,
  ExecutionAdapter,
  ExecutionResult,
  ExecutionSubstrate,
  ExecutionValidation,
} from "./contracts";

function isWellFormed(artifact: AuthorizationArtifact): boolean {
  return (
    typeof artifact.commitId === "string" && artifact.commitId.length > 0 &&
    typeof artifact.effectFingerprint === "string" && artifact.effectFingerprint.length > 0 &&
    typeof artifact.baseStateFingerprint === "string" && artifact.baseStateFingerprint.length > 0 &&
    typeof artifact.actor === "string" && artifact.actor.length > 0 &&
    typeof artifact.capability === "string" && artifact.capability.length > 0 &&
    typeof artifact.nonce === "string" && artifact.nonce.length > 0 &&
    typeof artifact.issuedAtEpochMs === "number" &&
    typeof artifact.expiresAtEpochMs === "number"
  );
}

/**
 * A public-safe simulated adapter implementing the substrate-neutral contract.
 * It causes no real effect; it demonstrates the boundary: validate → atomic
 * nonce consume → (simulated) execute → observe.
 */
export class SimulatedExecutionAdapter implements ExecutionAdapter {
  readonly substrate: ExecutionSubstrate;

  constructor(
    substrate: ExecutionSubstrate,
    private readonly store: InMemoryAuthorizationArtifactStore,
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
    const checks: string[] = [];

    if (!this.store.issued(artifact)) {
      return { valid: false, reason: "Artifact was not issued by Xact (or was tampered).", checks: [...checks, "authentic: FAIL"] };
    }
    checks.push("authentic: PASS");

    if (!isWellFormed(artifact)) {
      return { valid: false, reason: "Artifact is malformed.", checks: [...checks, "well-formed: FAIL"] };
    }
    checks.push("well-formed: PASS");

    if (artifact.expiresAtEpochMs <= this.now()) {
      return { valid: false, reason: "Artifact has expired.", checks: [...checks, "unexpired: FAIL"] };
    }
    checks.push("unexpired: PASS");

    if (this.store.nonceConsumed(artifact.nonce)) {
      return { valid: false, reason: "Nonce already consumed (replay).", checks: [...checks, "unreplayed: FAIL"] };
    }
    checks.push("unreplayed: PASS");

    if (artifact.effectFingerprint !== stableFingerprint(payload)) {
      return { valid: false, reason: "Effect does not match the authorized fingerprint.", checks: [...checks, "effect-bound: FAIL"] };
    }
    checks.push("effect-bound: PASS");

    if (artifact.baseStateFingerprint !== currentStateFingerprint) {
      return { valid: false, reason: "State fingerprint is stale.", checks: [...checks, "state-fresh: FAIL"] };
    }
    checks.push("state-fresh: PASS");

    return { valid: true, checks };
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
