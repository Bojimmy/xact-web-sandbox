import { describeCapability, type GovernedCapabilityDescriptor } from "../flagship/capability-vocabulary";
import { actorBoundaryFor } from "../flagship/foundry-liaison";
import { stableFingerprint } from "../xact/authorization-artifact";
import type { WebMCPToolDefinition } from "../flagship/webmcp-tool-builder";

/**
 * The Boss composition seam.
 *
 * ChatGPT understands intent open-endedly, then submits a STRUCTURED proposal
 * whose fields are GOVERNED IDENTIFIERS. Xact—not the Boss—classifies that
 * proposal as ALREADY_GOVERNED, COMPOSABLE, NEEDS_RESOLUTION, NOVEL_BOUNDARY,
 * or UNAUTHORIZED, using only the closed vocabulary and explicit combination
 * rules.
 *
 * "Open-ended understanding. Closed, governed execution."
 */

export interface CapabilityComposition {
  actor?: string;
  capability: "READ" | "MUTATION";
  resource: string[];
  operation?: string[];
  filter?: string[];
  sort?: string;
  output: string[];
  mutation?: "NONE" | string;
}

/** Closed governed resource identifiers. */
export const GOVERNED_RESOURCES = Object.freeze([
  "CUSTOMER",
  "REQUEST",
  "CUSTOMER_REQUEST",
  "EMPLOYEE",
  "WORK_ORDER",
  "SALES_OPPORTUNITY",
  "CAMPAIGN",
  "MARKETING_CAMPAIGN",
  "AUDIT_RECORD",
  "OPERATIONS",
] as const);

/** Closed governed operation identifiers. */
export const GOVERNED_OPERATIONS = Object.freeze(["LIST", "FILTER", "SORT", "COUNT"] as const);

/** Closed governed filter identifiers (status filters and field filters). */
export const GOVERNED_FILTERS = Object.freeze([
  "STATUS_OPEN",
  "STATUS_AT_RISK",
  "STATUS_ON_LEAVE",
  "STATUS_ESCALATED",
  "STATUS_URGENT",
  "PRIORITY_URGENT",
  "QUALIFIED_OWNER_UNAVAILABLE",
  "AWAITING_REVIEW",
  "ROLE",
  "DIVISION",
  "DEPARTMENT",
  "LOCATION",
  "MANAGER",
  "OWNER",
  "PLAN",
  "EMAIL",
] as const);

/** Closed governed sort identifiers. */
export const GOVERNED_SORTS = Object.freeze([
  "WAIT_DURATION_DESC",
  "WAIT_DURATION_ASC",
  "PRIORITY_DESC",
  "DUE_ASC",
  "DUE_TIME_ASC",
] as const);

/** Closed governed output field identifiers. */
export const GOVERNED_FIELDS = Object.freeze([
  "CUSTOMER_ID",
  "REQUEST_ID",
  "WAIT_DURATION",
  "EMPLOYEE_ID",
  "NAME",
  "OWNER",
  "STATUS",
  "PLAN",
  "HEALTH",
  "EMAIL",
  "ROLE",
  "DIVISION",
  "DEPARTMENT",
  "LOCATION",
  "MANAGER",
  "PRIORITY",
  "DUE",
  "DUE_TIME",
  "QUALIFIED_OWNER_AVAILABLE",
  "DECISION_CATEGORY",
  "POSSIBLE_NEXT_ACTION",
  "TITLE",
  "WORK_ORDER_ID",
  "OPPORTUNITY_ID",
  "CAMPAIGN_ID",
  "REACH",
  "ENGAGEMENT",
  "CONVERSION",
  "REPRESENTATIVE",
  "TEAM",
  "CLOSED_DEALS",
  "REVENUE",
  "QUOTA_ATTAINMENT",
  "RANK",
  "SEVERITY",
  "AUDIT_ENTRY",
  "SLA",
  "HEADCOUNT",
] as const);

/** Closed governed mutation-effect identifiers. */
export const GOVERNED_MUTATIONS = Object.freeze([
  "REASSIGN",
  "ESCALATE",
  "SET_NEXT_ACTION",
  "UPDATE_STATUS",
  "ISSUE_CREDIT",
  "REFUND_FEE",
  "CHANGE_PLAN",
] as const);

