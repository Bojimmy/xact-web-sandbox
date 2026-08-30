import type { FoundryActivity, FoundryEventType } from "./foundry-liaison";

export type ToolflowStageId = "INTENT" | "BOUNDARY" | "REASON" | "COMMIT" | "BUILD" | "HOST" | "RUN";
export type ToolflowStageState = "WAITING" | "ACTIVE" | "COMPLETE" | "BLOCKED";

export interface ToolflowStage {
  readonly id: ToolflowStageId;
  readonly label: string;
  readonly state: ToolflowStageState;
  readonly detail: string;
}

const STAGES: readonly { id: ToolflowStageId; label: string; types: readonly FoundryEventType[] }[] = [
  { id: "INTENT", label: "Intent", types: ["RESOLVE"] },
  { id: "BOUNDARY", label: "Door + Ledger", types: ["DOOR", "LEDGER", "GOVERNANCE", "BLOCKED"] },
  { id: "REASON", label: "O-Agent", types: ["REASON_STARTED", "REASON_EVIDENCE", "REASON_FAILED", "RE_ENTRY"] },
  { id: "COMMIT", label: "Commit", types: ["AUTHORIZATION", "COMMIT"] },
  { id: "BUILD", label: "X-Node build", types: ["BUILD"] },
  { id: "HOST", label: "WebMCP host", types: ["REGISTER", "OBSERVE", "VERIFY"] },
  { id: "RUN", label: "Run tool", types: [] },
];

function stateFor(events: readonly FoundryActivity[]): ToolflowStageState {
  if (events.some((event) => event.status === "BLOCK")) return "BLOCKED";
  if (events.some((event) => event.status === "PENDING")) return "ACTIVE";
  return events.length ? "COMPLETE" : "WAITING";
}

/**
 * Converts only actual Foundry events into a visual toolflow. The projection
 * cannot promote a stage to COMPLETE just because a later stage exists.
 */
export function projectFoundryToolflow(
  activity: readonly FoundryActivity[],
  invocation?: { status: string },
): readonly ToolflowStage[] {
  return STAGES.map((stage) => {
    if (stage.id === "RUN") {
      if (!invocation) return { ...stage, state: "WAITING", detail: "No tool invocation has occurred." };
      const blocked = invocation.status === "BLOCKED_NO_AUTHORITY";
      return {
        ...stage,
        state: blocked ? "BLOCKED" : "COMPLETE",
        detail: blocked ? "Runtime blocked the consequence before it ran." : `Runtime returned ${invocation.status.replaceAll("_", " ")}.`,
      };
    }
    const events = activity.filter((event) => stage.types.includes(event.type));
    const latest = events.at(-1);
    return {
      ...stage,
      state: stateFor(events),
      detail: latest?.detail ?? "Not emitted by the current run.",
    };
  });
}

export function toolflowStateLabel(state: ToolflowStageState): string {
  return state === "COMPLETE" ? "VERIFIED EVENT" : state === "ACTIVE" ? "IN PROGRESS" : state === "BLOCKED" ? "BLOCKED" : "NOT EMITTED";
}
