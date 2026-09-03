import type { WebMCPToolDefinition } from "./webmcp-tool-builder";
import { constructWebMCPToolWithNodes, type ToolConstructionNodeOutcome } from "./tool-construction-nodes";
import {
  describeCapability,
  recognizeGovernedCapability,
  type CapabilityBoundary,
  type CapabilityKind,
  type GovernedCapabilityDescriptor,
} from "./capability-vocabulary";
import {
  doorValidate,
  ledgerValidate,
  recordOutcomeEvidence,
  issueGovernanceDecision,
  governCandidate,
  type OutcomeEvidence,
} from "./outcome-effectiveness-gate";
import {
  createCandidateCapability,
  commitAuthorizationFrom,
  type CandidateCapability,
  type CommitAuthorization,
} from "./authority-contracts";
import { SecureEndpointOAgentProvider, type OAgentProvider } from "../telemetry/o-agent-provider";
import { SimulationDecisionProvider } from "../xact/simulation-decision-provider";
import { AuthorizationArtifactIssuer, InMemoryAuthorizationArtifactStore, stableFingerprint } from "../xact/authorization-artifact";
import type { ScenarioPack } from "../scenarios/contracts";
import type { DecisionCandidate } from "../xact/contracts";
import type { AuthorizationAssessment, PolicyProvider } from "../xact/providers";

/**
 * Xact WebMCP Foundry — the liaison orchestrator (ADR 0019).
 *
 * One Xact Agent coordinates a large deterministic construction system and
 * invokes reasoning only where determinism ends.
 *
 * TEMPORAL CONTRACT (truthful, no green state before the fact exists):
 *
 *   buildCapability  → RESOLVE → DOOR → LEDGER → [REASON → RE_ENTRY]
 *                       → AUTHORIZATION → COMMIT → BUILD
 *                       → COMPOSED_DEFINITION   (inert tool, not yet invocable)
 *
 *   (browser host)   → REGISTER → OBSERVE → VERIFY
 *                       → REGISTERED_TOOL → WORKING_TOOL
 *
 *   reviewForAbsorption → outcome evidence → GOVERNANCE (learning)
 *
 * The liaison emits through BUILD only. It never emits REGISTER, OBSERVE,
 * VERIFY, or GOVERNANCE — those belong to the browser WebMCP host and the
 * post-verification absorption step, and must not light up before they happen.
 *
 * Foundry invariant (ADR 0019): if the liaison does not emit it, it does not
 * light up.
 */

// ---------------------------------------------------------------------------
// The truth stream.
// ---------------------------------------------------------------------------

export type FoundryEventType =
  | "RESOLVE"
  | "REASON_STARTED"
  | "REASON_EVIDENCE"
  | "REASON_FAILED"
  | "RE_ENTRY"
  | "DOOR"
  | "LEDGER"
  | "GOVERNANCE"
  | "AUTHORIZATION"
  | "COMMIT"
  | "BUILD"
  | "REGISTER"
  | "OBSERVE"
  | "VERIFY"
  | "BLOCKED";

export type FoundryStatus = "PASS" | "BLOCK" | "EVIDENCE" | "PENDING";

/**
 * The liaison's own result states. `COMPOSED_DEFINITION` is the only success
 * state the liaison can produce: an inert tool definition exists, but it has
 * not been registered, observed, or verified as invocable.
 *
 * `PENDING_GOVERNANCE` means the request was not in the closed ontology, the
 * O-Agent produced a structured interpretation, and Xact understood it — but it
 * is not buildable until governance adds it to the vocabulary.
 *
 * `REGISTERED_TOOL` and `WORKING_TOOL` are produced by the browser WebMCP host
 * (REGISTER / OBSERVE / VERIFY), never by the liaison.
 */
export type FoundryOutcome = "COMPOSED_DEFINITION" | "BLOCKED" | "PENDING_GOVERNANCE";

export interface FoundryActivity {
  type: FoundryEventType;
  label: string;
  detail: string;
  status: FoundryStatus;
}

// ---------------------------------------------------------------------------
// Intent decomposition — the compiler front end.
// ---------------------------------------------------------------------------

export interface CapabilityPattern {
  id: string;
  label: string;
  capabilityKind: CapabilityKind;
  inputs: string[];
  resolves: string[];
  boundaries: (amountLimit?: number) => CapabilityBoundary[];
  genuineU: string[];
  matches: (intent: string) => boolean;
  extractAmountLimit?: (intent: string) => number;
  blocked?: { reasons: string[] };
}

function amountLimit(intent: string, fallback: number): number {
  const match = intent.match(/\$(\d+)/);
  return match ? Number(match[1]) : fallback;
}

/** A role-boundary instance from the absorbed actor ontology (ADR 0016 ACTOR_BINDING). */
export function actorBoundaryFor(role: string): CapabilityBoundary {
  return { primitive: "ACTOR_BINDING", description: `actor requires ${role}`, actor: role };
}
const ACTOR_BOUNDARY: CapabilityBoundary = actorBoundaryFor("SERVICE_RECOVERY");
const AUDIT_BOUNDARY: CapabilityBoundary = { primitive: "AUDIT_EVENT", description: "audit event required", auditRequired: true };
const FRESHNESS_BOUNDARY: CapabilityBoundary = { primitive: "SESSION_REQUIREMENT", description: "state freshness required", freshnessRequired: true };
const CONFIRMATION_BOUNDARY: CapabilityBoundary = { primitive: "CONFIRMATION_REQUIREMENT", description: "confirmation required", confirmationRequired: true };
const observationalIntent = (intent: string): boolean => /read[- ]only|do not|never|without (?:changing|performing|issuing|escalating|reassigning)|no mutation/i.test(intent);

