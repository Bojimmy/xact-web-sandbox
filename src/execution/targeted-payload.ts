/** Target identity must be included inside the effect payload fingerprint. */
export interface TargetedExecutionPayload {
  target: string;
}

export function targetFromPayload(payload: unknown): string {
  const target = payload && typeof payload === "object"
    ? (payload as Partial<TargetedExecutionPayload>).target
    : undefined;
  if (typeof target !== "string" || target.length === 0) {
    throw new Error("Execution payload has no bound target.");
  }
  return target;
}
