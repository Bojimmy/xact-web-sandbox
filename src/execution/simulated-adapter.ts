import type {
  AuthorizedEffect,
  ExecutionAdapter,
  ExecutionResult,
  ExecutionSubstrate,
} from "./contracts";

export class SimulatedExecutionAdapter implements ExecutionAdapter {
  readonly substrate: ExecutionSubstrate;

  constructor(substrate: ExecutionSubstrate = "WEBMCP") {
    this.substrate = substrate;
  }

  async canExecute(effect: AuthorizedEffect): Promise<boolean> {
    return effect.substrate === this.substrate && effect.commitId.length > 0;
  }

  async execute(effect: AuthorizedEffect): Promise<ExecutionResult> {
    if (!(await this.canExecute(effect))) {
      return {
        executed: false,
        substrate: this.substrate,
        error: "Effect is not bound to this simulated execution adapter.",
      };
    }

    return {
      executed: true,
      substrate: this.substrate,
      receipt: `sim_receipt_${effect.commitId.replace(/[^a-zA-Z0-9]/g, "_")}`,
    };
  }
}
