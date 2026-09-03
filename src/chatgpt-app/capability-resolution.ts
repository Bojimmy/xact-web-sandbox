import { FOUNDRY_CATALOG, type FoundryCatalogEntry } from "../flagship/foundry-catalog";

/**
 * Public-safe, declared discovery vocabulary for the governed Foundry catalog.
 *
 * These terms are product copy, not a reconstruction of Xact matching internals.
 * A term may identify an equivalent governed recipe only when it is explicitly
 * declared here. Everything else either receives a bounded clarification or a
 * truthful unavailable result.
 */
const DISCOVERY_TERMS: Readonly<Record<string, readonly string[]>> = {
  read_active_users_and_open_requests: ["active users and open requests", "user stats and user requests"],
  get_work_order_queue: ["field work order queue", "dispatch queue", "field operations queue"],
  get_urgent_work_order_triage: ["urgent work order triage", "urgent work orders triage", "urgent work-order triage", "show urgent work orders"],
  get_work_orders_owner_unavailable: ["work orders whose assigned owner is unavailable", "work orders with unavailable owners", "owner unavailable work orders"],
  get_urgent_work_orders_unqualified_owner: ["urgent work orders with no qualified owner", "no qualified owner available", "no available qualified owner", "available qualified owner", "qualified owner unavailable", "unqualified owner work orders"],
  get_employee_directory: ["employee organization directory", "employee directory", "company directory"],
  get_customer_support_queue: ["customer support queue", "support case queue", "open support cases", "customer operations"],
  get_support_lead_decision_queue: ["support lead decision queue", "tickets awaiting support lead review", "awaiting support lead review", "grouped by possible next action", "decision queue"],
  get_escalated_support_case_review: ["escalated support case review", "escalated support cases", "escalated case review"],
  get_support_escalation_evidence: ["support escalation-condition evidence", "tickets meeting escalation conditions", "support tickets that meet the stated conditions for escalation", "qualifying evidence for escalation"],
  get_service_credit_opportunities: ["service-credit opportunity evidence", "eligible but unissued service-credit opportunity", "eligible but unissued service-credit opportunities", "unissued service-credit opportunities", "qualifying evidence and prior credits"],
  get_customer_plan_change_history: ["account plan changes recorded in audit history", "plan-change audit history", "prior plan and resulting plan"],
  composed_read_customer_request: ["customers waiting longest", "longest waiting customers", "longest-waiting customer view", "customers who have been waiting longest", "customers have been waiting the longest"],
  get_customer_health_summary: ["customer account health", "customer health summary", "account health", "customer operations"],
  get_business_operations_report: ["weekly business operations report", "weekly operations report", "business operations report"],
  get_current_operations_snapshot: ["current operations snapshot", "operations snapshot", "live operations snapshot", "current operations overview"],
  get_operations_exception_brief: ["operations exception brief", "exception brief", "operations exceptions"],
  get_owner_workload: ["owner workload", "assigned work orders and support tickets", "owner assigned workload"],
  get_customer_360: ["customer 360", "customer 360 surface", "account support history open cases work orders and health", "customer evidence view"],
  get_campaign_dashboard: ["promotion campaign dashboard", "campaign dashboard", "campaign delivery state"],
  get_sales_pipeline_forecast: ["sales pipeline forecast", "sales forecast", "pipeline forecast"],
  get_sales_leaderboard: ["sales leaderboard", "sales ranking", "top sales reps", "sales leaderboard ranking", "sales performance ranking"],
  get_marketing_performance: ["marketing performance dashboard", "marketing performance", "marketing dashboard"],
  prepare_weekly_promotional_email_campaign: ["weekly promotional email drafts", "promotional email drafts", "email campaign drafts"],
  find_customer_by_email: ["customer lookup by email", "find customer by email", "customer email lookup"],
  get_audit_history: ["customer audit history", "customer service history", "account audit history"],
  issue_service_credit: ["issue a service credit", "service credit"],
  refund_delivery_fee: ["refund delivery fee", "delivery-fee refund", "delivery fee refund"],
  change_service_plan: ["change customer service plan", "customer plan change", "service plan change"],
  find_employees_by_role: ["find employees by role", "employee role lookup", "employees with a role"],
  get_division_roster: ["division roster", "team roster by division", "division employee roster"],
  get_department_headcount: ["department headcount", "headcount by department", "team headcount"],
  get_employees_by_location: ["employees by location", "employee location lookup", "office employee roster"],
  get_employees_on_leave: ["employees on leave", "leave roster", "who is on leave"],
  get_direct_reports: ["direct reports", "manager direct reports", "reporting roster"],
  get_customers_at_risk: ["at-risk customers", "customers at risk", "risk accounts", "customer operations"],
  get_customers_by_plan: ["customers by plan", "customer plan roster", "accounts on a plan"],
  get_work_orders_by_owner: ["work orders by owner", "owner work orders", "assigned field work"],
  get_support_tickets_by_owner: ["support tickets by owner", "owner support tickets", "assigned support tickets"],
  reassign_support_ticket: ["reassign support ticket", "support ticket reassignment"],
  reassign_work_order: ["reassign work order", "work order reassignment"],
  escalate_support_ticket: ["escalate support ticket", "support ticket escalation"],
  set_customer_next_action: ["set customer next action", "customer next action update"],
  update_employee_status: ["update employee status", "employee status update"],
};