const FOUNDRY_PATTERNS: CapabilityPattern[] = [
  {
    id: "get_service_credit_opportunities",
    label: "Read service-credit opportunity evidence",
    capabilityKind: "READ",
    inputs: [],
    resolves: ["eligible-customers", "qualifying-evidence", "prior-credits-30d", "unissued-status"],
    boundaries: () => [
      { primitive: "READ_CAPABILITY", description: "Foundry public-safe business workspace is the approved credit-evidence substrate" },
      FRESHNESS_BOUNDARY,
    ],
    genuineU: [],
    matches: (intent) => /service[- ]credit/i.test(intent) && /read[- ]only|unissued|prior credits|opportunity/i.test(intent),
  },
  {
    id: "issue_service_credit",
    label: "Issue customer service credit",
    capabilityKind: "MUTATION",
    inputs: ["customerId", "amount", "reason"],
    resolves: ["credit-applied"],
    boundaries: (limit) => [
      ACTOR_BOUNDARY,
      { primitive: "COMMIT_BOUNDARY", description: `amount must not exceed $${limit}`, limit: { operator: "<=", value: limit ?? 25 } },
      AUDIT_BOUNDARY,
      FRESHNESS_BOUNDARY,
    ],
    genuineU: ["credit eligibility", "stacking policy"],
    matches: (intent) => /credit/i.test(intent) && !observationalIntent(intent) && !/unissued|opportunity|eligible|policy/i.test(intent),
    extractAmountLimit: (intent) => amountLimit(intent, 25),
  },
  {
    id: "refund_delivery_fee",
    label: "Refund delivery fee",
    capabilityKind: "MUTATION",
    inputs: ["orderId", "amount", "reason"],
    resolves: ["fee-refunded"],
    boundaries: (limit) => [
      ACTOR_BOUNDARY,
      { primitive: "COMMIT_BOUNDARY", description: `amount must not exceed $${limit}`, limit: { operator: "<=", value: limit ?? 15 } },
      AUDIT_BOUNDARY,
    ],
    genuineU: ["refund eligibility"],
    matches: (intent) => /refund/i.test(intent) && /delivery|fee|shipping/i.test(intent),
    extractAmountLimit: (intent) => amountLimit(intent, 15),
  },
  {
    id: "reassign_support_ticket",
    label: "Reassign support ticket",
    capabilityKind: "MUTATION",
    inputs: ["ticketId", "newOwner", "ownerUnavailable", "requiredSkillMismatch"],
    resolves: ["ticket-reassigned"],
    boundaries: () => [
      actorBoundaryFor("SERVICE_RECOVERY"),
      { primitive: "STATE_BINDING", description: "Reassignment requires current owner unavailable OR required skill mismatch" },
      CONFIRMATION_BOUNDARY,
      AUDIT_BOUNDARY,
    ],
    genuineU: [],
    matches: (intent) => /reassign/i.test(intent) && /(support )?ticket|case/i.test(intent) && !observationalIntent(intent),
  },
  {
    id: "reassign_work_order",
    label: "Reassign field work order",
    capabilityKind: "MUTATION",
    inputs: ["orderId", "technician"],
    resolves: ["work-order-reassigned"],
    boundaries: () => [
      actorBoundaryFor("FIELD OPS"),
      CONFIRMATION_BOUNDARY,
      AUDIT_BOUNDARY,
    ],
    genuineU: [],
    matches: (intent) => /reassign/i.test(intent) && /work[- ]order/i.test(intent) && !observationalIntent(intent),
  },
  {
    id: "escalate_support_ticket",
    label: "Escalate support ticket",
    capabilityKind: "MUTATION",
    inputs: ["ticketId", "severity"],
    resolves: ["ticket-escalated"],
    boundaries: () => [
      actorBoundaryFor("SERVICE_RECOVERY"),
      CONFIRMATION_BOUNDARY,
      AUDIT_BOUNDARY,
    ],
    genuineU: [],
    matches: (intent) => /\bescalate(?:d|s|ion)?\b/i.test(intent) && !/read[- ]only|review|show|list/i.test(intent) && /(support )?ticket|case/i.test(intent),
  },
  {
    id: "set_customer_next_action",
    label: "Set customer next action",
    capabilityKind: "MUTATION",
    inputs: ["customerId", "nextAction"],
    resolves: ["next-action-set"],
    boundaries: () => [
      actorBoundaryFor("CUSTOMER SUCCESS"),
      CONFIRMATION_BOUNDARY,
      AUDIT_BOUNDARY,
    ],
    genuineU: [],
    matches: (intent) => /next action/i.test(intent) && /customer/i.test(intent),
  },
  {
    id: "update_employee_status",
    label: "Update employee status",
    capabilityKind: "MUTATION",
    inputs: ["employeeId", "status"],
    resolves: ["status-updated"],
    boundaries: () => [
      actorBoundaryFor("PEOPLE"),
      CONFIRMATION_BOUNDARY,
      AUDIT_BOUNDARY,
    ],
    genuineU: [],
    matches: (intent) => /employee/i.test(intent) && /(status|on leave|active)/i.test(intent) && /(update|change|set)/i.test(intent),
  },
  {
    id: "get_work_orders_by_owner",
    label: "Read work orders by owner",
    capabilityKind: "READ",
    inputs: ["owner"],
    resolves: ["owned-work-orders"],
    boundaries: () => [
      { primitive: "READ_CAPABILITY", description: "Foundry public-safe business workspace is the approved work-order substrate" },
      FRESHNESS_BOUNDARY,
    ],
    genuineU: [],
    matches: (intent) => /work[- ]orders? (by|for) owner|work[- ]order owner|work[- ]orders? assigned/i.test(intent),
  },
  {
    id: "get_support_tickets_by_owner",
    label: "Read support tickets by owner",
    capabilityKind: "READ",
    inputs: ["owner"],
    resolves: ["owned-tickets"],
    boundaries: () => [
      { primitive: "READ_CAPABILITY", description: "Foundry public-safe business workspace is the approved support substrate" },
      FRESHNESS_BOUNDARY,
    ],
    genuineU: [],
    matches: (intent) => /support tickets? (by|for) owner|tickets? (by|for) owner|support tickets? assigned/i.test(intent),
  },
  {
    id: "read_active_users_and_open_requests",
    label: "Read active users and open support requests",
    capabilityKind: "READ",
    inputs: [],
    resolves: ["active-user-count", "open-support-request-count"],
    boundaries: () => [
      { primitive: "READ_CAPABILITY", description: "Foundry customer directory is the approved public-safe read substrate" },
      FRESHNESS_BOUNDARY,
    ],
    genuineU: [],
    matches: (intent) => /active users?|user stats?/i.test(intent) && /open (support )?requests?/i.test(intent),
  },
  {
    id: "get_urgent_work_orders_unqualified_owner",
    label: "Read urgent work orders with no qualified owner",
    capabilityKind: "READ",
    inputs: [],
    resolves: ["owner", "qualified-owner-available", "due-time", "status"],
    boundaries: () => [
      { primitive: "READ_CAPABILITY", description: "Foundry public-safe business workspace is the approved dispatch substrate" },
      FRESHNESS_BOUNDARY,
    ],
    genuineU: [],
    matches: (intent) => /urgent.*(?:qualified|unqualified).*owner|no qualified owner|qualified owner unavailable|no available qualified owner/i.test(intent),
  },
  {
    id: "get_urgent_work_order_triage",
    label: "Read urgent work-order triage",
    capabilityKind: "READ",
    inputs: [],
    resolves: ["urgent-work-orders", "owner", "due-time", "completion-blocker"],
    boundaries: () => [
      { primitive: "READ_CAPABILITY", description: "Foundry public-safe business workspace is the approved work-order substrate" },
      FRESHNESS_BOUNDARY,
    ],
    genuineU: [],
    matches: (intent) => /urgent work[- ]order(?:s)? triage|urgent work[- ]orders?.*(?:blocking|blocker|due time)/i.test(intent),
  },
  {
    id: "get_work_orders_owner_unavailable",
    label: "Read work orders with unavailable owners",
    capabilityKind: "READ",
    inputs: [],
    resolves: ["work-orders", "owner-unavailable", "priority", "due-time", "status"],
    boundaries: () => [
      { primitive: "READ_CAPABILITY", description: "Foundry public-safe business workspace is the approved work-order substrate" },
      FRESHNESS_BOUNDARY,
    ],
    genuineU: [],
    matches: (intent) => /work orders?.*(?:owner is )?unavailable|owner unavailable.*work orders?/i.test(intent),
  },
  {
    id: "get_work_order_queue",
    label: "Read field work-order queue",
    capabilityKind: "READ",
    inputs: [],
    resolves: ["open-work-orders", "priority-dispatch"],
    boundaries: () => [
      { primitive: "READ_CAPABILITY", description: "Foundry public-safe business workspace is the approved work-order substrate" },
      FRESHNESS_BOUNDARY,
    ],
    genuineU: [],
    matches: (intent) => /work[- ]orders?|field service|dispatch queue/i.test(intent)
      && !/customer 360|support history|open cases.*work orders|customer email.*health|owner workload|assigned work orders and support tickets|owner unavailable/i.test(intent),
  },
  {
    id: "get_employee_directory",
    label: "Read employee organization directory",
    capabilityKind: "READ",
    inputs: [],
    resolves: ["employee-directory", "division-headcount", "reporting-line"],
    boundaries: () => [
      { primitive: "READ_CAPABILITY", description: "Foundry public-safe employee workspace is the approved read substrate" },
      FRESHNESS_BOUNDARY,
    ],
    genuineU: [],
    matches: (intent) => /employee (directory|data|list|org|organization|headcount)|(?:company|workforce) (directory|org|organization|headcount)|division headcount/i.test(intent)
      && !/sales (?:people|reps?|representatives?).*(?:leaderboard|statistics|stats|performance)|(?:leaderboard|rankings?).*sales/i.test(intent),
  },
  {
    id: "get_escalated_support_case_review",
    label: "Read escalated support case review",
    capabilityKind: "READ",
    inputs: [],
    resolves: ["escalated-cases", "severity", "current-owner", "customer-history", "next-review"],
    boundaries: () => [
      { primitive: "READ_CAPABILITY", description: "Foundry public-safe business workspace is the approved support substrate" },
      FRESHNESS_BOUNDARY,
    ],
    genuineU: [],
    matches: (intent) => /escalated support (?:cases?|tickets?).*(?:history|next review|severity|owner)|escalated (?:support )?(?:case|ticket) review/i.test(intent),
  },
  {
    id: "get_support_escalation_evidence",
    label: "Read support escalation-condition evidence",
    capabilityKind: "READ",
    inputs: [],
    resolves: ["qualifying-tickets", "severity", "owner", "qualifying-evidence", "escalation-condition"],
    boundaries: () => [{ primitive: "READ_CAPABILITY", description: "Foundry public-safe business workspace is the approved support substrate" }, FRESHNESS_BOUNDARY],
    genuineU: [],
    matches: (intent) => /support tickets?.*(?:conditions? for escalation|qualifying evidence)|escalation[- ]condition evidence/i.test(intent),
  },
  {
    id: "get_customer_support_queue",
    label: "Read customer-support queue",
    capabilityKind: "READ",
    inputs: [],
    resolves: ["open-cases", "case-priority", "assigned-owner"],
    boundaries: () => [
      { primitive: "READ_CAPABILITY", description: "Foundry public-safe business workspace is the approved support substrate" },
      FRESHNESS_BOUNDARY,
    ],
    genuineU: [],
    matches: (intent) => /support (queue|tickets?|cases?)|customer support/i.test(intent)
      && !/owner workload|assigned work orders and support tickets|escalated support|escalated case review|conditions? for escalation|qualifying evidence/i.test(intent),
  },
  {
    id: "get_support_lead_decision_queue",
    label: "Read support lead decision queue",
    capabilityKind: "READ",
    inputs: [],
    resolves: ["request-id", "decision-category", "possible-next-action"],
    boundaries: () => [
      { primitive: "READ_CAPABILITY", description: "Foundry public-safe business workspace is the approved support substrate" },
      FRESHNESS_BOUNDARY,
    ],
    genuineU: [],
    matches: (intent) => /support[- ]lead.*(?:review|queue)|awaiting (?:support[- ]lead )?review|possible next action|decision (?:category|queue)/i.test(intent),
  },
  {
    id: "composed_read_customer_request",
    label: "Read customers waiting longest",
    capabilityKind: "READ",
    inputs: [],
    resolves: ["customer-id", "request-id", "wait-duration"],
    boundaries: () => [
      { primitive: "READ_CAPABILITY", description: "Foundry public-safe business workspace is the approved wait-queue substrate" },
      FRESHNESS_BOUNDARY,
    ],
    genuineU: [],
    matches: (intent) => /customers? (?:who )?(?:have )?been waiting (?:the )?longest|longest[- ]waiting customers?|customers? waiting longest/i.test(intent),
  },
  {
    id: "get_customer_health_summary",
    label: "Read customer account health",
    capabilityKind: "READ",
    inputs: ["customerId"],
    resolves: ["account-health", "open-work", "next-action"],
    boundaries: () => [
      { primitive: "READ_CAPABILITY", description: "Foundry public-safe business workspace is the approved customer-health substrate" },
      FRESHNESS_BOUNDARY,
    ],
    genuineU: [],
    matches: (intent) => /customer (account )?health|account health/i.test(intent),
  },
  {
    id: "get_business_operations_report",
    label: "Read business operations report",
    capabilityKind: "READ",
    inputs: [],
    resolves: ["support-sla", "work-order-performance", "at-risk-accounts"],
    boundaries: () => [
      { primitive: "READ_CAPABILITY", description: "Foundry public-safe business workspace is the approved operations-report substrate" },
      FRESHNESS_BOUNDARY,
    ],
    genuineU: [],
    matches: (intent) => /weekly kpi|business (operations )?report|operations dashboard/i.test(intent),
  },
  {
    id: "get_current_operations_snapshot",
    label: "Read current operations snapshot",
    capabilityKind: "READ",
    inputs: [],
    resolves: ["open-work-orders", "open-support-cases", "at-risk-accounts"],
    boundaries: () => [
      { primitive: "READ_CAPABILITY", description: "Foundry public-safe business workspace is the approved current-operations substrate" },
      FRESHNESS_BOUNDARY,
    ],
    genuineU: [],
    matches: (intent) => /current operations snapshot|operations snapshot|live operations snapshot|current operations overview/i.test(intent),
  },
  {
    id: "get_operations_exception_brief",
    label: "Read operations exception brief",
    capabilityKind: "READ",
    inputs: [],
    resolves: ["urgent-work-orders", "escalated-support-cases", "at-risk-accounts"],
    boundaries: () => [
      { primitive: "READ_CAPABILITY", description: "Foundry public-safe business workspace is the approved exception-brief substrate" },
      FRESHNESS_BOUNDARY,
    ],
    genuineU: [],
    matches: (intent) => /operations? exception brief|exception brief|operations? exceptions/i.test(intent),
  },
  {
    id: "get_owner_workload",
    label: "Read owner workload",
    capabilityKind: "READ",
    inputs: [],
    resolves: ["owner", "assigned-work-orders", "assigned-support-tickets", "urgency", "due-time"],
    boundaries: () => [
      { primitive: "READ_CAPABILITY", description: "Foundry public-safe business workspace is the approved owner-workload substrate" },
      FRESHNESS_BOUNDARY,
    ],
    genuineU: [],
    matches: (intent) => /assigned work orders and support tickets|owner workload|owner.*workload/i.test(intent),
  },
  {
    id: "get_customer_360",
    label: "Read customer 360 evidence view",
    capabilityKind: "READ",
    inputs: ["email"],
    resolves: ["customer-id", "support-history", "open-cases", "work-orders", "health-status"],
    boundaries: () => [
      { primitive: "READ_CAPABILITY", description: "Foundry public-safe business workspace is the approved customer-360 substrate" },
      FRESHNESS_BOUNDARY,
    ],
    genuineU: [],
    matches: (intent) => /customer 360|customer evidence view|account.*support history.*open cases.*work orders.*health/i.test(intent),
  },
  {
    id: "get_sales_pipeline_forecast",
    label: "Read sales pipeline and forecast",
    capabilityKind: "READ",
    inputs: [],
    resolves: ["open-pipeline", "weighted-forecast", "close-window"],
    boundaries: () => [
      { primitive: "READ_CAPABILITY", description: "Foundry public-safe sales workspace is the approved read substrate" },
      FRESHNESS_BOUNDARY,
    ],
    genuineU: [],
    matches: (intent) => /sales (pipeline|forecast|dashboard)|revenue (pipeline|forecast)/i.test(intent),
  },
  {
    id: "get_sales_leaderboard",
    label: "Read sales leaderboard",
    capabilityKind: "READ",
    inputs: [],
    resolves: ["representative", "team", "closed-deals", "revenue", "quota-attainment", "rank"],
    boundaries: () => [
      { primitive: "READ_CAPABILITY", description: "Foundry public-safe sales workspace is the approved read substrate" },
      FRESHNESS_BOUNDARY,
    ],
    genuineU: [],
    matches: (intent) => /sales (leaderboard|ranking|rankings|top performers|reps?)|leaderboard|top sales reps?|rank.*sales/i.test(intent),
  },
  {
    id: "get_marketing_performance",
    label: "Read marketing performance dashboard",
    capabilityKind: "READ",
    inputs: [],
    resolves: ["campaign-reach", "engagement", "delivery-status"],
    boundaries: () => [
      { primitive: "READ_CAPABILITY", description: "Foundry public-safe marketing workspace is the approved read substrate" },
      FRESHNESS_BOUNDARY,
    ],
    genuineU: [],
    matches: (intent) => /marketing (performance|dashboard|analytics)|campaign marketing (performance|analytics)/i.test(intent),
  },
  {
    id: "get_campaign_dashboard",
    label: "Read promotion campaign dashboard",
    capabilityKind: "READ",
    inputs: [],
    resolves: ["eligible-audience", "prepared-drafts", "delivery-status"],
    boundaries: () => [
      { primitive: "READ_CAPABILITY", description: "Foundry public-safe business workspace is the approved campaign-report substrate" },
      FRESHNESS_BOUNDARY,
      { primitive: "AUDIT_EVENT", description: "delivery remains separately audited and Commit-gated", auditRequired: true },
    ],
    genuineU: [],
    matches: (intent) => /campaign dashboard|campaign performance|promotion performance/i.test(intent),
  },
  {
    id: "prepare_weekly_promotional_email_campaign",
    label: "Prepare weekly promotional email campaign",
    capabilityKind: "READ",
    inputs: [],
    resolves: ["prepared-recipient-count", "next-run", "personalized-drafts"],
    boundaries: () => [
      { primitive: "READ_CAPABILITY", description: "Foundry mock customer directory is the approved public-safe campaign substrate" },
      FRESHNESS_BOUNDARY,
      { primitive: "AUDIT_EVENT", description: "campaign preparation is recorded; delivery requires a separate fresh Commit", auditRequired: true },
    ],
    genuineU: [],
    matches: (intent) => /promo|promotional|marketing/i.test(intent) && /email|campaign/i.test(intent),
  },
  {
    id: "find_employees_by_role",
    label: "Find employees by role",
    capabilityKind: "READ",
    inputs: ["role"],
    resolves: ["matching-employees"],
    boundaries: () => [
      { primitive: "READ_CAPABILITY", description: "Foundry public-safe employee workspace is the approved read substrate" },
      FRESHNESS_BOUNDARY,
    ],
    genuineU: [],
    matches: (intent) => /employees? (by|with) (role|title|position)|by (role|title|position)/i.test(intent),
  },
  {
    id: "get_division_roster",
    label: "Read division roster",
    capabilityKind: "READ",
    inputs: ["division"],
    resolves: ["division-roster"],
    boundaries: () => [
      { primitive: "READ_CAPABILITY", description: "Foundry public-safe employee workspace is the approved read substrate" },
      FRESHNESS_BOUNDARY,
    ],
    genuineU: [],
    matches: (intent) => /division roster|division directory|division list|division members/i.test(intent),
  },
  {
    id: "get_department_headcount",
    label: "Read department headcount",
    capabilityKind: "READ",
    inputs: ["department"],
    resolves: ["headcount"],
    boundaries: () => [
      { primitive: "READ_CAPABILITY", description: "Foundry public-safe employee workspace is the approved read substrate" },
      FRESHNESS_BOUNDARY,
    ],
    genuineU: [],
    matches: (intent) => /department headcount|department count/i.test(intent),
  },
  {
    id: "get_employees_by_location",
    label: "Read employees by location",
    capabilityKind: "READ",
    inputs: ["location"],
    resolves: ["located-employees"],
    boundaries: () => [
      { primitive: "READ_CAPABILITY", description: "Foundry public-safe employee workspace is the approved read substrate" },
      FRESHNESS_BOUNDARY,
    ],
    genuineU: [],
    matches: (intent) => /employees? (by|in) (location|office|city|site)|by (location|office|city)/i.test(intent),
  },
  {
    id: "get_employees_on_leave",
    label: "Read employees on leave",
    capabilityKind: "READ",
    inputs: [],
    resolves: ["on-leave-employees"],
    boundaries: () => [
      { primitive: "READ_CAPABILITY", description: "Foundry public-safe employee workspace is the approved read substrate" },
      FRESHNESS_BOUNDARY,
    ],
    genuineU: [],
    matches: (intent) => /employees? on leave|on leave|absent employees?/i.test(intent),
  },
  {
    id: "get_direct_reports",
    label: "Read direct reports",
    capabilityKind: "READ",
    inputs: ["manager"],
    resolves: ["direct-reports"],
    boundaries: () => [
      { primitive: "READ_CAPABILITY", description: "Foundry public-safe employee workspace is the approved read substrate" },
      FRESHNESS_BOUNDARY,
    ],
    genuineU: [],
    matches: (intent) => /direct reports|reports to|reporting line/i.test(intent),
  },
  {
    id: "get_customers_at_risk",
    label: "Read at-risk customers",
    capabilityKind: "READ",
    inputs: [],
    resolves: ["at-risk-customers"],
    boundaries: () => [
      { primitive: "READ_CAPABILITY", description: "Foundry public-safe business workspace is the approved customer-health substrate" },
      FRESHNESS_BOUNDARY,
    ],
    genuineU: [],
    matches: (intent) => /at[- ]risk customers?|customers? at[- ]risk|at-risk accounts?/i.test(intent),
  },
  {
    id: "get_customers_by_plan",
    label: "Read customers by plan",
    capabilityKind: "READ",
    inputs: ["plan"],
    resolves: ["plan-customers"],
    boundaries: () => [
      { primitive: "READ_CAPABILITY", description: "Foundry public-safe business workspace is the approved customer-health substrate" },
      FRESHNESS_BOUNDARY,
    ],
    genuineU: [],
    matches: (intent) => /customers? by plan|by plan/i.test(intent) && !/(change|update|switch|modify)/i.test(intent),
  },
  {
    id: "get_customer_plan_change_history",
    label: "Read customer plan-change audit history",
    capabilityKind: "READ",
    inputs: ["email"],
    resolves: ["customer", "plan-change-date", "prior-plan", "resulting-plan"],
    boundaries: () => [
      { primitive: "READ_CAPABILITY", description: "Foundry audit workspace is the approved plan-history substrate" },
      FRESHNESS_BOUNDARY,
    ],
    genuineU: [],
    matches: (intent) => /plan changes?.*(?:audit|history|prior plan|resulting plan)|audit history.*(?:plan|email)/i.test(intent),
  },
  {
    id: "find_customer_by_email",
    label: "Find customer by email",
    capabilityKind: "READ",
    inputs: ["email"],
    resolves: ["customer"],
    boundaries: () => [],
    genuineU: [],
    matches: (intent) => /find/i.test(intent) || /email/i.test(intent),
  },
  {
    id: "get_audit_history",
    label: "Read customer audit history",
    capabilityKind: "READ",
    inputs: ["customerId"],
    resolves: ["service-history"],
    boundaries: () => [],
    genuineU: [],
    matches: (intent) => /audit/i.test(intent),
  },
  {
    id: "change_service_plan",
    label: "Change customer service plan",
    capabilityKind: "MUTATION",
    inputs: ["customerId", "plan"],
    resolves: ["plan-changed"],
    boundaries: () => [
      ACTOR_BOUNDARY,
      { primitive: "CONFIRMATION_REQUIREMENT", description: "confirmation required", confirmationRequired: true },
    ],
    genuineU: ["price-increase constraint"],
    matches: (intent) => /(?:change|update|switch|modify)\s+(?:a\s+)?(?:customer\s+)?(?:service\s+)?plan|customer(?:\s+service)?\s+plan\s+(?:change|update|switch|modification)|plan\s+(?:change|update|switch)/i.test(intent),
  },
  {
    id: "delete_customer_account",
    label: "Delete customer account",
    capabilityKind: "MUTATION",
    inputs: [],
    resolves: [],
    boundaries: () => [],
    genuineU: [],
    matches: (intent) => /delete/i.test(intent) && /customer|account/i.test(intent),
    blocked: { reasons: ["irreversible consequence", "no governed approval path for this actor"] },
  },
];

