import type {
  BossSession,
  BossSessionStore,
} from "../../src/chatgpt-app/xact-boss-loop";
import { bossSessionSchema } from "../db/schema";

type D1Result = { success?: boolean };

type D1Statement = {
  bind(...values: unknown[]): D1Statement;
  first<T>(): Promise<T | null>;
  run(): Promise<D1Result>;
};

export type BossSessionDatabase = {
  prepare(query: string): D1Statement;
  batch(statements: D1Statement[]): Promise<unknown>;
};

type SessionRow = {
  session_json: string;
  expires_at_epoch_ms: number;
};

const SESSION_TTL_MS = 60 * 60 * 1000;
const MAX_SESSION_BYTES = 200_000;

/**
 * D1-backed Boss workflow state. Each tool call may run in a different worker,
 * so module memory is deliberately not part of the production contract.
 */
export class DurableBossSessionStore implements BossSessionStore {
  private ready: Promise<void> | null = null;

  constructor(private readonly db: BossSessionDatabase) {}

  private ensureSchema(): Promise<void> {
    this.ready ??= this.db.prepare(bossSessionSchema).run().then(() => undefined);
    return this.ready;
  }

  async get(runId: string): Promise<BossSession | undefined> {
    await this.ensureSchema();
    const row = await this.db
      .prepare("SELECT session_json, expires_at_epoch_ms FROM xact_boss_sessions WHERE run_id = ?")
      .bind(runId)
      .first<SessionRow>();

    if (!row) return undefined;
    if (row.expires_at_epoch_ms <= Date.now()) {
      await this.db.prepare("DELETE FROM xact_boss_sessions WHERE run_id = ?").bind(runId).run();
      return undefined;
    }

    const session = JSON.parse(row.session_json) as BossSession;
    if (session.runId !== runId) throw new Error("Boss run storage failed integrity validation.");
    return session;
  }

  async set(session: BossSession): Promise<void> {
    await this.ensureSchema();
    const sessionJson = JSON.stringify(session);
    if (sessionJson.length > MAX_SESSION_BYTES) throw new Error("Boss run exceeds the public storage boundary.");

    const now = Date.now();
    await this.db.batch([
      this.db.prepare("DELETE FROM xact_boss_sessions WHERE expires_at_epoch_ms <= ?").bind(now),
      this.db.prepare(`
        INSERT INTO xact_boss_sessions (run_id, session_json, updated_at_epoch_ms, expires_at_epoch_ms)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(run_id) DO UPDATE SET
          session_json = excluded.session_json,
          updated_at_epoch_ms = excluded.updated_at_epoch_ms,
          expires_at_epoch_ms = excluded.expires_at_epoch_ms
      `).bind(session.runId, sessionJson, now, now + SESSION_TTL_MS),
    ]);
  }
}