export interface CapabilityCandidate {
  readonly id: string;
  readonly title: string;
  readonly kind: FoundryCatalogEntry["kind"];
  readonly description: string;
  readonly example: string;
}

export interface CandidateBuildBrief {
  readonly status: "CANDIDATE_BUILD_BRIEF";
  readonly requestedOutcome: string;
  readonly missingGovernedCapability: string;
  readonly publicSafeScope: "READ_ONLY";
  readonly nextStep: "GOVERNANCE_REVIEW_REQUIRED";
}

export type CapabilityResolution =
  | { readonly outcome: "EXACT"; readonly candidate: CapabilityCandidate }
  | { readonly outcome: "CLARIFY"; readonly question: string; readonly candidates: readonly CapabilityCandidate[] }
  | { readonly outcome: "UNAVAILABLE"; readonly reason: string; readonly candidateBuildBrief: CandidateBuildBrief };

function normalized(value: string): string {
  return ` ${value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;
}

function toCandidate(entry: FoundryCatalogEntry): CapabilityCandidate {
  const values = Object.fromEntries(entry.fields.map((field) => [field.key, field.defaultValue]));
  return {
    id: entry.id,
    title: entry.title,
    kind: entry.kind,
    description: entry.description,
    example: entry.buildIntent(values),
  };
}

/** Resolve only explicitly declared public discovery terms; never guess. */
export function resolveCapabilityIntent(intent: string): CapabilityResolution {
  const input = normalized(intent);
  const matches = FOUNDRY_CATALOG.flatMap((entry) => {
    const declaredTerms = DISCOVERY_TERMS[entry.id] ?? [];
    const matched = declaredTerms.filter((term) => input.includes(normalized(term)));
    return matched.length === 0 ? [] : [{ entry, score: Math.max(...matched.map((term) => normalized(term).trim().split(" ").length)) }];
  }).filter(({ entry }) => !(entry.kind === "MUTATION" && /read[- ]only|do not (?:propose|issue|change|reassign|escalate)|unissued/i.test(intent)))
    .sort((left, right) => right.score - left.score || left.entry.title.localeCompare(right.entry.title));

  if (matches.length === 1) return { outcome: "EXACT", candidate: toCandidate(matches[0].entry) };

  if (matches.length > 1) {
    return {
      outcome: "CLARIFY",
      question: "Which approved capability best matches the request? Choose one of these governed options.",
      candidates: matches.slice(0, 3).map(({ entry }) => toCandidate(entry)),
    };
  }

  return {
    outcome: "UNAVAILABLE",
    reason: "No approved public-safe capability matches this request. Xact will not substitute a similar-looking capability.",
    candidateBuildBrief: {
      status: "CANDIDATE_BUILD_BRIEF",
      requestedOutcome: intent.slice(0, 240),
      missingGovernedCapability: "A new governed, public-safe read-only capability and data contract are required.",
      publicSafeScope: "READ_ONLY",
      nextStep: "GOVERNANCE_REVIEW_REQUIRED",
    },
  };
}

/** Testable coverage guard: every governed catalog entry declares discovery copy. */
export function declaredDiscoveryIds(): readonly string[] {
  return Object.keys(DISCOVERY_TERMS);
}