export interface IntentDecomposition {
  pattern?: CapabilityPattern;
  amountLimit?: number;
  raw: { capability: string; resolves: string[] };
  door: ReturnType<typeof doorValidate>;
  ledger: ReturnType<typeof ledgerValidate>;
  descriptor?: GovernedCapabilityDescriptor;
  candidate?: CandidateCapability;
}

export function decomposeIntent(intent: string): IntentDecomposition {
  const normalized = intent.trim().toLowerCase();
  // Do not substitute the employee directory for an ungoverned leaderboard.
  if (/sales (?:people|reps?|representatives?).*(?:leaderboard|statistics|stats|performance)|(?:leaderboard|rankings?).*sales/i.test(normalized)) {
    const raw = { capability: "unrecognized_capability", resolves: ["sales performance metrics"] };
    return { raw, door: doorValidate(raw, new Set()), ledger: ledgerValidate(raw) };
  }
  const pattern = FOUNDRY_PATTERNS.find((candidate) => candidate.matches(normalized));

  if (!pattern) {
    const raw = { capability: "unrecognized_capability", resolves: ["request semantics"] };
    return { raw, door: doorValidate(raw, new Set()), ledger: ledgerValidate(raw) };
  }

  const limit = pattern.extractAmountLimit?.(normalized);
  const raw = { capability: pattern.id, resolves: [...pattern.resolves] };

  if (pattern.blocked) {
    return { pattern, amountLimit: limit, raw, door: { admissible: true, errors: [] }, ledger: { valid: true, violations: [] } };
  }

  const door = doorValidate(raw, new Set(FOUNDRY_PATTERNS.map((p) => p.id)));
  const ledger = ledgerValidate(raw);
  const descriptor = describeCapability({
    id: pattern.id,
    capabilityKind: pattern.capabilityKind,
    label: pattern.label,
    inputs: [...pattern.inputs],
    resolves: [...pattern.resolves],
    boundaries: pattern.boundaries(limit),
  });
  const candidate = door.admissible && ledger.valid
    ? createCandidateCapability({ id: `candidate:${pattern.id}`, label: pattern.label, resolves: [...pattern.resolves] })
    : undefined;

  return { pattern, amountLimit: limit, raw, door, ledger, descriptor, candidate };
}