/** Understood but forbidden consequences — no governed approval path. */
export const FORBIDDEN_MUTATIONS = Object.freeze([
  "DELETE_ACCOUNT",
  "DELETE_EMPLOYEE",
  "TERMINATE",
  "SEND_EMAIL",
] as const);

export type CompositionOutcome =
  | { readonly outcome: "ALREADY_GOVERNED"; readonly capabilityId: string }
  | { readonly outcome: "COMPOSABLE"; readonly descriptor: GovernedCapabilityDescriptor }
  | { readonly outcome: "NEEDS_RESOLUTION"; readonly question: string }
  | { readonly outcome: "NOVEL_BOUNDARY"; readonly missing: readonly string[] }
  | { readonly outcome: "UNAUTHORIZED"; readonly reason: string };

function canonicalKey(composition: CapabilityComposition): string {
  return stableFingerprint({
    capability: composition.capability,
    resource: [...composition.resource].sort(),
    operation: [...(composition.operation ?? [])].sort(),
    filter: [...(composition.filter ?? [])].sort(),
    sort: composition.sort ?? null,
    output: [...composition.output].sort(),
    mutation: composition.mutation ?? "NONE",
  });
}

/**
 * The catalog fast path. Every absorbed recipe declares its canonical
 * composition; lookup is a pure structural fingerprint — never similarity,
 * never a guess.
 */
const COMPOSITION_ALIASES = new Map<string, string>();

function seedAlias(composition: CapabilityComposition, capabilityId: string): void {
  COMPOSITION_ALIASES.set(canonicalKey(composition), capabilityId);
}

