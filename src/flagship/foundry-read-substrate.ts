import type { BusinessWorkspaceResult } from "./business-workspace";
import {
  readCustomersAtRisk,
  readCustomersByPlan,
  readDepartmentHeadcount,
  readDirectReports,
  readEmployeesByDivision,
  readEmployeesByLocation,
  readEmployeesByRole,
  readEmployeesOnLeave,
  readSupportTicketsByOwner,
  readWorkOrdersByOwner,
} from "./business-workspace";

/**
 * The approved local data seam for the absorbed Foundry READ capabilities.
 * Returning undefined lets the host continue to its other explicitly wired
 * substrates; it never invents a result for an unknown tool.
 */
export function readAbsorbedFoundryTool(name: string, input: Readonly<Record<string, unknown>>): BusinessWorkspaceResult | undefined {
  const value = (key: string) => typeof input[key] === "string" ? input[key].trim() : "";
  switch (name) {
    case "find_employees_by_role": return readEmployeesByRole(value("role"));
    case "get_division_roster": return readEmployeesByDivision(value("division"));
    case "get_department_headcount": return readDepartmentHeadcount(value("department"));
    case "get_employees_by_location": return readEmployeesByLocation(value("location"));
    case "get_employees_on_leave": return readEmployeesOnLeave();
    case "get_direct_reports": return readDirectReports(value("manager"));
    case "get_customers_at_risk": return readCustomersAtRisk();
    case "get_customers_by_plan": return readCustomersByPlan(value("plan"));
    case "get_work_orders_by_owner": return readWorkOrdersByOwner(value("owner"));
    case "get_support_tickets_by_owner": return readSupportTicketsByOwner(value("owner"));
    default: return undefined;
  }
}