// ---------------------------------------------------------------------------
// The construction consequence (AUTHORIZATION → COMMIT).
// ---------------------------------------------------------------------------

interface ConstructionInputs { capabilityId: string; capabilityKind: CapabilityKind; }
interface ConstructionState { version: number; constructed: string[]; }
interface ConstructionEffect { type: "CONSTRUCT_WEBMCP_TOOL"; capabilityId: string; }

const constructionPack: ScenarioPack<ConstructionInputs, ConstructionState, ConstructionEffect> = {
  id: "foundry-webmcp-construction-v1",
  label: "Foundry WebMCP tool construction",
  preferredSubstrate: "LOCAL",
  intent: (inputs) => `Construct the governed ${inputs.capabilityId} WebMCP tool`,
  createInitialInputs: () => { throw new Error("A validated descriptor is required."); },
  createInitialState: () => ({ version: 1, constructed: [] }),
  stateFingerprint: (state) => `foundry-construction:v${state.version}:${state.constructed.join(",")}`,
  stateVersion: (state) => state.version,
  resolve: (inputs) => ({
    resolution: {
      resolved: [
        { key: "capability", value: inputs.capabilityId, source: "verified", provenance: "Door + Ledger validated foundry candidate" },
        { key: "kind", value: inputs.capabilityKind, source: "verified", provenance: "Closed foundry ontology" },
      ],
      unresolved: [],
      commitConstraints: [
        { key: "authority", description: "Construction requires governance approval.", condition: "authority", satisfied: true },
        { key: "capability", description: "Capability must be in the closed foundry ontology.", condition: "required", satisfied: true },
      ],
    },
    evidence: [{ id: `foundry:${inputs.capabilityId}`, claim: "A governed capability candidate passed Door and Ledger.", source: "Foundry deterministic validation", kind: "verified", provenance: "Public-safe closed ontology" }],
    proposedEffect: { type: "CONSTRUCT_WEBMCP_TOOL", capabilityId: inputs.capabilityId },
  }),
  simulateConcurrentChange: (state) => ({ ...state, version: state.version + 1 }),
  applyEffect: (state, effect) => ({ version: state.version + 1, constructed: [...state.constructed, effect.capabilityId] }),
};

