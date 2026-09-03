import { FOUNDRY_CATALOG } from "../flagship/foundry-catalog";
import { readAbsorbedFoundryTool } from "../flagship/foundry-read-substrate";

/**
 * The governed demo-prompt pack (the `list_xact_demo_prompts` surface).
 *
 * These are the prompts ChatGPT should offer when a judge asks for something to
 * try. Every entry is declared against the CURRENT governed vocabulary; runtime
 * availability and result kind are COMPUTED from the real wiring, never
 * hardcoded, so a prompt can never claim to work when it does not.
 */

export type DemoCategory =
  | "normal"
  | "adversarial"
  | "read-only"
  | "mutation"
  | "evidence"
  | "freshness"
  | "cross-queue";

export type DemoExpectedOutcome =
  | "ALREADY_GOVERNED"
  | "COMPOSABLE"
  | "NEEDS_RESOLUTION"
  | "NOVEL_BOUNDARY"
  | "UNAUTHORIZED";

export interface DemoPrompt {
  readonly prompt: string;
  readonly category: DemoCategory;
  readonly expectedOutcome: DemoExpectedOutcome;
  /** Governed capability ids this prompt exercises (empty when none is governed). */
  readonly capabilities: readonly string[];
  /** Governed vocabulary concepts exercised (resources / fields / mutation names as evidence). */
  readonly vocabulary: readonly string[];
  /** Truthful explanation — especially for NOVEL_BOUNDARY / UNAUTHORIZED. */
  readonly note: string;
}

export interface DemoPromptResolved extends DemoPrompt {
  readonly runtimeDataAvailable: boolean;
  readonly resultKind: "executable-read" | "contract-only";
}

function hasRuntimeRead(capabilityId: string): boolean {
  const entry = FOUNDRY_CATALOG.find((candidate) => candidate.id === capabilityId);
  if (!entry || entry.kind !== "READ") return false;
  return readAbsorbedFoundryTool(capabilityId, {}) !== undefined;
}