/** Seed the 31 already-absorbed recipes with their declared canonical compositions. */
function seedAbsorbedRecipes(): void {
  const read = (resource: string[], output: string[], filter?: string[], sort?: string): CapabilityComposition =>
    ({ capability: "READ", resource, operation: ["LIST"], filter, sort, output });
  const readCount = (resource: string[], output: string[], filter?: string[]): CapabilityComposition =>
    ({ capability: "READ", resource, operation: ["COUNT"], filter, output });
  const mutate = (actor: string, resource: string[], effect: string, output: string[]): CapabilityComposition =>
    ({ actor, capability: "MUTATION", resource, output, mutation: effect });

  const absorbed: ReadonlyArray<readonly [CapabilityComposition, string]> = [
    [read(["CUSTOMER_REQUEST"], ["CUSTOMER_ID", "REQUEST_ID"], ["STATUS_OPEN"]), "read_active_users_and_open_requests"],
    [read(["WORK_ORDER"], ["WORK_ORDER_ID", "OWNER", "PRIORITY", "STATUS", "DUE"]), "get_work_order_queue"],
    [read(["WORK_ORDER"], ["WORK_ORDER_ID", "OWNER", "PRIORITY", "DUE", "BLOCKER"], ["PRIORITY_URGENT"]), "get_urgent_work_order_triage"],
    [read(["WORK_ORDER"], ["WORK_ORDER_ID", "OWNER", "PRIORITY", "DUE", "STATUS"], ["OWNER_UNAVAILABLE"]), "get_work_orders_owner_unavailable"],
    [read(["WORK_ORDER"], ["OWNER", "QUALIFIED_OWNER_AVAILABLE", "DUE_TIME", "STATUS"], ["PRIORITY_URGENT", "QUALIFIED_OWNER_UNAVAILABLE"], "DUE_TIME_ASC"), "get_urgent_work_orders_unqualified_owner"],
    [read(["REQUEST"], ["REQUEST_ID", "DECISION_CATEGORY", "POSSIBLE_NEXT_ACTION"], ["AWAITING_REVIEW"]), "get_support_lead_decision_queue"],
    [read(["EMPLOYEE"], ["EMPLOYEE_ID", "NAME", "ROLE"]), "get_employee_directory"],
    [read(["REQUEST"], ["REQUEST_ID", "CUSTOMER_ID", "SEVERITY", "OWNER", "STATUS"], ["STATUS_OPEN"]), "get_customer_support_queue"],
    [read(["REQUEST", "CUSTOMER", "AUDIT_RECORD"], ["REQUEST_ID", "SEVERITY", "OWNER", "AUDIT_ENTRY", "NEXT_REVIEW"], ["STATUS_ESCALATED"], "SEVERITY_DESC,NEXT_REVIEW_ASC"), "get_escalated_support_case_review"],
    [read(["REQUEST", "CUSTOMER", "AUDIT_RECORD"], ["REQUEST_ID", "SEVERITY", "OWNER", "AUDIT_ENTRY", "ESCALATION_CONDITION"], ["ESCALATION_ELIGIBLE"]), "get_support_escalation_evidence"],
    [read(["CUSTOMER", "REQUEST", "AUDIT_RECORD"], ["CUSTOMER_ID", "AUDIT_ENTRY", "CREDIT_COUNT_30D", "ELIGIBILITY"], ["CREDIT_ELIGIBLE", "CREDIT_UNISSUED"]), "get_service_credit_opportunities"],
    [read(["CUSTOMER", "AUDIT_RECORD"], ["CUSTOMER_ID", "AUDIT_ENTRY", "DATE", "PRIOR_PLAN", "RESULTING_PLAN"], ["EMAIL"]), "get_customer_plan_change_history"],
    [read(["CUSTOMER"], ["CUSTOMER_ID", "NAME", "PLAN", "HEALTH"]), "get_customer_health_summary"],
    [read(["OPERATIONS"], ["SLA", "HEADCOUNT", "STATUS"]), "get_business_operations_report"],
    [read(["OPERATIONS"], ["WORK_ORDER_ID", "REQUEST_ID", "STATUS"]), "get_current_operations_snapshot"],
    [read(["OPERATIONS", "WORK_ORDER", "REQUEST", "CUSTOMER"], ["WORK_ORDER_ID", "REQUEST_ID", "STATUS", "SEVERITY", "HEALTH"]), "get_operations_exception_brief"],
    [read(["WORK_ORDER", "REQUEST"], ["OWNER", "WORK_ORDER_ID", "REQUEST_ID", "PRIORITY", "DUE"]), "get_owner_workload"],
    [read(["CUSTOMER", "REQUEST", "WORK_ORDER"], ["CUSTOMER_ID", "REQUEST_ID", "WORK_ORDER_ID", "HEALTH", "AUDIT_ENTRY"]), "get_customer_360"],
    [read(["CUSTOMER_REQUEST"], ["CUSTOMER_ID", "REQUEST_ID", "WAIT_DURATION"], undefined, "WAIT_DURATION_DESC"), "composed_read_customer_request"],
    [read(["CAMPAIGN"], ["CAMPAIGN_ID", "REACH", "STATUS"]), "get_campaign_dashboard"],
    [read(["SALES_OPPORTUNITY"], ["OPPORTUNITY_ID", "OWNER", "STATUS", "DUE"]), "get_sales_pipeline_forecast"],
    [read(["SALES_OPPORTUNITY"], ["REPRESENTATIVE", "TEAM", "CLOSED_DEALS", "REVENUE", "QUOTA_ATTAINMENT", "RANK"]), "get_sales_leaderboard"],
    [read(["MARKETING_CAMPAIGN"], ["CAMPAIGN_ID", "REACH", "ENGAGEMENT", "CONVERSION"]), "get_marketing_performance"],
    [read(["CAMPAIGN"], ["CAMPAIGN_ID", "REACH"]), "prepare_weekly_promotional_email_campaign"],
    [read(["CUSTOMER"], ["CUSTOMER_ID", "NAME", "EMAIL"], ["EMAIL"]), "find_customer_by_email"],
    [read(["AUDIT_RECORD"], ["AUDIT_ENTRY", "CUSTOMER_ID"]), "get_audit_history"],
    [read(["EMPLOYEE"], ["EMPLOYEE_ID", "NAME", "ROLE"], ["ROLE"]), "find_employees_by_role"],
    [read(["EMPLOYEE"], ["EMPLOYEE_ID", "NAME", "DIVISION"], ["DIVISION"]), "get_division_roster"],
    [readCount(["EMPLOYEE"], ["HEADCOUNT"], ["DEPARTMENT"]), "get_department_headcount"],
    [read(["EMPLOYEE"], ["EMPLOYEE_ID", "NAME", "LOCATION"], ["LOCATION"]), "get_employees_by_location"],
    [read(["EMPLOYEE"], ["EMPLOYEE_ID", "NAME", "STATUS"], ["STATUS_ON_LEAVE"]), "get_employees_on_leave"],
    [read(["EMPLOYEE"], ["EMPLOYEE_ID", "NAME", "MANAGER"], ["MANAGER"]), "get_direct_reports"],
    [read(["CUSTOMER"], ["CUSTOMER_ID", "NAME", "HEALTH"], ["STATUS_AT_RISK"]), "get_customers_at_risk"],
    [read(["CUSTOMER"], ["CUSTOMER_ID", "NAME", "PLAN"], ["PLAN"]), "get_customers_by_plan"],
    [read(["WORK_ORDER"], ["WORK_ORDER_ID", "OWNER"], ["OWNER"]), "get_work_orders_by_owner"],
    [read(["REQUEST"], ["REQUEST_ID", "OWNER"], ["OWNER"]), "get_support_tickets_by_owner"],
    [mutate("SUPPORT_AGENT", ["CUSTOMER"], "ISSUE_CREDIT", ["CUSTOMER_ID"]), "issue_service_credit"],
    [mutate("SUPPORT_AGENT", ["REQUEST"], "REFUND_FEE", ["REQUEST_ID"]), "refund_delivery_fee"],
    [mutate("SUPPORT_AGENT", ["CUSTOMER"], "CHANGE_PLAN", ["CUSTOMER_ID", "PLAN"]), "change_service_plan"],
    [mutate("SERVICE_RECOVERY", ["REQUEST"], "REASSIGN", ["REQUEST_ID", "OWNER"]), "reassign_support_ticket"],
    [mutate("FIELD_OPS", ["WORK_ORDER"], "REASSIGN", ["WORK_ORDER_ID", "OWNER"]), "reassign_work_order"],
    [mutate("SERVICE_RECOVERY", ["REQUEST"], "ESCALATE", ["REQUEST_ID", "SEVERITY"]), "escalate_support_ticket"],
    [mutate("CUSTOMER_SUCCESS", ["CUSTOMER"], "SET_NEXT_ACTION", ["CUSTOMER_ID"]), "set_customer_next_action"],
    [mutate("PEOPLE", ["EMPLOYEE"], "UPDATE_STATUS", ["EMPLOYEE_ID", "STATUS"]), "update_employee_status"],
  ];

  for (const [composition, capabilityId] of absorbed) seedAlias(composition, capabilityId);
}

