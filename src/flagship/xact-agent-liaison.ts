import {
  XactFoundryLiaison,
  decomposeIntent,
  type FoundryBuildResult,
} from "./foundry-liaison";

/**
 * The Xact Agent — the conversational "boss" liaison (ADR 0019).
 *
 * One human interface. The judge talks to Xact; underneath, Xact coordinates
 * deterministic workers and invokes reasoning only for genuine U. This module
 * produces the conversation turns:
 *
 *   UNDERSTAND → CLARIFY? → PROPOSE → BUILD_RESULT  (or REFUSED)
 *
 * `understand` and `clarify` and `propose` are deterministic projections of the
 * decomposition; `BUILD_RESULT` is the real `buildCapability` truth stream. The
 * judge never talks to Nodes, Door, Ledger, or the O-Agent directly.
 */

export type XactTurnKind = "UNDERSTAND" | "CLARIFY" | "PROPOSE" | "BUILD_RESULT" | "REFUSED" | "PENDING_GOVERNANCE";

export interface XactTurn {
  kind: XactTurnKind;
  text: string;
  resolved?: string[];
  unresolved?: string[];
  questions?: string[];
  result?: FoundryBuildResult;
}

export interface Understanding {
  recognized: boolean;
  blocked: boolean;
  resolved: string[];
  unresolved: string[];
}

const ACTOR_HINTS = /support agent|operator|staff|admin|csr|service recovery|manager|analyst|reviewer/i;

export class XactAgentLiaison {
  constructor(private readonly foundry: XactFoundryLiaison = new XactFoundryLiaison()) {}

  /** The "understand" decomposition: what is resolved deterministically vs genuine U. */
  understand(intent: string): Understanding {
    const d = decomposeIntent(intent);
    if (!d.pattern) return { recognized: false, blocked: false, resolved: [], unresolved: [] };
    if (d.pattern.blocked) {
      return { recognized: true, blocked: true, resolved: [...d.pattern.inputs, ...d.pattern.resolves], unresolved: [] };
    }
    const resolved = [
      ...d.pattern.inputs.map((i) => `input:${i}`),
      ...d.pattern.resolves.map((r) => `resolves:${r}`),
      ...(d.descriptor?.boundaries ?? []).map((b) => b.primitive.toLowerCase()),
    ];
    return { recognized: true, blocked: false, resolved, unresolved: [...d.pattern.genuineU] };
  }

  /**
   * Ask for any missing bound needed to form a governed proposal. A MUTATION
   * capability is bounded only when its amount ceiling and its actor are both
   * known; the O-Agent's job is the remaining semantic U, not these bounds.
   */
  clarify(intent: string): string[] {
    const d = decomposeIntent(intent);
    if (!d.pattern || d.pattern.blocked) return [];
    if (d.pattern.capabilityKind !== "MUTATION") return [];

    const questions: string[] = [];
    const label = d.pattern.label.toLowerCase();

    if (d.pattern.extractAmountLimit && !/\$\d+/.test(intent)) {
      questions.push(`What is the maximum amount for "${label}"?`);
    }
    if (!ACTOR_HINTS.test(intent)) {
      questions.push(`Which actor role may invoke "${label}"?`);
    }
    return questions;
  }

  /**
   * The boss conversation. Returns the turns in order; the UI renders only
   * these turns and the underlying truth stream they carry.
   */
  async converse(intent: string, onTurn?: (turn: XactTurn) => void): Promise<XactTurn[]> {
    const turns: XactTurn[] = [];
    const push = (turn: XactTurn) => { turns.push(turn); onTurn?.(turn); };

    const understanding = this.understand(intent);
    if (!understanding.recognized) {
      push({ kind: "UNDERSTAND", text: "I don't recognize that request yet — let me reason about what you're asking for." });
      const result = await this.foundry.buildCapability(intent);
      if (result.outcome === "PENDING_GOVERNANCE") {
        const claim = result.reasoning?.claims[0] ?? "a new capability";
        push({
          kind: "PENDING_GOVERNANCE",
          text: `I understand: ${claim} It's not yet in the governed vocabulary, so I can't build it deterministically — it needs governance before I can.`,
          result,
        });
      }
      return turns;
    }

    if (understanding.blocked) {
      push({ kind: "UNDERSTAND", text: "I understand that capability — it is representable. But I won't build it." });
      const result = await this.foundry.buildCapability(intent);
      push({ kind: "REFUSED", text: "I can build that. But I won't — knowing how is not authority to act.", result });
      return turns;
    }

    const understandText = understanding.unresolved.length > 0
      ? `I can build most of that deterministically. I resolved ${understanding.resolved.length} construction requirement(s) from governed WebMCP primitives. ${understanding.unresolved.length} need(s) interpretation: ${understanding.unresolved.join(", ")}.`
      : "I can build that entirely deterministically from governed WebMCP primitives.";
    push({ kind: "UNDERSTAND", text: understandText, resolved: understanding.resolved, unresolved: understanding.unresolved });

    const questions = this.clarify(intent);
    if (questions.length > 0) {
      push({ kind: "CLARIFY", text: "A few clarifications before I build.", questions });
      return turns;
    }

    push({ kind: "PROPOSE", text: "Proposing the governed construction. Reasoning is invoked only for the unresolved requirements; Xact governs and builds the rest deterministically." });

    const result = await this.foundry.buildCapability(intent);
    if (result.outcome === "BLOCKED" && result.refusal) {
      push({ kind: "REFUSED", text: "I can build that. But I won't — knowing how is not authority to act.", result });
      return turns;
    }
    if (result.outcome === "COMPOSED_DEFINITION") {
      push({
        kind: "BUILD_RESULT",
        text: `Built ${result.tool?.name}: an inert, governed WebMCP tool definition. It has no execute handler — its consequences still require a fresh Commit.`,
        result,
      });
    }
    return turns;
  }
}
