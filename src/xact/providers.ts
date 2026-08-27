import type { DecisionRequest, DecisionResult } from "./contracts";

export interface DecisionProvider {
  evaluate(request: DecisionRequest): Promise<DecisionResult>;
}

export interface PolicyProvider {
  authorize(input: unknown): Promise<{ allowed: boolean; reason?: string }>;
}

export interface EvidenceProvider {
  collect(input: unknown): Promise<unknown[]>;
}

export interface VerificationProvider {
  verify(input: unknown): Promise<{ verified: boolean; reason?: string }>;
}
