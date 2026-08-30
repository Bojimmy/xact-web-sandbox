/**
 * Public-safe business workspace substrate for the Foundry demo.
 *
 * These are deliberately local, deterministic records. They give constructed
 * READ tools useful, task-shaped results without claiming access to a CRM,
 * ticketing system, dispatch platform, or campaign provider.
 */

export interface BusinessWorkspaceResult {
  readonly kind: "WORK_ORDER_QUEUE" | "SUPPORT_QUEUE" | "CUSTOMER_HEALTH" | "OPERATIONS_REPORT" | "CAMPAIGN_DASHBOARD";
  readonly title: string;
  readonly source: "FOUNDRY_PUBLIC_SAFE_BUSINESS_WORKSPACE";
  readonly summary: readonly { label: string; value: string; detail: string }[];
  readonly columns: readonly string[];
  readonly rows: readonly Readonly<Record<string, string>>[];
}

const source = "FOUNDRY_PUBLIC_SAFE_BUSINESS_WORKSPACE" as const;

const workOrders = Object.freeze([
  { id: "WO-2841", customer: "Northstar Cafe", task: "Inspect refrigeration alarm", priority: "URGENT", owner: "M. Rivera", status: "IN PROGRESS", due: "Today · 14:00" },
  { id: "WO-2838", customer: "Lovelace Labs", task: "Replace access reader", priority: "HIGH", owner: "J. Patel", status: "DISPATCHED", due: "Today · 16:30" },
  { id: "WO-2835", customer: "Chen & Co.", task: "Quarterly equipment review", priority: "NORMAL", owner: "A. Moss", status: "SCHEDULED", due: "Tomorrow · 09:00" },
  { id: "WO-2829", customer: "Harbor Studio", task: "Verify network handoff", priority: "NORMAL", owner: "L. Okafor", status: "AWAITING CUSTOMER", due: "Tomorrow · 13:00" },
]);

const supportTickets = Object.freeze([
  { id: "SUP-918", customer: "Ada Lovelace", issue: "Delivery arrived late", severity: "HIGH", owner: "SERVICE RECOVERY", status: "READY FOR REVIEW", age: "42m" },
  { id: "SUP-917", customer: "Lin Chen", issue: "Plan invoice question", severity: "NORMAL", owner: "BILLING", status: "OPEN", age: "1h 18m" },
  { id: "SUP-914", customer: "Northstar Cafe", issue: "Access reader intermittently offline", severity: "URGENT", owner: "FIELD OPS", status: "ESCALATED", age: "2h 04m" },
  { id: "SUP-909", customer: "Harbor Studio", issue: "Requesting campaign preview", severity: "LOW", owner: "CAMPAIGNS", status: "WAITING ON CUSTOMER", age: "4h 11m" },
]);

const customerHealth = Object.freeze([
  { customerId: "1042", customer: "Ada Lovelace", plan: "Growth", health: "STABLE", openWork: "1 support case", engagement: "Weekly active", nextAction: "Review late-delivery resolution" },
  { customerId: "8821", customer: "Lin Chen", plan: "Starter", health: "WATCH", openWork: "1 billing question", engagement: "Monthly active", nextAction: "Send plan comparison draft" },
  { customerId: "7710", customer: "Northstar Cafe", plan: "Operations", health: "AT RISK", openWork: "1 urgent work order", engagement: "Daily active", nextAction: "Confirm field dispatch completion" },
]);

export function readWorkOrderQueue(): BusinessWorkspaceResult {
  return {
    kind: "WORK_ORDER_QUEUE",
    title: "Field work orders",
    source,
    summary: [
      { label: "Open work orders", value: "4", detail: "public-safe demo queue" },
      { label: "Urgent", value: "1", detail: "requires human field review" },
      { label: "Assigned", value: "3", detail: "dispatch records present" },
    ],
    columns: ["id", "customer", "task", "priority", "owner", "status", "due"],
    rows: workOrders,
  };
}

export function readSupportQueue(): BusinessWorkspaceResult {
  return {
    kind: "SUPPORT_QUEUE",
    title: "Customer support queue",
    source,
    summary: [
      { label: "Open cases", value: "4", detail: "public-safe demo queue" },
      { label: "Escalated", value: "1", detail: "field operations owns next action" },
      { label: "Ready for review", value: "1", detail: "no automatic consequence" },
    ],
    columns: ["id", "customer", "issue", "severity", "owner", "status", "age"],
    rows: supportTickets,
  };
}

export function readCustomerHealth(customerId: string): BusinessWorkspaceResult {
  const record = customerHealth.find((customer) => customer.customerId === customerId) ?? {
    customerId,
    customer: "No public-safe customer record",
    plan: "—",
    health: "UNKNOWN",
    openWork: "—",
    engagement: "—",
    nextAction: "No action proposed",
  };
  return {
    kind: "CUSTOMER_HEALTH",
    title: "Customer health summary",
    source,
    summary: [
      { label: "Customer", value: record.customer, detail: `ID ${record.customerId}` },
      { label: "Health", value: record.health, detail: "descriptive demo state" },
      { label: "Open work", value: record.openWork, detail: "not an authorization" },
    ],
    columns: ["customerId", "customer", "plan", "health", "openWork", "engagement", "nextAction"],
    rows: [record],
  };
}

export function readOperationsReport(): BusinessWorkspaceResult {
  return {
    kind: "OPERATIONS_REPORT",
    title: "Weekly business operations report",
    source,
    summary: [
      { label: "Active customers", value: "128", detail: "approved mock directory" },
      { label: "Support SLA", value: "94%", detail: "public-safe demo measurement" },
      { label: "Work orders on time", value: "87%", detail: "public-safe demo measurement" },
      { label: "Campaign drafts", value: "128", detail: "prepared, not sent" },
    ],
    columns: ["area", "metric", "current", "trend", "nextAction"],
    rows: [
      { area: "Support", metric: "First response", current: "18m", trend: "Improving", nextAction: "Review two aging cases" },
      { area: "Field ops", metric: "On-time completion", current: "87%", trend: "Stable", nextAction: "Protect urgent dispatch capacity" },
      { area: "Customer", metric: "At-risk accounts", current: "3", trend: "Watch", nextAction: "Prepare account-health reviews" },
      { area: "Campaigns", metric: "Draft-ready audience", current: "128", trend: "Ready", nextAction: "Request separate delivery authorization" },
    ],
  };
}

export function readCampaignDashboard(): BusinessWorkspaceResult {
  return {
    kind: "CAMPAIGN_DASHBOARD",
    title: "Promotion campaign dashboard",
    source,
    summary: [
      { label: "Audience eligible", value: "128", detail: "public-safe mock audience" },
      { label: "Drafts prepared", value: "128", detail: "personalized, not sent" },
      { label: "Delivery receipts", value: "0", detail: "no delivery connection or Commit" },
    ],
    columns: ["campaign", "audience", "drafts", "delivery", "nextAction"],
    rows: [{ campaign: "Weekly active-customer promotion", audience: "128", drafts: "128", delivery: "NOT CONNECTED", nextAction: "Review drafts or request delivery governance" }],
  };
}