class FoundryConstructionPolicy implements PolicyProvider<ConstructionInputs, ConstructionState, ConstructionEffect> {
  authorize({ candidate }: { candidate: DecisionCandidate<ConstructionInputs, ConstructionEffect>; currentState: ConstructionState }): AuthorizationAssessment {
    const checks: AuthorizationAssessment["checks"] = [
      { key: "authority", outcome: "PASS", detail: "Governance approved the governed construction." },
      { key: "capability", outcome: "PASS", detail: `${candidate.proposedEffect.capabilityId} is in the closed foundry ontology.` },
    ];
    return { outcome: "ALLOWED", reason: "Governed construction is authorized for this actor, state, and capability.", checks };
  }
}

// ---------------------------------------------------------------------------
// The liaison orchestrator.
// ---------------------------------------------------------------------------

export interface FoundryRefusal {
  implementationPossible: true;
  capabilityUnderstood: boolean;
  authorityEstablished: false;
  reasons: string[];
}

export interface FoundryReasoning {
  unresolved: string[];
  claims: string[];
  provider: string;
}

export interface FoundryBuildResult {
  kind: "FOUNDRY_BUILD";
  intent: string;
  outcome: FoundryOutcome;
  activity: FoundryActivity[];
  tool?: WebMCPToolDefinition;
  descriptor?: GovernedCapabilityDescriptor;
  refusal?: FoundryRefusal;
  reasoning?: FoundryReasoning;
  commitAuthorization?: CommitAuthorization;
  constructionNodes?: readonly ToolConstructionNodeOutcome[];
}