const PROMPTS: readonly DemoPrompt[] = [
  {
    prompt: "Give my support team a way to see which customers have been waiting the longest.",
    category: "normal",
    expectedOutcome: "ALREADY_GOVERNED",
    capabilities: ["composed_read_customer_request"],
    vocabulary: ["CUSTOMER_REQUEST", "STATUS_OPEN", "WAIT_DURATION_DESC"],
    note: "Already governed, with a live on-demand read of the public-safe workspace.",
  },
  {
    prompt: "Show me the sales leaderboard ranked by revenue.",
    category: "read-only",
    expectedOutcome: "ALREADY_GOVERNED",
    capabilities: ["get_sales_leaderboard"],
    vocabulary: ["SALES_OPPORTUNITY", "REVENUE", "RANK"],
    note: "Already governed, with a live on-demand read of the fictional sales team.",
  },
  {
    prompt: "Show me the current operations snapshot across support, field, and customer health.",
    category: "read-only",
    expectedOutcome: "ALREADY_GOVERNED",
    capabilities: ["get_current_operations_snapshot"],
    vocabulary: ["OPERATIONS", "WORK_ORDER", "REQUEST"],
    note: "Already governed, with a live on-demand read.",
  },
  {
    prompt: "Which support cases have escalation evidence ready for lead review?",
    category: "evidence",
    expectedOutcome: "ALREADY_GOVERNED",
    capabilities: ["get_support_escalation_evidence"],
    vocabulary: ["REQUEST", "ESCALATE (as evidence, not intent)"],
    note: "Escalation appears as evidence/eligibility, never as mutation intent.",
  },
  {
    prompt: "Which customers are eligible for a service credit under current policy?",
    category: "evidence",
    expectedOutcome: "ALREADY_GOVERNED",
    capabilities: ["get_service_credit_opportunities"],
    vocabulary: ["CUSTOMER", "ISSUE_CREDIT (as eligibility, not intent)"],
    note: "Credit appears as policy eligibility, never as an authorized consequence.",
  },
  {
    prompt: "Which work orders have unavailable owners and might need reassignment?",
    category: "adversarial",
    expectedOutcome: "ALREADY_GOVERNED",
    capabilities: ["get_work_orders_owner_unavailable"],
    vocabulary: ["WORK_ORDER", "OWNER", "REASSIGN (as possible next action, not intent)"],
    note: "Reassignment is a possible next action surfaced as a read, not a performed mutation.",
  },
  {
    prompt: "Let a support agent issue a service credit up to $25.",
    category: "mutation",
    expectedOutcome: "ALREADY_GOVERNED",
    capabilities: ["issue_service_credit"],
    vocabulary: ["CUSTOMER", "ISSUE_CREDIT", "ACTOR_BINDING", "COMMIT_BOUNDARY"],
    note: "Commit-gated mutation: construction is authorized, but every future use requires a fresh Commit.",
  },
  {
    prompt: "Build a tool that lets any agent delete any customer account.",
    category: "adversarial",
    expectedOutcome: "UNAUTHORIZED",
    capabilities: [],
    vocabulary: ["DELETE_ACCOUNT (forbidden)"],
    note: "Destructive consequence with no governed approval path; Xact refuses to make it real.",
  },
  {
    prompt: "Look up the status of customer order ORD-100.",
    category: "cross-queue",
    expectedOutcome: "NOVEL_BOUNDARY",
    capabilities: [],
    vocabulary: [],
    note: "Customer order status is not a governed domain and must never map to the field work-order queue.",
  },
  {
    prompt: "Which records have stale evidence that needs re-validation?",
    category: "freshness",
    expectedOutcome: "NOVEL_BOUNDARY",
    capabilities: [],
    vocabulary: ["FRESHNESS_STATUS", "EVIDENCE_TIMESTAMP"],
    note: "Freshness and evidence-timestamp are not yet governed substrate atoms; Xact refuses to invent them.",
  },
  {
    prompt: "Show me the employee organization directory.",
    category: "read-only",
    expectedOutcome: "ALREADY_GOVERNED",
    capabilities: ["get_employee_directory"],
    vocabulary: ["EMPLOYEE"],
    note: "Already governed, with a live on-demand read.",
  },
  {
    prompt: "Look up a customer by email address.",
    category: "read-only",
    expectedOutcome: "ALREADY_GOVERNED",
    capabilities: ["find_customer_by_email"],
    vocabulary: ["CUSTOMER", "EMAIL"],
    note: "Governed contract exists; no runtime read handler is wired yet.",
  },
  {
    prompt: "Find all employees in the Engineering division.",
    category: "read-only",
    expectedOutcome: "ALREADY_GOVERNED",
    capabilities: ["get_division_roster"],
    vocabulary: ["EMPLOYEE", "DIVISION"],
    note: "Already governed, with a live on-demand read.",
  },
  {
    prompt: "Show sales representatives with their current performance statistics and leaderboard ranking.",
    category: "read-only",
    expectedOutcome: "NOVEL_BOUNDARY",
    capabilities: [],
    vocabulary: ["SALES_REPRESENTATIVE", "REVENUE", "DEALS_CLOSED", "QUOTA_ATTAINMENT", "RANK"],
    note: "A people directory is not a sales leaderboard. Xact must report the missing governed sales metrics instead of substituting an employee lookup.",
  },
  {
    prompt: "Show me the escalated support cases that need lead review.",
    category: "evidence",
    expectedOutcome: "ALREADY_GOVERNED",
    capabilities: ["get_escalated_support_case_review"],
    vocabulary: ["REQUEST", "ESCALATE (as review context, not intent)"],
    note: "Escalation is review context; the read never performs an escalation.",
  },
];

/** Resolve the demo prompts with their live runtime availability computed from the real wiring. */
export function listXactDemoPrompts(): DemoPromptResolved[] {
  return PROMPTS.map((prompt) => {
    const runtimeDataAvailable = prompt.capabilities.some((capabilityId) => hasRuntimeRead(capabilityId));
    return {
      ...prompt,
      runtimeDataAvailable,
      resultKind: runtimeDataAvailable ? "executable-read" : "contract-only",
    };
  });
}
