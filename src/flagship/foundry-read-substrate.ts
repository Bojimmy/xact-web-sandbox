import type { BusinessWorkspaceResult } from "./business-workspace";
import {
  readCurrentOperationsSnapshot,
  readOperationsExceptionBrief,
  readOwnerWorkload,
  readCustomer360ByEmail,
  readCustomersWaitingLongest,
  readCustomersAtRisk,
  readCustomersByPlan,
  readDepartmentHeadcount,
  readDirectReports,
  readEmployeesByDivision,
  readEmployeesByLocation,
  readEmployeesByRole,
  readEmployeesOnLeave,
  readMarketingPerformance,
  readSalesPipeline,
  readSalesLeaderboard,
  readSupportTicketsByOwner,
  readSupportQueue,
  readEscalatedSupportReview,
  readSupportEscalationEvidence,
  readServiceCreditOpportunities,
  readCustomerPlanChangeHistory,
  readWorkOrderQueue,
  readUrgentWorkOrderTriage,
  readWorkOrdersWithUnavailableOwners,
  readWorkOrdersByOwner,
  readCampaignDashboard,
  readCustomerHealth,
  readEmployeeDirectory,
  readOperationsReport,
} from "./business-workspace";

/**
 * The approved local data seam for the absorbed Foundry READ capabilities.
 * Returning undefined lets the host continue to its other explicitly wired
 * substrates; it never invents a result for an unknown tool.
 */
export function readAbsorbedFoundryTool(name: string, input: Readonly<Record<string, unknown>>): BusinessWorkspaceResult | undefined {
  const value = (key: string) => typeof input[key] === "string" ? input[key].trim() : "";
  switch (name) {
    case "get_work_order_queue": return readWorkOrderQueue();
    case "get_urgent_work_order_triage": return readUrgentWorkOrderTriage();
    case "get_work_orders_owner_unavailable": return readWorkOrdersWithUnavailableOwners();
    case "get_customer_support_queue": return readSupportQueue();
    case "get_escalated_support_case_review": return readEscalatedSupportReview();
    case "get_support_escalation_evidence": return readSupportEscalationEvidence();
    case "get_service_credit_opportunities": return readServiceCreditOpportunities();
    case "get_customer_plan_change_history": return readCustomerPlanChangeHistory(value("email"));
    case "get_owner_workload": return readOwnerWorkload();
    case "get_customer_360": return readCustomer360ByEmail(value("email"));
    case "get_operations_exception_brief": return readOperationsExceptionBrief();
    case "composed_read_customer_request": return readCustomersWaitingLongest();
    case "get_current_operations_snapshot": return readCurrentOperationsSnapshot();
    case "get_employee_directory": return readEmployeeDirectory();
    case "get_customer_health_summary": return readCustomerHealth(value("customerId"));
    case "get_business_operations_report": return readOperationsReport();
    case "get_campaign_dashboard": return readCampaignDashboard();
    case "get_sales_pipeline_forecast": return readSalesPipeline();
    case "get_sales_leaderboard": return readSalesLeaderboard();
    case "get_marketing_performance": return readMarketingPerformance();
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