seedAbsorbedRecipes();

/**
 * Structural classification. Xact—not the Boss—decides what a proposal is
 * allowed to become. No semantic similarity, no synonym matching.
 */
export function validateComposition(composition: CapabilityComposition): CompositionOutcome {
  if (composition.capability !== "READ" && composition.capability !== "MUTATION") {
    return { outcome: "UNAUTHORIZED", reason: "capability must be READ or MUTATION." };
  }
  if (composition.resource.length === 0) return { outcome: "UNAUTHORIZED", reason: "resource is required." };
  if (composition.output.length === 0) return { outcome: "UNAUTHORIZED", reason: "output is required." };
  if (composition.capability === "READ" && composition.mutation && composition.mutation !== "NONE") {
    return { outcome: "UNAUTHORIZED", reason: "a READ composition cannot carry a mutation." };
  }
  if (composition.capability === "MUTATION") {
    if (!composition.actor) return { outcome: "UNAUTHORIZED", reason: "a MUTATION composition requires an actor (ACTOR_BINDING)." };
    if (!composition.mutation || composition.mutation === "NONE") return { outcome: "UNAUTHORIZED", reason: "a MUTATION composition requires a governed mutation effect." };
    if (FORBIDDEN_MUTATIONS.includes(composition.mutation as (typeof FORBIDDEN_MUTATIONS)[number])) {
      return { outcome: "UNAUTHORIZED", reason: `${composition.mutation} is a destructive consequence with no governed approval path.` };
    }
  }

  const alias = COMPOSITION_ALIASES.get(canonicalKey(composition));
  if (alias) return { outcome: "ALREADY_GOVERNED", capabilityId: alias };

  const missing: string[] = [];
  for (const resource of composition.resource) {
    if (!GOVERNED_RESOURCES.includes(resource as (typeof GOVERNED_RESOURCES)[number])) missing.push(`resource:${resource}`);
  }
  for (const operation of composition.operation ?? []) {
    if (!GOVERNED_OPERATIONS.includes(operation as (typeof GOVERNED_OPERATIONS)[number])) missing.push(`operation:${operation}`);
  }
  for (const filter of composition.filter ?? []) {
    if (!GOVERNED_FILTERS.includes(filter as (typeof GOVERNED_FILTERS)[number])) missing.push(`filter:${filter}`);
  }
  if (composition.sort && !GOVERNED_SORTS.includes(composition.sort as (typeof GOVERNED_SORTS)[number])) {
    missing.push(`sort:${composition.sort}`);
  }
  for (const field of composition.output) {
    if (!GOVERNED_FIELDS.includes(field as (typeof GOVERNED_FIELDS)[number])) missing.push(`output:${field}`);
  }
  if (composition.capability === "MUTATION" && composition.mutation && composition.mutation !== "NONE") {
    if (!GOVERNED_MUTATIONS.includes(composition.mutation as (typeof GOVERNED_MUTATIONS)[number])) {
      missing.push(`mutation:${composition.mutation}`);
    }
  }

  if (missing.length > 0) return { outcome: "NOVEL_BOUNDARY", missing };

  if (composition.capability === "READ" && (!composition.operation || composition.operation.length === 0)) {
    return { outcome: "NEEDS_RESOLUTION", question: "Which operation should apply — LIST, FILTER, SORT, or COUNT?" };
  }

  return { outcome: "COMPOSABLE", descriptor: composeDescriptor(composition) };
}

