import type { FoundryProfile } from "./foundry-profile";

/** Approved, public Foundry recipes. A recipe is not a built tool. */
export interface FoundryCatalogField {
  readonly key: string;
  readonly label: string;
  readonly hint: string;
  readonly defaultValue: string;
  readonly type?: "number" | "text";
}

export interface FoundryCatalogEntry {
  readonly id: string;
  readonly title: string;
  readonly kind: "READ" | "DRAFT_ONLY" | "MUTATION";
  readonly description: string;
  readonly substrate: string;
  readonly fields: readonly FoundryCatalogField[];
  readonly buildIntent: (values: Readonly<Record<string, string>>) => string;
}

const staticRecipe = (intent: string) => () => intent;

export const FOUNDRY_CATALOG: readonly FoundryCatalogEntry[] = Object.freeze([
  { id: "read_active_users_and_open_requests", title: "Operations snapshot", kind: "READ", description: "Active users and open support requests.", substrate: "Foundry customer directory", fields: [], buildIntent: staticRecipe("Build a WebMCP tool that shows active users and open support requests") },
  { id: "get_work_order_queue", title: "Field work-order queue", kind: "READ", description: "Priorities, owners, statuses, and due times for field work.", substrate: "Public-safe business workspace", fields: [], buildIntent: staticRecipe("Build a WebMCP tool to read the field work-order queue") },
  { id: "get_employee_directory", title: "Employee organization directory", kind: "READ", description: "100 fictional employees across executive, product, engineering, revenue, and operations divisions.", substrate: "Public-safe employee workspace", fields: [], buildIntent: staticRecipe("Build a WebMCP tool to read the employee organization directory and division headcount") },
  { id: "get_customer_support_queue", title: "Customer-support queue", kind: "READ", description: "Open cases, severity, ownership, and next review state.", substrate: "Public-safe business workspace", fields: [], buildIntent: staticRecipe("Build a WebMCP tool for the customer support queue") },
  { id: "get_customer_health_summary", title: "Customer account health", kind: "READ", description: "Plan, engagement, open work, and a stated next action.", substrate: "Public-safe business workspace", fields: [], buildIntent: staticRecipe("Build a WebMCP tool for customer account health") },
  { id: "get_business_operations_report", title: "Weekly operations report", kind: "READ", description: "Support, field operations, at-risk accounts, and campaign readiness.", substrate: "Public-safe business workspace", fields: [], buildIntent: staticRecipe("Build a WebMCP tool for a weekly business operations report") },
  { id: "get_campaign_dashboard", title: "Promotion campaign dashboard", kind: "READ", description: "Eligible audience, prepared drafts, and delivery state.", substrate: "Public-safe business workspace", fields: [], buildIntent: staticRecipe("Build a WebMCP tool for the promotion campaign dashboard") },
  { id: "get_sales_pipeline_forecast", title: "Sales pipeline & forecast", kind: "READ", description: "Open opportunities, weighted forecast, close windows, and owner coverage.", substrate: "Public-safe sales workspace", fields: [], buildIntent: staticRecipe("Build a WebMCP tool for the sales pipeline and forecast") },
  { id: "get_marketing_performance", title: "Marketing performance dashboard", kind: "READ", description: "Campaign reach, engagement, and delivery state without a provider connection.", substrate: "Public-safe marketing workspace", fields: [], buildIntent: staticRecipe("Build a WebMCP tool for marketing performance") },
  { id: "prepare_weekly_promotional_email_campaign", title: "Weekly promotional email drafts", kind: "DRAFT_ONLY", description: "Prepare personalized promotional drafts; it never sends email.", substrate: "Foundry mock customer directory", fields: [], buildIntent: staticRecipe("Build a weekly promotional email campaign with personalized drafts") },
  { id: "find_customer_by_email", title: "Customer lookup", kind: "READ", description: "Find a customer record by email on the approved directory.", substrate: "Foundry customer directory", fields: [], buildIntent: staticRecipe("Build a WebMCP tool to find customers by email") },
  { id: "get_audit_history", title: "Customer audit history", kind: "READ", description: "Read public-safe recorded customer service history.", substrate: "Foundry audit workspace", fields: [], buildIntent: staticRecipe("Build a WebMCP tool to read customer audit history") },
  { id: "issue_service_credit", title: "Bounded service credit", kind: "MUTATION", description: "Propose a support credit; every use later requires a fresh Xact Commit.", substrate: "Commit-gated service recovery", fields: [
    { key: "actor", label: "Actor role", hint: "Who may invoke it?", defaultValue: "support agent" },
    { key: "amount", label: "Maximum credit", hint: "The policy ceiling in dollars.", defaultValue: "25", type: "number" },
  ], buildIntent: (values) => `Build a WebMCP tool that lets ${values.actor} issue a service credit up to $${values.amount}` },
  { id: "refund_delivery_fee", title: "Bounded delivery-fee refund", kind: "MUTATION", description: "Propose a delivery-fee refund; every use later requires a fresh Xact Commit.", substrate: "Commit-gated service recovery", fields: [
    { key: "actor", label: "Actor role", hint: "Who may invoke it?", defaultValue: "support agent" },
    { key: "amount", label: "Maximum refund", hint: "The policy ceiling in dollars.", defaultValue: "15", type: "number" },
  ], buildIntent: (values) => `Build a WebMCP tool that lets ${values.actor} refund a delivery fee up to $${values.amount}` },
  { id: "change_service_plan", title: "Customer plan change", kind: "MUTATION", description: "Propose a plan-change capability; every use later requires a fresh Xact Commit.", substrate: "Commit-gated account workspace", fields: [
    { key: "actor", label: "Actor role", hint: "Who may invoke it?", defaultValue: "support agent" },
  ], buildIntent: (values) => `Build a WebMCP tool that lets ${values.actor} change a customer service plan` },
  { id: "find_employees_by_role", title: "Find employees by role", kind: "READ", description: "Filter the 100-person directory by role or title.", substrate: "Public-safe employee workspace", fields: [{ key: "role", label: "Role", hint: "e.g. Account Executive", defaultValue: "Account Executive" }], buildIntent: (values) => `Build a WebMCP tool to find employees by role ${values.role}` },
  { id: "get_division_roster", title: "Division roster", kind: "READ", description: "Read a division's roster from the 100-person directory.", substrate: "Public-safe employee workspace", fields: [{ key: "division", label: "Division", hint: "e.g. Engineering", defaultValue: "Engineering" }], buildIntent: (values) => `Build a WebMCP tool to read a division roster for ${values.division}` },
  { id: "get_department_headcount", title: "Department headcount", kind: "READ", description: "Read headcount for a department.", substrate: "Public-safe employee workspace", fields: [{ key: "department", label: "Department", hint: "e.g. Engineering", defaultValue: "Engineering" }], buildIntent: (values) => `Build a WebMCP tool to read department headcount for ${values.department}` },
  { id: "get_employees_by_location", title: "Employees by location", kind: "READ", description: "Filter the directory by office or remote location.", substrate: "Public-safe employee workspace", fields: [{ key: "location", label: "Location", hint: "e.g. Austin, TX", defaultValue: "Austin, TX" }], buildIntent: (values) => `Build a WebMCP tool to read employees by location ${values.location}` },
  { id: "get_employees_on_leave", title: "Employees on leave", kind: "READ", description: "Read the current on-leave roster.", substrate: "Public-safe employee workspace", fields: [], buildIntent: staticRecipe("Build a WebMCP tool to read employees on leave") },
  { id: "get_direct_reports", title: "Direct reports", kind: "READ", description: "Read the direct reports of a manager.", substrate: "Public-safe employee workspace", fields: [{ key: "manager", label: "Manager", hint: "e.g. Jordan Kim", defaultValue: "Jordan Kim" }], buildIntent: (values) => `Build a WebMCP tool to read direct reports for ${values.manager}` },
  { id: "get_customers_at_risk", title: "At-risk customers", kind: "READ", description: "Read customer accounts marked at risk.", substrate: "Public-safe business workspace", fields: [], buildIntent: staticRecipe("Build a WebMCP tool to read at-risk customers") },
  { id: "get_customers_by_plan", title: "Customers by plan", kind: "READ", description: "Filter customer accounts by service plan.", substrate: "Public-safe business workspace", fields: [{ key: "plan", label: "Plan", hint: "e.g. Growth", defaultValue: "Growth" }], buildIntent: (values) => `Build a WebMCP tool to read customers by plan ${values.plan}` },
  { id: "get_work_orders_by_owner", title: "Work orders by owner", kind: "READ", description: "Read field work orders assigned to an owner.", substrate: "Public-safe business workspace", fields: [{ key: "owner", label: "Owner", hint: "e.g. M. Rivera", defaultValue: "M. Rivera" }], buildIntent: (values) => `Build a WebMCP tool to read work orders by owner ${values.owner}` },
  { id: "get_support_tickets_by_owner", title: "Support tickets by owner", kind: "READ", description: "Read support tickets assigned to a division owner.", substrate: "Public-safe business workspace", fields: [{ key: "owner", label: "Owner", hint: "e.g. BILLING", defaultValue: "BILLING" }], buildIntent: (values) => `Build a WebMCP tool to read support tickets by owner ${values.owner}` },
  { id: "reassign_support_ticket", title: "Reassign support ticket", kind: "MUTATION", description: "Propose a ticket reassignment; every use later requires a fresh Xact Commit.", substrate: "Commit-gated support workspace", fields: [], buildIntent: staticRecipe("Build a WebMCP tool that lets service recovery reassign a support ticket") },
  { id: "reassign_work_order", title: "Reassign work order", kind: "MUTATION", description: "Propose a work-order reassignment; every use later requires a fresh Xact Commit.", substrate: "Commit-gated dispatch workspace", fields: [], buildIntent: staticRecipe("Build a WebMCP tool that lets field ops reassign a work order") },
  { id: "escalate_support_ticket", title: "Escalate support ticket", kind: "MUTATION", description: "Propose a ticket escalation; every use later requires a fresh Xact Commit.", substrate: "Commit-gated support workspace", fields: [], buildIntent: staticRecipe("Build a WebMCP tool that lets service recovery escalate a support ticket") },
  { id: "set_customer_next_action", title: "Set customer next action", kind: "MUTATION", description: "Propose a next-action update; every use later requires a fresh Xact Commit.", substrate: "Commit-gated account workspace", fields: [], buildIntent: staticRecipe("Build a WebMCP tool that lets customer success set a customer next action") },
  { id: "update_employee_status", title: "Update employee status", kind: "MUTATION", description: "Propose an employee status change; every use later requires a fresh Xact Commit.", substrate: "Commit-gated people workspace", fields: [], buildIntent: staticRecipe("Build a WebMCP tool that lets people ops update an employee status") },
]);

/** Profile-driven ordering is recommendation only; it does not approve a tool. */
export function rankFoundryCatalog(entries: readonly FoundryCatalogEntry[], profile: FoundryProfile): FoundryCatalogEntry[] {
  const campaignIds = new Set(["prepare_weekly_promotional_email_campaign", "get_campaign_dashboard"]);
  const customerIds = new Set(["get_customer_support_queue", "get_work_order_queue", "get_customer_health_summary", "get_business_operations_report"]);
  const preferred = profile.focus === "CAMPAIGN_OPERATIONS" ? campaignIds : customerIds;
  return [...entries].sort((a, b) => Number(preferred.has(b.id)) - Number(preferred.has(a.id)) || a.title.localeCompare(b.title));
}