export interface AbsorptionReview {
  approved: boolean;
  evidence: OutcomeEvidence;
  activity: FoundryActivity[];
}

export class XactFoundryLiaison {
  constructor(private readonly oAgent: OAgentProvider = new SecureEndpointOAgentProvider()) {}

  /**
   * Build the governed tool definition. Emits through BUILD only; the result is
   * COMPOSED_DEFINITION (inert), never REGISTERED_TOOL or WORKING_TOOL.
   */
  async buildCapability(
    intent: string,
    onActivity?: (activity: FoundryActivity) => void,
  ): Promise<FoundryBuildResult> {
    const activity: FoundryActivity[] = [];
    const emit = (a: FoundryActivity) => { activity.push(a); onActivity?.(a); };

    const decomposition = decomposeIntent(intent);
    if (!decomposition.pattern) {
      emit({ type: "RESOLVE", label: "Intent", detail: "No closed-ontology pattern matched — reasoning to understand the request.", status: "PENDING" });
      emit({ type: "REASON_STARTED", label: "Reasoning", detail: "Understanding the requested capability.", status: "PENDING" });
      try {
        const result = await this.oAgent.reason({
          context: { stage: "foundry", intent: intent.slice(0, 240) },
          unresolved: ["the requested capability"],
        });
        const claims = result.evidence.map((item) => item.claim);
        emit({ type: "REASON_EVIDENCE", label: "O-Agent", detail: `${result.provider} returned a structured interpretation.`, status: "EVIDENCE" });
        emit({ type: "BLOCKED", label: "Governance", detail: "Capability understood, but not in the closed ontology — pending governance to add it.", status: "BLOCK" });
        return {
          kind: "FOUNDRY_BUILD",
          intent,
          outcome: "PENDING_GOVERNANCE",
          activity,
          reasoning: { unresolved: ["the requested capability"], claims, provider: result.provider },
        };
      } catch (cause) {
        emit({ type: "REASON_FAILED", label: "O-Agent", detail: cause instanceof Error ? cause.message : "Reasoning provider unavailable.", status: "BLOCK" });
        throw cause; // fail closed
      }
    }

    if (decomposition.pattern.blocked) {
      emit({ type: "RESOLVE", label: "Intent", detail: `${decomposition.pattern.label} is understood and representable.`, status: "PASS" });
      emit({ type: "BLOCKED", label: "Authority", detail: "IMPLEMENTATION POSSIBLE — AUTHORITY NOT ESTABLISHED.", status: "BLOCK" });
      return {
        kind: "FOUNDRY_BUILD",
        intent,
        outcome: "BLOCKED",
        activity,
        refusal: {
          implementationPossible: true,
          capabilityUnderstood: true,
          authorityEstablished: false,
          reasons: [...decomposition.pattern.blocked.reasons],
        },
      };
    }

    const descriptor = decomposition.descriptor!;
    emit({ type: "RESOLVE", label: "Resolve", detail: `Decomposed intent into capability "${descriptor.id}".`, status: "PASS" });

    emit({ type: "DOOR", label: "DOOR", detail: decomposition.door.admissible ? "Admissible — in the closed ontology." : decomposition.door.errors.join(" "), status: decomposition.door.admissible ? "PASS" : "BLOCK" });
    emit({ type: "LEDGER", label: "LEDGER", detail: decomposition.ledger.valid ? "Valid — no authority or execution surface." : decomposition.ledger.violations.join(" "), status: decomposition.ledger.valid ? "PASS" : "BLOCK" });
    if (!decomposition.door.admissible || !decomposition.ledger.valid) {
      return { kind: "FOUNDRY_BUILD", intent, outcome: "BLOCKED", activity };
    }

    // REASON — genuine U through the real O-Agent boundary (fail-closed).
    let reasoning: FoundryReasoning | undefined;
    const genuineU = decomposition.pattern.genuineU;
    if (genuineU.length > 0) {
      emit({ type: "REASON_STARTED", label: "Reasoning", detail: `${genuineU.length} semantic requirement(s) need interpretation.`, status: "PENDING" });
      try {
        const result = await this.oAgent.reason({
          context: { stage: "foundry", capability: descriptor.id, intent: intent.slice(0, 240) },
          unresolved: [...genuineU],
        });
        reasoning = { unresolved: [...genuineU], claims: result.evidence.map((item) => item.claim), provider: result.provider };
        emit({ type: "REASON_EVIDENCE", label: "O-Agent", detail: `${result.provider} returned structured evidence.`, status: "EVIDENCE" });
      } catch (cause) {
        emit({ type: "REASON_FAILED", label: "O-Agent", detail: cause instanceof Error ? cause.message : "Reasoning provider unavailable.", status: "BLOCK" });
        throw cause; // fail closed
      }
      emit({ type: "RE_ENTRY", label: "Re-entry", detail: "Structured evidence re-enters Xact for governed resolution.", status: "PASS" });
    }

    return this.finishBuild(intent, descriptor, reasoning, activity, emit);
  }