function composeDescriptor(composition: CapabilityComposition): GovernedCapabilityDescriptor {
  const id = `composed_${composition.capability.toLowerCase()}_${composition.resource.join("_").toLowerCase()}`;
  const qualifiers = [
    ...(composition.filter?.length ? [`filter ${composition.filter.join(",")}`] : []),
    ...(composition.sort ? [`sort ${composition.sort}`] : []),
  ];
  const label = `Composed ${composition.capability.toLowerCase()} over ${composition.resource.join(" + ")}${qualifiers.length ? ` — ${qualifiers.join(" · ")}` : ""}`;
  const boundaries = composition.capability === "READ"
    ? [
        { primitive: "READ_CAPABILITY" as const, description: "Composed read over the governed business workspace" },
        { primitive: "SESSION_REQUIREMENT" as const, description: "state freshness required", freshnessRequired: true },
      ]
    : [
        ...(composition.actor ? [actorBoundaryFor(composition.actor)] : []),
        { primitive: "COMMIT_BOUNDARY" as const, description: "consequence requires a fresh Commit" },
        { primitive: "CONFIRMATION_REQUIREMENT" as const, description: "confirmation required", confirmationRequired: true },
        { primitive: "AUDIT_EVENT" as const, description: "audit event required", auditRequired: true },
      ];
  return describeCapability({
    id,
    capabilityKind: composition.capability,
    label,
    inputs: [],
    resolves: [...composition.output],
    boundaries,
  });
}

/**
 * Append a canonical composition alias. Low-level; `activateComposition` is the
 * governed entry point that calls this after a successful activation.
 */
export function registerCompositionAlias(composition: CapabilityComposition, capabilityId: string): void {
  COMPOSITION_ALIASES.set(canonicalKey(composition), capabilityId);
}

/** The capability ids covered by the fast path (declared + activated). */
export function declaredCompositionCapabilityIds(): readonly string[] {
  return [...new Set(COMPOSITION_ALIASES.values())];
}

/**
 * Activate (absorb) a composition so future proposals resolve ALREADY_GOVERNED.
 * The governance gate is the caller's responsibility; this only registers a
 * COMPOSABLE composition and is never a shortcut around Door/Ledger/Commit.
 */
export function activateComposition(composition: CapabilityComposition, capabilityId: string): { activated: boolean; rationale: string } {
  const validation = validateComposition(composition);
  if (validation.outcome !== "COMPOSABLE") {
    return { activated: false, rationale: `Only a COMPOSABLE composition may be activated (got ${validation.outcome}).` };
  }
  registerCompositionAlias(composition, capabilityId);
  return { activated: true, rationale: `Activated canonical composition for "${capabilityId}"; future proposals resolve ALREADY_GOVERNED.` };
}

