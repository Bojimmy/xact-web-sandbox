import assert from "node:assert/strict";
import test from "node:test";
import {
  doorValidate,
  ledgerValidate,
  recordOutcomeEvidence,
  issueGovernanceDecision,
  governCandidate,
  type OutcomeEvidence,
  type GovernanceDecision,
  type PromotionDecision,
} from "../src/flagship/outcome-effectiveness-gate";
import {
  activateResolutionAuthority,
  createCandidateCapability,
  type ActivatedResolutionAuthority,
  type CommitAuthorization,
} from "../src/flagship/authority-contracts";
import { LearningSimulationProvider } from "../src/evolution/learning-simulation-provider";

const CAPABILITY_ALLOWLIST = new Set([
  "get_customer",
  "get_account_status",
  "list_available_actions",
  "request_service_credit",
  "change_service_plan",
  "get_audit_history",
]);

const candidate = () =>
  createCandidateCapability({
    id: "capability:service-credit",
    label: "Service credit",
    resolves: ["service-credit"],
  });

const effectiveEvidence = (): OutcomeEvidence =>
  recordOutcomeEvidence({
    id: "evidence:service-credit:1",
    capabilityId: "capability:service-credit",
    resolves: ["service-credit"],
    verifiedConsequence: {
      effectFingerprint: "fp-service-credit-1042",
      verifiedAtEpochMs: 1,
      verificationSource: "DOM + vision recheck",
    },
    measurement: {
      verdict: "EFFECTIVE",
      objective: "Apply $50 service credit to customer 1042",
      observedMetric: { key: "credit-applied", value: 50, unit: "USD" },
      measuredAtEpochMs: 1,
    },
  });

const approvedGovernance = (evidenceId = "evidence:service-credit:1"): GovernanceDecision =>
  issueGovernanceDecision({
    id: `gov:${evidenceId}`,
    evidenceId,
    approval: "APPROVED",
    decidedBy: "Governance Review",
    rationale: "Verified consequence achieved the objective.",
    decidedAtEpochMs: 1,
  });

test("door admits only closed-ontology capabilities and rejects unknown ones", () => {
  const ok = doorValidate(
    { capability: "request_service_credit", resolves: ["service-credit"] },
    CAPABILITY_ALLOWLIST,
  );
  assert.equal(ok.admissible, true);

  const unknown = doorValidate(
    { capability: "delete_customer_record", resolves: ["customer"] },
    CAPABILITY_ALLOWLIST,
  );
  assert.equal(unknown.admissible, false);
  assert.ok(unknown.errors.some((error) => error.includes("closed capability ontology")));

  const shapeless = doorValidate("not-an-object", CAPABILITY_ALLOWLIST);
  assert.equal(shapeless.admissible, false);
});

test("ledger rejects any proposal carrying an execution or authority surface", () => {
  const clean = ledgerValidate({ capability: "request_service_credit", resolves: ["service-credit"] });
  assert.equal(clean.valid, true);

  const executing = ledgerValidate({ capability: "request_service_credit", execute: () => undefined });
  assert.equal(executing.valid, false);
  assert.ok(executing.violations.some((violation) => violation.includes("'execute'")));

  const carryingArtifact = ledgerValidate({ capability: "request_service_credit", artifact: { commitId: "c1" } });
  assert.equal(carryingArtifact.valid, false);
  assert.ok(carryingArtifact.violations.some((violation) => violation.includes("'artifact'")));
});

test("outcome evidence is evidence-only and cannot be assigned to authority types", () => {
  const evidence = effectiveEvidence();

  assert.equal("resolve" in evidence, false);
  assert.equal("artifact" in evidence, false);
  assert.equal("execute" in evidence, false);
  assert.equal("activate" in evidence, false);

  // @ts-expect-error Outcome evidence is nominal and never Commit authorization.
  const notCommit: CommitAuthorization = evidence;
  void notCommit;

  // @ts-expect-error Outcome evidence is nominal and never resolution authority.
  const notResolution: ActivatedResolutionAuthority = evidence;
  void notResolution;
});

test("a governance decision is not commit or resolution authority", () => {
  const decision = approvedGovernance();

  // @ts-expect-error Governance approval is nominal and never Commit authorization.
  const notCommit: CommitAuthorization = decision;
  void notCommit;

  // @ts-expect-error Governance approval is nominal and never resolution authority.
  const notResolution: ActivatedResolutionAuthority = decision;
  void notResolution;
});

test("effectiveness cannot cause promotion without an APPROVED governance decision", () => {
  const rejected = issueGovernanceDecision({
    id: "gov:rejected",
    evidenceId: "evidence:service-credit:1",
    approval: "REJECTED",
    decidedBy: "Governance Review",
    rationale: "Not yet.",
    decidedAtEpochMs: 1,
  });

  assert.throws(
    () => governCandidate(candidate(), effectiveEvidence(), rejected),
    /Only an APPROVED governance decision/,
  );
});

