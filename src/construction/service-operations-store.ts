import type { ServiceAuditEvent, ServiceCustomer } from "./contracts";

/**
 * Deterministic read model for the constructed Service Operations Console.
 * Deliberately no mutation methods exist here: consequential changes are
 * deferred to an artifact-bound execution adapter in the next Stage 2 slice.
 */
export class ServiceOperationsStore {
  constructor(
    private readonly customers: readonly ServiceCustomer[],
    private readonly auditHistory: readonly ServiceAuditEvent[],
  ) {}

  getCustomer(id: string): ServiceCustomer | undefined {
    const customer = this.customers.find((candidate) => candidate.id === id);
    return customer ? { ...customer, availableActions: [...customer.availableActions] } : undefined;
  }

  getAccountStatus(id: string): ServiceCustomer["accountStatus"] | undefined {
    return this.getCustomer(id)?.accountStatus;
  }

  listAvailableActions(id: string): string[] {
    return [...(this.getCustomer(id)?.availableActions ?? [])];
  }

  getAuditHistory(customerId: string): ServiceAuditEvent[] {
    return this.auditHistory
      .filter((event) => event.id.split(":")[1] === customerId)
      .map((event) => ({ ...event }));
  }
}
