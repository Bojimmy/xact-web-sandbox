import type { LiveReasoningReservation } from "./judge-live-reasoning-budget";

export interface LiveReasoningQuotaStore {
  reserve(userId: string): Promise<LiveReasoningReservation>;
  release(userId: string): Promise<unknown>;
}

export class MissingJudgeIdentityError extends Error {}
export class LiveReasoningAllowanceExhaustedError extends Error {}

/**
 * Reserves an identity-bound live call before the gateway can be reached and
 * releases it when the gateway never completed. UI counters are projections;
 * this server-side gate is the authority over spend.
 */
export async function invokeWithLiveReasoningAllowance<T>(
  userId: string | null,
  store: LiveReasoningQuotaStore,
  invoke: () => Promise<T>,
): Promise<{ readonly value: T; readonly remaining: number }> {
  if (!userId) throw new MissingJudgeIdentityError("Sign in is required for live Boss reasoning.");
  const reservation = await store.reserve(userId);
  if (!reservation.permitted) throw new LiveReasoningAllowanceExhaustedError("Live Boss reasoning allowance exhausted.");
  try {
    return { value: await invoke(), remaining: reservation.remaining };
  } catch (error) {
    await store.release(userId);
    throw error;
  }
}
