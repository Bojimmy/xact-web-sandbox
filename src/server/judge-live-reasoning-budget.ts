import { judgeLiveReasoningBudgetSchema } from "../../db/schema";
import { LIVE_REASONING_CALLS_PER_JUDGE, liveReasoningBudget, type LiveReasoningBudget } from "../flagship/judge-live-reasoning-budget";

interface UsageRow {
  readonly successful_requests: number;
}

export interface LiveReasoningReservation extends LiveReasoningBudget {
  readonly permitted: boolean;
}

/**
 * D1-backed allowance. The atomic conditional update is the consequence
 * boundary: an exhausted identity cannot reach the upstream model gateway.
 */
export class JudgeLiveReasoningBudgetStore {
  private schemaReady = false;

  constructor(
    private readonly db: D1Database,
    private readonly maximum = LIVE_REASONING_CALLS_PER_JUDGE,
  ) {}

  private async ensureSchema(): Promise<void> {
    if (this.schemaReady) return;
    await this.db.prepare(judgeLiveReasoningBudgetSchema).run();
    this.schemaReady = true;
  }

  async read(userId: string): Promise<LiveReasoningBudget> {
    await this.ensureSchema();
    const row = await this.db.prepare(
      "SELECT successful_requests FROM judge_live_reasoning_budget WHERE user_id = ?",
    ).bind(userId).first<UsageRow>();
    return liveReasoningBudget(row?.successful_requests ?? 0, this.maximum);
  }

  async reserve(userId: string, now = Date.now()): Promise<LiveReasoningReservation> {
    await this.ensureSchema();
    await this.db.prepare(
      "INSERT INTO judge_live_reasoning_budget (user_id, successful_requests, updated_at_epoch_ms) VALUES (?, 0, ?) ON CONFLICT(user_id) DO NOTHING",
    ).bind(userId, now).run();
    const update = await this.db.prepare(
      "UPDATE judge_live_reasoning_budget SET successful_requests = successful_requests + 1, updated_at_epoch_ms = ? WHERE user_id = ? AND successful_requests < ?",
    ).bind(now, userId, this.maximum).run();
    const budget = await this.read(userId);
    return { ...budget, permitted: (update.meta.changes ?? 0) === 1 };
  }

  /** Reclaim a reservation only when no live gateway call was completed. */
  async release(userId: string, now = Date.now()): Promise<LiveReasoningBudget> {
    await this.ensureSchema();
    await this.db.prepare(
      "UPDATE judge_live_reasoning_budget SET successful_requests = CASE WHEN successful_requests > 0 THEN successful_requests - 1 ELSE 0 END, updated_at_epoch_ms = ? WHERE user_id = ?",
    ).bind(now, userId).run();
    return this.read(userId);
  }
}
