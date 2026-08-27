import type { AuthorizationArtifact } from "./contracts";

/**
 * Public-safe authenticity oracle. In production this role is signature
 * verification; the sandbox must NOT reconstruct signing, so the store is the
 * source of truth for "did Xact issue this exact artifact?".
 */
export interface AuthorizationArtifactStore {
  /** Authenticity: was this EXACT artifact (all fields) issued? Tampering any field fails. */
  issued(artifact: AuthorizationArtifact): boolean;
  /** True if the nonce has already been consumed (replay fast-path). */
  nonceConsumed(nonce: string): boolean;
  /** Atomic replay protection: mark the nonce used iff not already used. */
  consumeNonce(nonce: string): boolean;
}

/**
 * Deterministic structural fingerprint. Not a cryptographic hash — it is a
 * stable string over the value's structure so two equal effects always have the
 * same fingerprint regardless of key order. Used to bind an effect to an artifact.
 */
export function stableFingerprint(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableFingerprint).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${JSON.stringify(k)}:${stableFingerprint(v)}`);
  return `{${entries.join(",")}}`;
}

const DEFAULT_TTL_MS = 60_000;

export interface ArtifactIssueParams {
  commitId: string;
  effectFingerprint: string;
  baseStateFingerprint: string;
  actor: string;
  capability: string;
}

/** Mints an artifact at AUTHORIZED Commit and records it in the store. */
export class AuthorizationArtifactIssuer {
  constructor(
    private readonly store: InMemoryAuthorizationArtifactStore,
    private readonly now: () => number = Date.now,
    private readonly ttlMs: number = DEFAULT_TTL_MS,
  ) {}

  issue(params: ArtifactIssueParams): AuthorizationArtifact {
    const issuedAtEpochMs = this.now();
    const artifact: AuthorizationArtifact = {
      ...params,
      nonce: this.nonce(params.commitId),
      issuedAtEpochMs,
      expiresAtEpochMs: issuedAtEpochMs + this.ttlMs,
    };
    this.store.record(artifact);
    return artifact;
  }

  private nonce(commitId: string): string {
    return `nonce:${commitId}:${this.now()}:${Math.random().toString(36).slice(2)}`;
  }
}

/** In-memory, single-flight source of truth for issued artifacts + consumed nonces. */
export class InMemoryAuthorizationArtifactStore implements AuthorizationArtifactStore {
  private readonly issuedByCommit = new Map<string, AuthorizationArtifact>();
  private readonly usedNonces = new Set<string>();

  record(artifact: AuthorizationArtifact): void {
    this.issuedByCommit.set(artifact.commitId, artifact);
  }

  issued(artifact: AuthorizationArtifact): boolean {
    const recorded = this.issuedByCommit.get(artifact.commitId);
    if (!recorded) return false;
    return stableFingerprint(recorded) === stableFingerprint(artifact);
  }

  nonceConsumed(nonce: string): boolean {
    return this.usedNonces.has(nonce);
  }

  consumeNonce(nonce: string): boolean {
    if (this.usedNonces.has(nonce)) return false;
    this.usedNonces.add(nonce);
    return true;
  }
}
