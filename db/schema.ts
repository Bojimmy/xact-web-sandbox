/** Durable, identity-bound allowance for live O-Agent reasoning in the judge demo. */
export const judgeLiveReasoningBudgetSchema = `
  CREATE TABLE IF NOT EXISTS judge_live_reasoning_budget (
    user_id TEXT PRIMARY KEY NOT NULL,
    successful_requests INTEGER NOT NULL DEFAULT 0,
    updated_at_epoch_ms INTEGER NOT NULL
  )
`;