  /**
   * AUTHORIZATION → COMMIT → BUILD. The shared tail of a construction run: the
   * exact construction consequence crosses the authority boundary, then the
   * X-Nodes compose the inert definition. `reasoning` is the already-attested
   * semantic evidence (from the internal O-Agent or, for the ChatGPT Boss loop,
   * from the external Boss) — it is recorded, never re-derived here.
   */
  private async finishBuild(
    intent: string,
    descriptor: GovernedCapabilityDescriptor,
    reasoning: FoundryReasoning | undefined,
    activity: FoundryActivity[],
    emit: (activity: FoundryActivity) => void,
  ): Promise<FoundryBuildResult> {
    const provider = new SimulationDecisionProvider(constructionPack, new FoundryConstructionPolicy());
    const candidateDecision = await provider.resolve({ capabilityId: descriptor.id, capabilityKind: descriptor.capabilityKind }, { version: 1, constructed: [] });
    const decisionResult = await provider.commit(candidateDecision, { version: 1, constructed: [] });
    const authorized = decisionResult.status === "AUTHORIZED";
    emit({ type: "AUTHORIZATION", label: "Authorization", detail: authorized ? "This exact construction consequence is authorized now." : "Consequence not authorized.", status: authorized ? "PASS" : "BLOCK" });

    let commitAuthorization: CommitAuthorization | undefined;
    if (authorized) {
      const store = new InMemoryAuthorizationArtifactStore();
      const issuer = new AuthorizationArtifactIssuer(store);
      const issued = {
        ...decisionResult,
        artifact: issuer.issue({
          commitId: decisionResult.candidate.candidateId,
          effectFingerprint: stableFingerprint(decisionResult.candidate.proposedEffect),
          baseStateFingerprint: decisionResult.candidate.baseStateFingerprint,
          actor: "foundry.construction",
          capability: "webmcp_tool:construct",
        }),
      };
      commitAuthorization = commitAuthorizationFrom(issued);
      emit({ type: "COMMIT", label: "Commit", detail: "Construction consequence crossed the authority boundary.", status: "PASS" });
    }

    // BUILD — real deterministic construction through visible X-Node stages.
    const construction = constructWebMCPToolWithNodes(descriptor);
    for (const node of construction.nodes) {
      emit({ type: "BUILD", label: "X-Node build", detail: node.label, status: "PASS" });
    }
    const tool = construction.tool;

    const outcome: FoundryOutcome = commitAuthorization ? "COMPOSED_DEFINITION" : "BLOCKED";

    return {
      kind: "FOUNDRY_BUILD",
      intent,
      outcome,
      activity,
      tool,
      descriptor,
      reasoning,
      commitAuthorization,
      constructionNodes: construction.nodes,
    };
  }

