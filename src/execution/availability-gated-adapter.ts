import type {
  AuthorizedEffect,
  ExecutionAdapter,
  ExecutionObservation,
  ExecutionResult,
  ExecutionSubstrate,
  ExecutionValidation,
} from "./contracts";
import type { AuthorizationArtifact } from "../xact/contracts";

/**
 * Demo/runtime availability switch. It affects only capability routing and
 * delegates every authority and execution check to the wrapped adapter.
 */
export class AvailabilityGatedExecutionAdapter implements ExecutionAdapter {
  readonly substrate: ExecutionSubstrate;

  constructor(
    private readonly delegate: ExecutionAdapter,
    private readonly enabled: () => boolean,
  ) {
    this.substrate = delegate.substrate;
  }

  canHandle(effect: AuthorizedEffect): boolean {
    return this.enabled() && this.delegate.canHandle(effect);
  }

  validate(artifact: AuthorizationArtifact, payload: unknown, currentStateFingerprint: string): Promise<ExecutionValidation> {
    return this.delegate.validate(artifact, payload, currentStateFingerprint);
  }

  execute(effect: AuthorizedEffect): Promise<ExecutionResult> {
    return this.delegate.execute(effect);
  }

  observe(effect: AuthorizedEffect, execution: ExecutionResult): Promise<ExecutionObservation> {
    return this.delegate.observe(effect, execution);
  }
}
