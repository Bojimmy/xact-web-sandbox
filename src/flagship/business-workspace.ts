/**
 * Public-safe business workspace substrate for the Foundry demo.
 *
 * These are deliberately local, deterministic records. They give constructed
 * READ tools useful, task-shaped results without claiming access to a CRM,
 * ticketing system, dispatch platform, or campaign provider.
 */

export interface BusinessWorkspaceResult {
  readonly kind: "WORK_ORDER_QUEUE" | "SUPPORT_QUEUE" | "CUSTOMER_HEALTH" | "OPERATIONS_REPORT" | "CAMPAIGN_DASHBOARD" | "SALES_PIPELINE" | "MARKETING_PERFORMANCE" | "EMPLOYEE_DIRECTORY";
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

const salesPipeline = Object.freeze([
  { opportunity: "Northstar expansion", account: "Northstar Cafe", owner: "Casey Bennett", stage: "PROPOSAL", value: "$42,000", closeWindow: "September", confidence: "70%" },
  { opportunity: "Lovelace renewal", account: "Lovelace Labs", owner: "Morgan Ellis", stage: "NEGOTIATION", value: "$28,000", closeWindow: "September", confidence: "85%" },
  { opportunity: "Harbor rollout", account: "Harbor Studio", owner: "Parker Diaz", stage: "QUALIFIED", value: "$16,500", closeWindow: "October", confidence: "50%" },
  { opportunity: "Chen service bundle", account: "Chen & Co.", owner: "Taylor Foster", stage: "DISCOVERY", value: "$9,800", closeWindow: "October", confidence: "30%" },
]);

const marketingPerformance = Object.freeze([
  { campaign: "Weekly active-customer promotion", channel: "Email", audience: "128", engagement: "42% opens", conversion: "—", status: "DRAFT ONLY" },
  { campaign: "Field-service follow-up", channel: "Lifecycle email", audience: "46", engagement: "31% opens", conversion: "—", status: "DRAFT ONLY" },
  { campaign: "Q4 operations webinar", channel: "Landing page", audience: "310", engagement: "76 registrations", conversion: "—", status: "PUBLIC-SAFE DEMO" },
]);

/**
 * A fictional, public-safe 100-person company directory. It is deliberately
 * local demo data: the Foundry does not claim an HRIS, payroll, or time-clock
 * connection merely because it can read this workspace.
 */
export interface EmployeeRecord extends Readonly<Record<string, string>> {
  readonly employeeId: string;
  readonly name: string;
  readonly division: string;
  readonly department: string;
  readonly title: string;
  readonly manager: string;
  readonly location: string;
  readonly status: "ACTIVE" | "ON LEAVE";
}

type DivisionPlan = {
  readonly division: string;
  readonly department: string;
  readonly leader: { name: string; title: string };
  readonly headcount: number;
  readonly roles: readonly string[];
};

const FIRST_NAMES = ["Avery", "Cameron", "Devon", "Emerson", "Finley", "Harper", "Jamie", "Kai", "Logan", "Morgan", "Noel", "Parker", "Quinn", "Reese", "Sage", "Taylor", "Wren", "Casey", "Rowan", "Skyler"] as const;
const LAST_NAMES = ["Bennett", "Carter", "Diaz", "Ellis", "Foster"] as const;
const LOCATIONS = ["New York, NY", "Austin, TX", "Chicago, IL", "Remote — US"] as const;

const DIVISION_PLANS: readonly DivisionPlan[] = [
  { division: "Finance", department: "Finance & Legal", leader: { name: "Morgan Hale", title: "Chief Financial Officer" }, headcount: 10, roles: ["Finance Director", "Senior Accountant", "Financial Analyst", "Accounts Payable Specialist", "Revenue Operations Analyst"] },
  { division: "People", department: "People Operations", leader: { name: "Riley Brooks", title: "Chief People Officer" }, headcount: 8, roles: ["People Operations Manager", "Talent Partner", "People Systems Analyst", "Learning & Development Specialist"] },
  { division: "Product", department: "Product & Design", leader: { name: "Ari Monroe", title: "Chief Product Officer" }, headcount: 12, roles: ["Product Director", "Product Manager", "Product Designer", "User Researcher", "Product Operations Specialist"] },
  { division: "Engineering", department: "Engineering", leader: { name: "Jordan Kim", title: "Chief Technology Officer" }, headcount: 24, roles: ["Engineering Director", "Staff Software Engineer", "Software Engineer", "Quality Engineer", "Site Reliability Engineer", "Data Engineer"] },
  { division: "Sales", department: "Revenue", leader: { name: "Blake Turner", title: "Chief Revenue Officer" }, headcount: 16, roles: ["Sales Director", "Account Executive", "Sales Development Representative", "Sales Operations Analyst", "Solutions Consultant"] },
  { division: "Marketing", department: "Marketing", leader: { name: "Drew Lawson", title: "Vice President, Marketing" }, headcount: 10, roles: ["Marketing Director", "Lifecycle Marketing Manager", "Content Strategist", "Demand Generation Manager", "Marketing Operations Analyst"] },
  { division: "Customer Success", department: "Customer Experience", leader: { name: "Samira Patel", title: "Vice President, Customer Success" }, headcount: 10, roles: ["Customer Success Director", "Customer Success Manager", "Implementation Specialist", "Support Operations Analyst", "Technical Support Specialist"] },
  { division: "Operations", department: "Business Operations", leader: { name: "Alex Rivera", title: "Vice President, Operations" }, headcount: 9, roles: ["Operations Director", "Field Operations Manager", "Workforce Coordinator", "Business Systems Analyst", "Procurement Specialist"] },
] as const;

function generatedName(index: number): string {
  return `${FIRST_NAMES[index % FIRST_NAMES.length]} ${LAST_NAMES[Math.floor(index / FIRST_NAMES.length) % LAST_NAMES.length]}`;
}

const employeeDirectory: readonly EmployeeRecord[] = (() => {
  const records: EmployeeRecord[] = [{
    employeeId: "EMP-001",
    name: "Jordan Bennett",
    division: "Executive",
    department: "Executive Office",
    title: "Chief Executive Officer",
    manager: "Board of Directors",
    location: "New York, NY",
    status: "ACTIVE",
  }];
  let generatedIndex = 0;

  for (const plan of DIVISION_PLANS) {
    records.push({
      employeeId: `EMP-${String(records.length + 1).padStart(3, "0")}`,
      name: plan.leader.name,
      division: plan.division,
      department: plan.department,
      title: plan.leader.title,
      manager: "Jordan Bennett",
      location: LOCATIONS[records.length % LOCATIONS.length],
      status: "ACTIVE",
    });
    for (let member = 1; member < plan.headcount; member += 1) {
      const number = records.length + 1;
      records.push({
        employeeId: `EMP-${String(number).padStart(3, "0")}`,
        name: generatedName(generatedIndex++),
        division: plan.division,
        department: plan.department,
        title: plan.roles[(member - 1) % plan.roles.length],
        manager: plan.leader.name,
        location: LOCATIONS[number % LOCATIONS.length],
        status: number === 18 || number === 63 || number === 91 ? "ON LEAVE" : "ACTIVE",
      });
    }
  }
  return Object.freeze(records);
})();

export function readEmployeeDirectory(): BusinessWorkspaceResult {
  const active = employeeDirectory.filter((employee) => employee.status === "ACTIVE").length;
  const divisions = new Set(employeeDirectory.map((employee) => employee.division)).size;
  const isLeader = (employee: EmployeeRecord) => employee.manager === "Jordan Bennett" || employee.title === "Chief Executive Officer";
  const leadership = employeeDirectory.filter(isLeader);
  // This is a display projection only: it makes the CEO and every division
  // head visible before the individual contributors without changing the
  // public-safe source directory or any governed contract.
  const rows = [...leadership, ...employeeDirectory.filter((employee) => !isLeader(employee))];
  return {
    kind: "EMPLOYEE_DIRECTORY",
    title: "Employee organization directory",
    source,
    summary: [
      { label: "Employees", value: String(employeeDirectory.length), detail: "fictional public-safe demo directory" },
      { label: "Divisions", value: String(divisions), detail: "executive through operating teams" },
      { label: "Company leaders", value: String(leadership.length), detail: "CEO plus one head for each division" },
      { label: "Active", value: String(active), detail: "current mock workforce state" },
      { label: "On leave", value: String(employeeDirectory.length - active), detail: "not a payroll or timekeeping record" },
    ],
    columns: ["employeeId", "name", "division", "department", "title", "manager", "location", "status"],
    rows,
  };
}

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

export function readSalesPipeline(): BusinessWorkspaceResult {
  return {
    kind: "SALES_PIPELINE",
    title: "Sales pipeline and forecast",
    source,
    summary: [
      { label: "Open pipeline", value: "$96,300", detail: "four fictional public-safe opportunities" },
      { label: "Weighted forecast", value: "$55,710", detail: "deterministic demo calculation" },
      { label: "Closing this month", value: "2", detail: "no CRM connection or forecast authority" },
    ],
    columns: ["opportunity", "account", "owner", "stage", "value", "closeWindow", "confidence"],
    rows: salesPipeline,
  };
}

export function readMarketingPerformance(): BusinessWorkspaceResult {
  return {
    kind: "MARKETING_PERFORMANCE",
    title: "Marketing performance dashboard",
    source,
    summary: [
      { label: "Campaigns", value: String(marketingPerformance.length), detail: "fictional public-safe campaign workspace" },
      { label: "Reach", value: "484", detail: "demo audience counts only" },
      { label: "Delivery", value: "0", detail: "no connected marketing provider or send Commit" },
    ],
    columns: ["campaign", "channel", "audience", "engagement", "conversion", "status"],
    rows: marketingPerformance,
  };
}

// ---------------------------------------------------------------------------
// Deterministic absorbable filters (zero-reasoning READ substrates).
//
// These are derived from the same public-safe local records above; they claim
// no HRIS/CRM/ticketing/dispatch connection beyond the Foundry workspace.
// ---------------------------------------------------------------------------

const employeeColumns = ["employeeId", "name", "division", "department", "title", "manager", "location", "status"] as const;

export function readEmployeesByRole(role: string): BusinessWorkspaceResult {
  const needle = role.trim().toLowerCase();
  const rows = employeeDirectory.filter((employee) => employee.title.toLowerCase().includes(needle));
  return {
    kind: "EMPLOYEE_DIRECTORY",
    title: `Employees by role: ${role}`,
    source,
    summary: [{ label: "Matches", value: String(rows.length), detail: "title match on the public-safe directory" }],
    columns: [...employeeColumns],
    rows,
  };
}

export function readEmployeesByDivision(division: string): BusinessWorkspaceResult {
  const needle = division.trim().toLowerCase();
  const rows = employeeDirectory.filter((employee) => employee.division.toLowerCase().includes(needle));
  return {
    kind: "EMPLOYEE_DIRECTORY",
    title: `Division roster: ${division}`,
    source,
    summary: [{ label: "Members", value: String(rows.length), detail: "division match on the public-safe directory" }],
    columns: [...employeeColumns],
    rows,
  };
}

export function readDepartmentHeadcount(department: string): BusinessWorkspaceResult {
  const needle = department.trim().toLowerCase();
  const rows = employeeDirectory.filter((employee) => employee.department.toLowerCase().includes(needle));
  return {
    kind: "EMPLOYEE_DIRECTORY",
    title: `Department headcount: ${department}`,
    source,
    summary: [{ label: "Headcount", value: String(rows.length), detail: "department match on the public-safe directory" }],
    columns: ["department", "division", "name", "title"],
    rows: rows.map((employee) => ({ department: employee.department, division: employee.division, name: employee.name, title: employee.title })),
  };
}

export function readEmployeesByLocation(location: string): BusinessWorkspaceResult {
  const needle = location.trim().toLowerCase();
  const rows = employeeDirectory.filter((employee) => employee.location.toLowerCase().includes(needle));
  return {
    kind: "EMPLOYEE_DIRECTORY",
    title: `Employees by location: ${location}`,
    source,
    summary: [{ label: "Located", value: String(rows.length), detail: "location match on the public-safe directory" }],
    columns: [...employeeColumns],
    rows,
  };
}

export function readEmployeesOnLeave(): BusinessWorkspaceResult {
  const rows = employeeDirectory.filter((employee) => employee.status === "ON LEAVE");
  return {
    kind: "EMPLOYEE_DIRECTORY",
    title: "Employees on leave",
    source,
    summary: [{ label: "On leave", value: String(rows.length), detail: "status match on the public-safe directory" }],
    columns: [...employeeColumns],
    rows,
  };
}

export function readDirectReports(manager: string): BusinessWorkspaceResult {
  const needle = manager.trim().toLowerCase();
  const rows = employeeDirectory.filter((employee) => employee.manager.toLowerCase().includes(needle));
  return {
    kind: "EMPLOYEE_DIRECTORY",
    title: `Direct reports: ${manager}`,
    source,
    summary: [{ label: "Reports", value: String(rows.length), detail: "manager match on the public-safe directory" }],
    columns: [...employeeColumns],
    rows,
  };
}

export function readCustomersAtRisk(): BusinessWorkspaceResult {
  const rows = customerHealth.filter((customer) => customer.health === "AT RISK");
  return {
    kind: "CUSTOMER_HEALTH",
    title: "At-risk customers",
    source,
    summary: [{ label: "At risk", value: String(rows.length), detail: "health match on the public-safe customer workspace" }],
    columns: ["customerId", "customer", "plan", "health", "openWork", "engagement", "nextAction"],
    rows,
  };
}

export function readCustomersByPlan(plan: string): BusinessWorkspaceResult {
  const needle = plan.trim().toLowerCase();
  const rows = customerHealth.filter((customer) => customer.plan.toLowerCase().includes(needle));
  return {
    kind: "CUSTOMER_HEALTH",
    title: `Customers by plan: ${plan}`,
    source,
    summary: [{ label: "Customers", value: String(rows.length), detail: "plan match on the public-safe customer workspace" }],
    columns: ["customerId", "customer", "plan", "health", "openWork", "engagement", "nextAction"],
    rows,
  };
}

export function readWorkOrdersByOwner(owner: string): BusinessWorkspaceResult {
  const needle = owner.trim().toLowerCase();
  const rows = workOrders.filter((order) => order.owner.toLowerCase().includes(needle));
  return {
    kind: "WORK_ORDER_QUEUE",
    title: `Work orders by owner: ${owner}`,
    source,
    summary: [{ label: "Assigned", value: String(rows.length), detail: "owner match on the public-safe dispatch queue" }],
    columns: ["id", "customer", "task", "priority", "owner", "status", "due"],
    rows,
  };
}

export function readSupportTicketsByOwner(owner: string): BusinessWorkspaceResult {
  const needle = owner.trim().toLowerCase();
  const rows = supportTickets.filter((ticket) => ticket.owner.toLowerCase().includes(needle));
  return {
    kind: "SUPPORT_QUEUE",
    title: `Support tickets by owner: ${owner}`,
    source,
    summary: [{ label: "Owned", value: String(rows.length), detail: "owner match on the public-safe support queue" }],
    columns: ["id", "customer", "issue", "severity", "owner", "status", "age"],
    rows,
  };
}