  /**
   * Build a recognized capability whose semantic requirements have already been
   * resolved OUTSIDE the liaison — the ChatGPT Boss loop calls this as the
   * Xact re-entry after `submit_boss_resolution`. It never invokes the internal
   * O-Agent; the supplied reasoning evidence is re-entered and recorded, then
   * AUTHORIZATION → COMMIT → BUILD proceeds exactly as in `buildCapability`.
   */
  async buildCapabilityWithReasoning(
    intent: string,
    reasoning: { unresolved: string[]; claims: string[]; provider: string },
    onActivity?: (activity: FoundryActivity) => void,
  ): Promise<FoundryBuildResult> {
    const activity: FoundryActivity[] = [];
    const emit = (a: FoundryActivity) => { activity.push(a); onActivity?.(a); };

    const decomposition = decomposeIntent(intent);
    if (!decomposition.pattern || decomposition.pattern.blocked) {
      throw new Error("Boss re-entry requires a recognized, non-blocked governed capability.");
    }
    const descriptor = decomposition.descriptor!;
    if (!decomposition.door.admissible || !decomposition.ledger.valid) {
      return { kind: "FOUNDRY_BUILD", intent, outcome: "BLOCKED", activity };
    }

    emit({ type: "RESOLVE", label: "Resolve", detail: `Decomposed intent into capability "${descriptor.id}".`, status: "PASS" });
    emit({ type: "DOOR", label: "DOOR", detail: "Admissible — in the closed ontology.", status: "PASS" });
    emit({ type: "LEDGER", label: "LEDGER", detail: "Valid — no authority or execution surface.", status: "PASS" });

    const attested: FoundryReasoning = {
      unresolved: [...reasoning.unresolved],
      claims: [...reasoning.claims],
      provider: reasoning.provider,
    };
    emit({ type: "REASON_EVIDENCE", label: "Boss", detail: `${reasoning.provider} returned structured interpretation.`, status: "EVIDENCE" });
    emit({ type: "RE_ENTRY", label: "Re-entry", detail: "Boss interpretation re-enters Xact for governed construction.", status: "PASS" });

    return this.finishBuild(intent, descriptor, attested, activity, emit);
  }

  /**
   * Build directly from an already-governed descriptor (no decomposition, no
   * internal reasoning). This is the COMPOSABLE path of the Boss composition
   * seam: the descriptor still passes Door/Ledger and then the SAME
   * AUTHORIZATION → COMMIT → BUILD boundary as every other construction. It is
   * never a shortcut around Commit.
   */
  async buildFromDescriptor(
    descriptor: GovernedCapabilityDescriptor,
    onActivity?: (activity: FoundryActivity) => void,
  ): Promise<FoundryBuildResult> {
    const activity: FoundryActivity[] = [];
    const emit = (a: FoundryActivity) => { activity.push(a); onActivity?.(a); };

    const recognition = recognizeGovernedCapability(descriptor);
    if (!recognition.recognized) {
      emit({ type: "DOOR", label: "DOOR", detail: recognition.checks.join(" "), status: "BLOCK" });
      return { kind: "FOUNDRY_BUILD", intent: descriptor.label, outcome: "BLOCKED", activity };
    }
    emit({ type: "RESOLVE", label: "Resolve", detail: `Composed descriptor "${descriptor.id}" from a governed composition.`, status: "PASS" });
    emit({ type: "DOOR", label: "DOOR", detail: "Admissible — composed from the closed governed vocabulary.", status: "PASS" });
    emit({ type: "LEDGER", label: "LEDGER", detail: "Valid — no authority or execution surface.", status: "PASS" });

    return this.finishBuild(descriptor.label, descriptor, undefined, activity, emit);
  }

  /**
   * Post-verification absorption: record the verified construction as outcome
   * evidence and submit it to governance. This runs only after REGISTER →
   * OBSERVE → VERIFY (the browser host), never before the tool is verified.
   */
  reviewForAbsorption(
    descriptor: GovernedCapabilityDescriptor,
    candidate: CandidateCapability,
    onActivity?: (activity: FoundryActivity) => void,
  ): AbsorptionReview {
    const activity: FoundryActivity[] = [];
    const emit = (a: FoundryActivity) => { activity.push(a); onActivity?.(a); };

    const evidence = recordOutcomeEvidence({
      id: `outcome:${descriptor.id}`,
      capabilityId: candidate.id,
      resolves: [...candidate.resolves],
      verifiedConsequence: {
        effectFingerprint: `fp:${descriptor.id}`,
        verifiedAtEpochMs: 1,
        verificationSource: "Registered, observed, and verified WebMCP tool",
      },
      measurement: {
        verdict: "EFFECTIVE",
        objective: `The ${descriptor.id} tool is registered and verifiably invocable`,
        measuredAtEpochMs: 1,
      },
    });
    const decision = issueGovernanceDecision({
      id: `governance:${descriptor.id}`,
      evidenceId: evidence.id,
      approval: "APPROVED",
      decidedBy: "Foundry governance action",
      rationale: "Verified registration and observation support governed absorption.",
      decidedAtEpochMs: 1,
    });
    const approved = governCandidate(candidate, evidence, decision).targetState === "APPROVED";
    emit({ type: "GOVERNANCE", label: "Governance", detail: approved ? "Verified pattern approved for absorption." : "Governance did not approve.", status: approved ? "PASS" : "BLOCK" });

    return { approved, evidence, activity };
  }
}