/** Three-part summary for a composed tool (no catalog entry exists for it). */
export function summarizeComposedTool(tool: WebMCPToolDefinition) {
  const outputs = tool.outputSchema.required.length
    ? tool.outputSchema.required.join(", ")
    : "no declared outputs";
  if (tool.capabilityKind === "MUTATION") {
    return {
      builtAndValidated: `Xact composed the governed mutation \`${tool.name}\` contract (outputs: ${outputs}) from the Boss's proposed composition.`,
      currentBoundary: "Contract-only definition. No consequence was authorized; every future use requires a fresh Xact Commit.",
      nextRequiredCapability: "Bind an executable mutation handler through fresh Resolve → Commit → exact dispatch.",
    };
  }
  return {
    builtAndValidated: `Xact composed the governed, read-only \`${tool.name}\` contract (outputs: ${outputs}) from the Boss's proposed composition.`,
    currentBoundary: "Contract-only definition. No data was read, freshness was not verified, and no scheduled updates exist.",
    nextRequiredCapability: "Add an executable read handler bound to the approved public-safe workspace.",
  };
}

// ---------------------------------------------------------------------------
// Judge-facing presentation of a classification result (the copy the Boss uses,
// plus the activity steps the UI renders). Codex renders this directly.
// ---------------------------------------------------------------------------

export type OutcomeStepState = "PASS" | "BLOCK" | "PENDING" | "LOCK";

export interface OutcomeStep {
  readonly label: string;
  readonly state: OutcomeStepState;
}

export interface CompositionOutcomePresentation {
  readonly outcome: CompositionOutcome["outcome"];
  readonly judgeMessage: string;
  readonly detail?: string;
  readonly steps: readonly OutcomeStep[];
}

const UNDERSTAND_REQUEST = { label: "UNDERSTAND REQUEST", state: "PASS" } as const;
const PROPOSE_STRUCTURE = { label: "PROPOSE STRUCTURE", state: "PASS" } as const;
const VALIDATE_COMPOSITION = { label: "VALIDATE COMPOSITION", state: "PASS" } as const;

/** Map a classification result to the judge-facing message + activity steps. */
export function describeCompositionOutcome(outcome: CompositionOutcome): CompositionOutcomePresentation {
  switch (outcome.outcome) {
    case "ALREADY_GOVERNED":
      return {
        outcome: outcome.outcome,
        judgeMessage: "Xact already governs this composition. Building now.",
        detail: outcome.capabilityId,
        steps: [UNDERSTAND_REQUEST, PROPOSE_STRUCTURE, VALIDATE_COMPOSITION, { label: "ALREADY GOVERNED", state: "PASS" }],
      };
    case "COMPOSABLE":
      return {
        outcome: outcome.outcome,
        judgeMessage: "This exact capability is new, but every part is inside the governed construction language. Building it now.",
        steps: [
          { label: "STRUCTURE PROPOSED", state: "PASS" },
          { label: "PRIMITIVES GOVERNED", state: "PASS" },
          { label: "COMBINATION VALID", state: "PASS" },
          { label: "NEW GOVERNED COMPOSITION", state: "PASS" },
        ],
      };
    case "NEEDS_RESOLUTION":
      return {
        outcome: outcome.outcome,
        judgeMessage: "I understand most of it, but one real semantic question remains.",
        detail: outcome.question,
        steps: [UNDERSTAND_REQUEST, PROPOSE_STRUCTURE, VALIDATE_COMPOSITION, { label: "SEMANTIC RESOLUTION NEEDED", state: "PENDING" }],
      };
    case "NOVEL_BOUNDARY":
      return {
        outcome: outcome.outcome,
        judgeMessage: "I understand the capability, but part of it is outside Xact's governed construction language. Nothing was invented or executed.",
        detail: `Missing governed boundary: ${outcome.missing.join(", ")}`,
        steps: [UNDERSTAND_REQUEST, PROPOSE_STRUCTURE, VALIDATE_COMPOSITION, { label: "NOVEL GOVERNANCE BOUNDARY", state: "BLOCK" }],
      };
    case "UNAUTHORIZED":
      return {
        outcome: outcome.outcome,
        judgeMessage: "The Boss understood it. Xact refused to make it real.",
        detail: outcome.reason,
        steps: [
          { label: "UNDERSTOOD", state: "PASS" },
          { label: "STRUCTURE PROPOSED", state: "PASS" },
          { label: "TECHNICALLY REPRESENTABLE", state: "PASS" },
          { label: "AUTHORITY NOT ESTABLISHED", state: "LOCK" },
          { label: "BUILD BLOCKED", state: "BLOCK" },
        ],
      };
  }
}