test("an ineffective or indeterminate resolution is not promotable even with APPROVED governance", () => {
  const ineffective = recordOutcomeEvidence({
    id: "evidence:service-credit:2",
    capabilityId: "capability:service-credit",
    resolves: ["service-credit"],
    verifiedConsequence: { effectFingerprint: "fp-service-credit-1042", verifiedAtEpochMs: 1, verificationSource: "DOM + vision recheck" },
    measurement: { verdict: "INEFFECTIVE", objective: "Apply $50 service credit", measuredAtEpochMs: 1 },
  });
  const indeterminate = recordOutcomeEvidence({
    id: "evidence:service-credit:3",
    capabilityId: "capability:service-credit",
    resolves: ["service-credit"],
    verifiedConsequence: { effectFingerprint: "fp-service-credit-1042", verifiedAtEpochMs: 1, verificationSource: "DOM + vision recheck" },
    measurement: { verdict: "INDETERMINATE", objective: "Apply $50 service credit", measuredAtEpochMs: 1 },
  });

  assert.throws(
    () => governCandidate(candidate(), ineffective, approvedGovernance("evidence:service-credit:2")),
    /not promotable/,
  );
  assert.throws(
    () => governCandidate(candidate(), indeterminate, approvedGovernance("evidence:service-credit:3")),
    /not promotable/,
  );
});

test("governance approves only when evidence matches the candidate and the decision references it", () => {
  const mismatchedEvidence = recordOutcomeEvidence({
    id: "evidence:service-credit:4",
    capabilityId: "capability:change-service-plan",
    resolves: ["service-plan"],
    verifiedConsequence: { effectFingerprint: "fp-plan", verifiedAtEpochMs: 1, verificationSource: "DOM" },
    measurement: { verdict: "EFFECTIVE", objective: "Change plan", measuredAtEpochMs: 1 },
  });

  assert.throws(
    () => governCandidate(candidate(), mismatchedEvidence, approvedGovernance()),
    /must describe this candidate/,
  );
});

test("both EFFECTIVE evidence and APPROVED governance yield a promotion that is still not authority", () => {
  const promotion: PromotionDecision = governCandidate(candidate(), effectiveEvidence(), approvedGovernance());

  assert.equal(promotion.kind, "PROMOTION_DECISION");
  assert.equal(promotion.targetState, "APPROVED");
  assert.equal("artifact" in promotion, false);
  assert.equal("resolve" in promotion, false);

  // @ts-expect-error A justified promotion is not itself Commit authorization.
  const notCommit: CommitAuthorization = promotion;
  void notCommit;

  // @ts-expect-error A justified promotion is not itself resolution authority.
  const notResolution: ActivatedResolutionAuthority = promotion;
  void notResolution;
});

test("a governance-approved promotion does not itself activate or grant authority", () => {
  const learning = new LearningSimulationProvider<{ semanticAmbiguity: boolean }>({
    candidateId: "capability:service-credit",
    label: "Service credit",
    caseKey: (inputs) => (inputs.semanticAmbiguity ? "service:credit" : undefined),
    equivalentCaseKey: "service:credit",
    resolves: ["service-credit"],
  });
  learning.observe({
    evidenceId: "evidence:service-credit:1",
    claim: "Governed evidence resolves the credit request.",
    beforeTrace: ["U: service-credit"],
  });
  // Advance only to APPROVED — not ACTIVATED.
  for (const state of ["CANDIDATE", "VALIDATED", "APPROVED"] as const) learning.transition(state);

  const cap = candidate();
  const promotion = governCandidate(cap, effectiveEvidence(), approvedGovernance());
  assert.equal(promotion.targetState, "APPROVED");

  // APPROVED is still not ACTIVATED: resolution authority cannot be minted yet.
  assert.throws(
    () => activateResolutionAuthority(cap, learning.snapshot().candidate!),
    /ACTIVATED/,
  );
});

test("the full chain preserves ACTIVATED = resolution-only and Commit = consequence", () => {
  const learning = new LearningSimulationProvider<{ semanticAmbiguity: boolean }>({
    candidateId: "capability:service-credit",
    label: "Service credit",
    caseKey: (inputs) => (inputs.semanticAmbiguity ? "service:credit" : undefined),
    equivalentCaseKey: "service:credit",
    resolves: ["service-credit"],
  });
  learning.observe({
    evidenceId: "evidence:service-credit:1",
    claim: "Governed evidence resolves the credit request.",
    beforeTrace: ["U: service-credit"],
  });
  for (const state of ["CANDIDATE", "VALIDATED", "APPROVED", "ACTIVATED"] as const) learning.transition(state);

  const authority = activateResolutionAuthority(candidate(), learning.snapshot().candidate!);
  assert.equal("artifact" in authority, false);
  assert.equal("execute" in authority, false);
  assert.deepEqual(authority.resolve().resolves, ["service-credit"]);

  // @ts-expect-error Activated resolution authority is not Commit authority.
  const notCommit: CommitAuthorization = authority;
  void notCommit;
});
