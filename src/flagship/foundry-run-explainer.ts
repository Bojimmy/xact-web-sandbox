import type { FoundryInvocationResult } from "./foundry-runtime";
import type { FoundryActivity } from "./foundry-liaison";
import type { WebMCPToolDefinition } from "./webmcp-tool-builder";

/**
 * A read-only, evidence-grounded reconstruction of a Foundry build or run.
 *
 * This is intentionally separate from ADR 0015's SimulationSession explainer:
 * Foundry activity is not a SimulationSession, and coercing it into one would
 * fabricate resolution, Commit, or execution records. Every card below cites
 * either a emitted Foundry event or a returned runtime audit line.
 */
export interface FoundryExplainerCard {
  id: string;
  title: string;
  primary: string;
  supporting: readonly string[];
  evidenceRefs: readonly string[];
  truth: "LIVE" | "NOT_MEASURED";
}

export interface FoundryRunExplanation {
  kind: "FOUNDRY_RUN_EXPLANATION";
  cards: readonly FoundryExplainerCard[];
}

export interface FoundryRunEvidence {
  prompt?: string;
  tool?: WebMCPToolDefinition;
  activity: readonly FoundryActivity[];
  invocation?: FoundryInvocationResult;
}

const eventRef = (event: FoundryActivity, index: number) => `activity[${index}] · ${event.type}`;

function eventsOf(
  activity: readonly FoundryActivity[],
  types: readonly FoundryActivity["type"][],
): readonly { event: FoundryActivity; index: number }[] {
  return activity.flatMap((event, index) => types.includes(event.type) ? [{ event, index }] : []);
}

/**
 * READ: projects only evidence that occurred. Calling this neither creates nor
 * changes a tool, and it cannot render or publish an explainer artifact.
 */
export function prepareFoundryRunExplanation(evidence: FoundryRunEvidence): FoundryRunExplanation | undefined {
  if (!evidence.prompt && !evidence.tool && evidence.activity.length === 0 && !evidence.invocation) return undefined;

  const cards: FoundryExplainerCard[] = [];
  const resolve = eventsOf(evidence.activity, ["RESOLVE", "DOOR", "LEDGER", "REASON_STARTED", "REASON_EVIDENCE", "RE_ENTRY"]);
  if (evidence.prompt || resolve.length) {
    cards.push({
      id: "asked",
      title: "WHAT YOU ASKED",
      primary: evidence.prompt ?? evidence.tool?.description ?? "A Foundry request was received.",
      supporting: resolve.map(({ event }) => event.detail),
      evidenceRefs: resolve.map(({ event, index }) => eventRef(event, index)),
      truth: "LIVE",
    });
  }

  const construction = eventsOf(evidence.activity, ["GOVERNANCE", "AUTHORIZATION", "COMMIT", "BUILD"]);
  if (evidence.tool && construction.some(({ event }) => event.type === "BUILD" && event.status === "PASS")) {
    cards.push({
      id: "constructed",
      title: "WHAT XACT CONSTRUCTED",
      primary: `${evidence.tool.name}: governed ${evidence.tool.capabilityKind.toLowerCase()} tool definition.`,
      supporting: [
        evidence.tool.requiresCommit ? "Its consequences still require a fresh Commit per invocation." : "This is a read-only capability; it has no write consequence.",
        ...construction.map(({ event }) => event.detail),
      ],
      evidenceRefs: construction.map(({ event, index }) => eventRef(event, index)),
      truth: "LIVE",
    });
  }

  const host = eventsOf(evidence.activity, ["REGISTER", "OBSERVE", "VERIFY"]);
  if (host.length) {
    const blocked = host.some(({ event }) => event.status === "BLOCK");
    cards.push({
      id: "host",
      title: blocked ? "HOST EXPOSURE BLOCKED" : "WHAT THE HOST VERIFIED",
      primary: blocked ? "Browser WebMCP exposure did not verify." : "The Foundry host registered and verified the composed tool.",
      supporting: host.map(({ event }) => event.detail),
      evidenceRefs: host.map(({ event, index }) => eventRef(event, index)),
      truth: "LIVE",
    });
  }

  if (evidence.invocation) {
    const invocationRef = "runtime.invocation";
    const toolName = evidence.invocation.toolName;
    if (evidence.invocation.status === "READ_RESULT") {
      cards.push({
        id: "run",
        title: "WHAT THE TOOL DID",
        primary: `Xact ran ${toolName} against its approved read substrate.`,
        supporting: evidence.invocation.audit,
        evidenceRefs: [invocationRef, ...evidence.invocation.audit.map((_, index) => `runtime.audit[${index}]`)],
        truth: "LIVE",
      });
    } else if (evidence.invocation.status === "AUTHORIZED_EFFECT") {
      cards.push({
        id: "run",
        title: "WHAT XACT APPLIED",
        primary: `Xact applied the freshly authorized effect for ${toolName}.`,
        supporting: evidence.invocation.effectFingerprint ? [`Effect fingerprint: ${evidence.invocation.effectFingerprint}`, ...evidence.invocation.audit] : evidence.invocation.audit,
        evidenceRefs: [invocationRef, ...evidence.invocation.audit.map((_, index) => `runtime.audit[${index}]`)],
        truth: "LIVE",
      });
    } else {
      cards.push({
        id: "run",
        title: "WHAT XACT REFUSED TO DO",
        primary: `Xact did not run the consequence for ${toolName}.`,
        supporting: evidence.invocation.audit,
        evidenceRefs: [invocationRef, ...evidence.invocation.audit.map((_, index) => `runtime.audit[${index}]`)],
        truth: "LIVE",
      });
    }
  }

  const blocked = eventsOf(evidence.activity, ["BLOCKED", "REASON_FAILED"]);
  if (blocked.length && !evidence.invocation) {
    cards.push({
      id: "blocked",
      title: "WHERE XACT STOPPED",
      primary: "Xact stopped before a tool consequence occurred.",
      supporting: blocked.map(({ event }) => event.detail),
      evidenceRefs: blocked.map(({ event, index }) => eventRef(event, index)),
      truth: "LIVE",
    });
  }

  return { kind: "FOUNDRY_RUN_EXPLANATION", cards };
}
