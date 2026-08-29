// The "Run" — everything that happens during one judge session.
// Persists in localStorage so the final YOUR RUN can reflect what this
// particular participant actually did (per the user's "persistent state"
// requirement). A new run id is minted when they start a fresh attempt.

export type RunId = string;

export type AuthorizeResult = "AGREE" | "DENY";

export type CommitAction = "ALLOWED" | "EXCESS" | "SOCIAL";
export type CommitOutcome = "AUTHORIZED" | "REJECTED_EXCESS" | "REJECTED_SOCIAL" | "REJECTED_CONSTRAINT";

export type ExecuteAttempt = {
  loadout: { webmcp: boolean; dom: boolean; vision: boolean };
  substrate: "WEBMCP" | "DOM" | "VISION" | "NONE";
  result: "SUCCESS" | "FAIL";
};
export type DecoyAttempt = {
  target: "AUTHORIZED" | "DECOY";
  outcome: "BLOCKED" | "EXECUTED";
};

export type TeachOutcome = "ACCEPTED" | "REFUSED";

export interface MissionData {
  authorize?: { result: AuthorizeResult; ts: number };
  resolve?: { request: string; facts: string[]; unresolved: string[]; completed: boolean; ts: number };
  reason?:  { input: string; ambiguity: boolean; oAgentInvoked: boolean; completed: boolean; ts: number };
  commit?:  { action: CommitAction; outcome: CommitOutcome; completed: boolean; ts: number };
  execute?: {
    disposition: "EXECUTED" | "BLOCKED_NO_AUTHORITY";
    loadout: { webmcp: boolean; dom: boolean; vision: boolean };
    attempts: ExecuteAttempt[];
    decoy?: DecoyAttempt;
    blockedReason?: string;
    completed: boolean;
    ts: number;
  };
  verify?:  { inspections: string[]; completed: boolean; ts: number };
  absorb?:  { decision: "SUBMIT" | "DECLINE"; evidence: { door: boolean; ledger: boolean; effective: boolean }; completed: boolean; ts: number };
  evolve?:  { beforeCount: number; afterCount: number; completed: boolean; ts: number };
  teach?:   { input: string; bounded: boolean; outcome: TeachOutcome; reason: string; completed: boolean; ts: number };
}

export interface Run {
  id: RunId;
  traceId: string;
  startedAt: number;
  currentLevel: number; // 0..9
  completed: number[]; // completed level numbers
  denialCount: number;
  data: MissionData;
}

const RUN_KEY = "xact.run.v1";

export function newRunId(): RunId {
  return `RUN-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

export function newTraceId(): string {
  const seed = Math.random().toString(36).slice(2, 6).toUpperCase();
  const tick = Date.now().toString(36).slice(-4).toUpperCase();
  return `XS-${seed}-${tick}`;
}

export function freshRun(): Run {
  return {
    id: newRunId(),
    traceId: newTraceId(),
    startedAt: Date.now(),
    currentLevel: 0,
    completed: [],
    denialCount: 0,
    data: {},
  };
}

export function readRun(): Run | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(RUN_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Run;
  } catch {
    return null;
  }
}

export function writeRun(run: Run): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(RUN_KEY, JSON.stringify(run));
  } catch {
    // Ignore quota errors
  }
}

export function clearRun(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(RUN_KEY);
  // Also clear the old auth flag so the gate doesn't bounce them
  window.sessionStorage.removeItem("xact.authorized");
}

// Helper: is a level accessible? (level 0 is always; otherwise need prior complete)
export function isLevelUnlocked(run: Run, level: number): boolean {
  if (level === 0) return true;
  return run.completed.includes(level - 1);
}

// Helper: can a level be revisited? (only if completed)
export function canRevisitLevel(run: Run, level: number): boolean {
  return run.completed.includes(level);
}

// Mission verbs (past tense for the ladder)
export const LEVEL_VERB_PAST: Record<number, string> = {
  0: "AUTHORIZED",
  1: "RESOLVED",
  2: "REASONED",
  3: "COMMITTED",
  4: "EXECUTED",
  5: "VERIFIED",
  6: "ABSORB",
  7: "EVOLVED",
  8: "PROPOSED",
  9: "RUN",
};

export const LEVEL_VERB_PRESENT: Record<number, string> = {
  0: "AUTHORIZATION",
  1: "RESOLVE",
  2: "REASON",
  3: "COMMIT",
  4: "EXECUTE",
  5: "VERIFY",
  6: "ABSORB",
  7: "EVOLVE",
  8: "PROPOSE",
  9: "YOUR RUN",
};

export const LEVEL_PROVES: Record<number, string> = {
  0: "Capability ≠ Authority",
  1: "Determinism first",
  2: "Reason only when necessary",
  3: "Only Xact commits",
  4: "Substrate can change",
  5: "Don't trust it — prove it",
  6: "Governed learning",
  7: "Reasoning becomes rarer (−86.7%)",
  8: "The judge becomes part of the demo",
  9: "Xact explains what *they* just proved",
};

export const LEVEL_TAGLINE: Record<number, string> = {
  0: "Choose governance or ungoverned chaos",
  1: "Give Xact a request",
  2: "Submit something with genuine ambiguity",
  3: "Commit the exact candidate resolved earlier",
  4: "Toggle the execution loadout",
  5: "Inspect the resulting state",
  6: "Decide whether to submit for governance",
  7: "Run it again",
  8: "Type your own bounded WebMCP",
  9: "Hit EXPLAIN MY RUN",
};

export const LEVEL_INSTRUCTION: Record<number, string> = {
  0: "Click I AGREE to authorize participation, or NO to discover what ungoverned chaos looks like.",
  1: "Type a refund request below. Xact will decompose it into Resolved / Unresolved / Commit Constraints.",
  2: "Type a request that contains genuine ambiguity. Xact will only invoke the O-Agent on the U.",
  3: "Commit the exact request from RESOLVE. Its policy and binding results carry forward; only a fully satisfied candidate can authorize a consequence.",
  4: "Toggle the substrates on or off. Run, then re-run with substrates disabled to see how fallback changes.",
  5: "Click each evidence row to inspect it. Confirm your understanding before the level advances.",
  6: "Decide whether to submit the observed learning pattern to governance. The lifecycle will play either way.",
  7: "Run the same scenario set again. Watch the reasoning call count drop.",
  8: "Propose a bounded WebMCP capability. Xact may accept it for governance review or refuse it; Commit still controls every consequence.",
  9: "When you're ready, hit EXPLAIN MY RUN to see the evidence-grounded story of what *you* did.",
};
