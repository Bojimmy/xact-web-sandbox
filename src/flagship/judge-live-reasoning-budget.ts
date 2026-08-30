export const LIVE_REASONING_CALLS_PER_JUDGE = 3;

export interface LiveReasoningBudget {
  readonly maximum: number;
  readonly used: number;
  readonly remaining: number;
}

export function liveReasoningBudget(used: number, maximum = LIVE_REASONING_CALLS_PER_JUDGE): LiveReasoningBudget {
  const normalizedMaximum = Math.max(0, Math.floor(maximum));
  const normalizedUsed = Math.min(normalizedMaximum, Math.max(0, Math.floor(used)));
  return {
    maximum: normalizedMaximum,
    used: normalizedUsed,
    remaining: normalizedMaximum - normalizedUsed,
  };
}

export function hasLiveReasoningAllowance(used: number, maximum = LIVE_REASONING_CALLS_PER_JUDGE): boolean {
  return liveReasoningBudget(used, maximum).remaining > 0;
}
