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
  { id: "get_customer_support_queue", title: "Customer-support queue", kind: "READ", description: "Open cases, severity, ownership, and next review state.", substrate: "Public-safe business workspace", fields: [], buildIntent: staticRecipe("Build a WebMCP tool for the customer support queue") },
  { id: "get_customer_health_summary", title: "Customer account health", kind: "READ", description: "Plan, engagement, open work, and a stated next action.", substrate: "Public-safe business workspace", fields: [], buildIntent: staticRecipe("Build a WebMCP tool for customer account health") },
  { id: "get_business_operations_report", title: "Weekly operations report", kind: "READ", description: "Support, field operations, at-risk accounts, and campaign readiness.", substrate: "Public-safe business workspace", fields: [], buildIntent: staticRecipe("Build a WebMCP tool for a weekly business operations report") },
  { id: "get_campaign_dashboard", title: "Promotion campaign dashboard", kind: "READ", description: "Eligible audience, prepared drafts, and delivery state.", substrate: "Public-safe business workspace", fields: [], buildIntent: staticRecipe("Build a WebMCP tool for the promotion campaign dashboard") },
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
]);

/** Profile-driven ordering is recommendation only; it does not approve a tool. */
export function rankFoundryCatalog(entries: readonly FoundryCatalogEntry[], profile: FoundryProfile): FoundryCatalogEntry[] {
  const campaignIds = new Set(["prepare_weekly_promotional_email_campaign", "get_campaign_dashboard"]);
  const customerIds = new Set(["get_customer_support_queue", "get_work_order_queue", "get_customer_health_summary", "get_business_operations_report"]);
  const preferred = profile.focus === "CAMPAIGN_OPERATIONS" ? campaignIds : customerIds;
  return [...entries].sort((a, b) => Number(preferred.has(b.id)) - Number(preferred.has(a.id)) || a.title.localeCompare(b.title));
}
