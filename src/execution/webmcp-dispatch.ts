import { stableFingerprint } from "../xact/authorization-artifact";
import type { AuthorizedEffect } from "./contracts";

/**
 * Private, in-page hand-off between the already-authorized adapter and a
 * WebMCP tool. A registered tool cannot create a dispatch by itself: it can
 * only claim the one exact effect prepared by the adapter after Commit.
 */
export class WebMCPDispatchRegistry {
  private readonly pending = new Map<string, AuthorizedEffect>();

  prepare(effect: AuthorizedEffect): void {
    this.pending.set(effect.artifact.nonce, effect);
  }

  cancel(effect: AuthorizedEffect): void {
    this.pending.delete(effect.artifact.nonce);
  }

  claim(input: unknown): AuthorizedEffect | undefined {
    const candidate = input && typeof input === "object" ? input as {
      authorizationArtifact?: { nonce?: unknown };
      effect?: unknown;
    } : undefined;
    const nonce = candidate?.authorizationArtifact?.nonce;
    if (typeof nonce !== "string") return undefined;

    const prepared = this.pending.get(nonce);
    if (!prepared) return undefined;
    if (
      stableFingerprint(prepared.artifact) !== stableFingerprint(candidate?.authorizationArtifact)
      || stableFingerprint(prepared.payload) !== stableFingerprint(candidate?.effect)
    ) return undefined;

    this.pending.delete(nonce);
    return prepared;
  }
}
