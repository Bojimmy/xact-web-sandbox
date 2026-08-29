import { LEVEL_VERB_PAST, type CommitOutcome } from "./run";

export type ExecutionDisposition = "EXECUTE" | "BLOCKED_NO_AUTHORITY";
export type DecoyPhase = "PICK" | "RUNNING" | "DONE";

export function executionDisposition(outcome: CommitOutcome | undefined): ExecutionDisposition {
  return outcome === "AUTHORIZED" ? "EXECUTE" : "BLOCKED_NO_AUTHORITY";
}

export function canAdvanceAuthorizedExecution(
  attemptCount: number,
  decoyChoice: "AUTHORIZED" | "DECOY" | null,
  decoyPhase: DecoyPhase,
): boolean {
  return attemptCount > 0 && decoyChoice !== null && decoyPhase === "DONE";
}

export function levelCompletionLabel(
  level: number,
  commitOutcome: CommitOutcome | undefined,
): string {
  if (level === 3) return commitOutcome === "AUTHORIZED" ? "AUTHORIZED" : "REFUSED";
  if (level === 4) return commitOutcome === "AUTHORIZED" ? "EXECUTED" : "NOT EXECUTED";
  return LEVEL_VERB_PAST[level] ?? "COMPLETE";
}
