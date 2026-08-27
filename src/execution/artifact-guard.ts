import type { AuthorizationArtifact } from "../xact/contracts";
import {
  type AuthorizationArtifactStore,
  stableFingerprint,
} from "../xact/authorization-artifact";
import type { ExecutionValidation } from "./contracts";

/**
 * Public, substrate-independent guard for an already-issued authorization
 * artifact. This is deliberately a validation seam, not a resolution engine.
 */
export function isWellFormedAuthorizationArtifact(artifact: AuthorizationArtifact): boolean {
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

/** Read-only checks 1–6 from ADR 0004. Nonce consumption remains in execute(). */
export function validateAuthorizationArtifact(
  store: AuthorizationArtifactStore,
  artifact: AuthorizationArtifact,
  payload: unknown,
  currentStateFingerprint: string,
  now: () => number = Date.now,
): ExecutionValidation {
  const checks: string[] = [];

  if (!store.issued(artifact)) {
    return { valid: false, reason: "Artifact was not issued by Xact (or was tampered).", checks: [...checks, "authentic: FAIL"] };
  }
  checks.push("authentic: PASS");

  if (!isWellFormedAuthorizationArtifact(artifact)) {
    return { valid: false, reason: "Artifact is malformed.", checks: [...checks, "well-formed: FAIL"] };
  }
  checks.push("well-formed: PASS");

  if (artifact.expiresAtEpochMs <= now()) {
    return { valid: false, reason: "Artifact has expired.", checks: [...checks, "unexpired: FAIL"] };
  }
  checks.push("unexpired: PASS");

  if (store.nonceConsumed(artifact.nonce)) {
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
