/** Durable, public-safe workflow state for the ChatGPT Boss handoff. */
export const bossSessionSchema = `
  CREATE TABLE IF NOT EXISTS xact_boss_sessions (
    run_id TEXT PRIMARY KEY NOT NULL,
    session_json TEXT NOT NULL,
    updated_at_epoch_ms INTEGER NOT NULL,
    expires_at_epoch_ms INTEGER NOT NULL
  )
`;
