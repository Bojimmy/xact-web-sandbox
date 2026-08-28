import type { PromotionState } from "../evolution/contracts";

export type SecurityTraceStatus = "PASS" | "PENDING" | "BLOCK" | "EVIDENCE" | "VERIFIED" | "RESOLUTION_ONLY";

export interface SecurityTraceEntry {
  id: string;
  label: string;
  status: SecurityTraceStatus;
  detail: string;
}

export interface SecurityBoundaryTraceInput {
  requestSource?: string;
  provider?: string;
  doorPassed?: boolean;
  ledgerPassed?: boolean;
  commitStatus?: string;
  artifact?: { commitId: string; capability: string; effectFingerprint: string };
  target?: string;
  verification?: { verified: boolean; reason: string };
  governanceActor?: string;
  promotionApproved?: boolean;
  lifecycleState?: PromotionState;
}

/**
 * An inspectable projection of security-relevant Xact facts. This model does
 * not decide, authorize, or execute. Missing facts remain PENDING; a blocked
 * Door or Ledger result stays BLOCK rather than being softened in the UI.
 */
export function buildSecurityBoundaryTrace(input: SecurityBoundaryTraceInput): SecurityTraceEntry[] {
  const lifecycle = input.lifecycleState;
  return [
    {
      id: "source",
      label: "Proposal source",
      status: input.requestSource ? "PASS" : "PENDING",
      detail: input.requestSource ?? "No operator request has entered the bounded extension path.",
    },
    {
      id: "provider",
      label: "Reasoning isolation",
      status: input.provider ? "EVIDENCE" : "PENDING",
      detail: input.provider
        ? `${input.provider} supplied evidence only; it did not select authority, construct a tool, or execute.`
        : "Provider is not invoked until a bounded request reaches genuine U.",
    },
    {
      id: "door",
      label: "Door / admissibility",
      status: input.doorPassed === true ? "PASS" : input.doorPassed === false ? "BLOCK" : "PENDING",
      detail: input.doorPassed === true ? "Capability is in the closed extension ontology." : input.doorPassed === false ? "Unknown or prohibited capability blocked before candidate creation." : "Awaiting deterministic closed-ontology validation.",
    },
    {
      id: "ledger",
      label: "Ledger / authority-surface validity",
      status: input.ledgerPassed === true ? "PASS" : input.ledgerPassed === false ? "BLOCK" : "PENDING",
      detail: input.ledgerPassed === true ? "Proposal carries no execute, artifact, authorize, commit, or activate surface." : input.ledgerPassed === false ? "Authority-bearing proposal blocked." : "Awaiting deterministic authority-surface validation.",
    },
    {
      id: "commit",
      label: "Construction Commit",
      status: input.commitStatus === "AUTHORIZED" ? "PASS" : input.commitStatus === "REJECTED" || input.commitStatus === "STALE" || input.commitStatus === "ESCALATED" ? "BLOCK" : "PENDING",
      detail: input.commitStatus === "AUTHORIZED" ? "Fresh Commit authorized one bounded construction consequence." : input.commitStatus ? `Commit result: ${input.commitStatus}; no construction artifact is available.` : "No artifact exists before a fresh AUTHORIZED Commit.",
    },
    {
      id: "artifact",
      label: "Artifact + target binding",
      status: input.artifact && input.target ? "PASS" : "PENDING",
      detail: input.artifact && input.target ? `${input.artifact.capability} · ${input.artifact.commitId} bound to ${input.target}.` : "No artifact or exact target binding is available.",
    },
    {
      id: "verification",
      label: "Observe + verify",
      status: input.verification?.verified ? "VERIFIED" : input.verification ? "BLOCK" : "PENDING",
      detail: input.verification?.verified ? input.verification.reason : input.verification ? "Verification withheld or failed; outcome cannot become governed evidence." : "No verified consequence yet.",
    },
    {
      id: "governance",
      label: "Governance + activation",
      status: lifecycle === "ACTIVATED" ? "RESOLUTION_ONLY" : input.promotionApproved ? "PASS" : "PENDING",
      detail: lifecycle === "ACTIVATED"
        ? "ACTIVATED may resolve future U → R only; every consequence still requires a fresh Commit."
        : input.promotionApproved
          ? `${input.governanceActor ?? "Governance"} approved promotion; activation remains a separate step.`
          : "Outcome effectiveness evidence cannot promote or activate without explicit governance.",
    },
  ];
}
