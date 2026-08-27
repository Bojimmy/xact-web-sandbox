export type ExecutionSubstrate =
  | "LOCAL"
  | "WEBMCP"
  | "DOM"
  | "VISION"
  | "NATIVE_API";

export interface AuthorizedEffect {
  commitId: string;
  substrate: ExecutionSubstrate;
  payload: unknown;
}

export interface ExecutionResult {
  executed: boolean;
  substrate: ExecutionSubstrate;
  receipt?: unknown;
  error?: string;
}

export interface ExecutionAdapter {
  readonly substrate: ExecutionSubstrate;
  canExecute(effect: AuthorizedEffect): Promise<boolean>;
  execute(effect: AuthorizedEffect): Promise<ExecutionResult>;
}
