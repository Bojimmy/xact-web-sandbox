import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPublicOAgentBrief,
  evaluatePublicOAgentEvidence,
  PUBLIC_O_AGENT_CASE,
} from "../mcp-bridge/lib/o-agent";

const supportedEvidence = {
  caseId: PUBLIC_O_AGENT_CASE.caseId,
  candidateId: PUBLIC_O_AGENT_CASE.candidateId,
  baseStateHash: PUBLIC_O_AGENT_CASE.baseStateHash,
  unresolvedKey: PUBLIC_O_AGENT_CASE.unresolved.key,
  finding: "SUPPORTED" as const,
  rationale: "The verified delivery was two days late and the policy explicitly permits a bounded service-recovery refund.",
  evidenceRefs: ["delivery-promise", "carrier-delivery", "service-recovery-policy"],
};

test("brief isolates U and explicitly reserves authority for Xact Commit", () => {
  const brief = buildPublicOAgentBrief();

  assert.equal(brief.role.chatgpt, "O_AGENT_REASONING");
  assert.equal(brief.role.authority, "XACT_COMMIT_ONLY");
  assert.equal(brief.resolution.unresolved.length, 1);
  assert.equal(brief.reasoningContract.reasonOnlyOver, "U");
  assert.equal(brief.reasoningContract.outputIsEvidenceOnly, true);
  assert.equal(brief.reasoningContract.grantsAuthority, false);
});

test("supported structured evidence re-enters Xact and may pass Commit without executing", () => {
  const result = evaluatePublicOAgentEvidence(supportedEvidence);

  assert.equal(result.reasoningEvidence.grantsAuthority, false);
  assert.equal(result.commit.status, "AUTHORIZED");
  assert.equal(result.commit.authoritySource, "XACT_COMMIT");
  assert.equal(result.execution.effectReleased, false);
  assert.equal(result.execution.status, "NOT_EXECUTED");
});

test("insufficient evidence escalates and never releases an effect", () => {
  const result = evaluatePublicOAgentEvidence({
    ...supportedEvidence,
    finding: "INSUFFICIENT_EVIDENCE",
    evidenceRefs: ["carrier-delivery"],
  });

  assert.equal(result.commit.status, "ESCALATED");
  assert.equal(result.commit.reentryAllowed, true);
  assert.equal(result.execution.effectReleased, false);
});

test("an unsupported semantic finding is rejected by Commit", () => {
  const result = evaluatePublicOAgentEvidence({
    ...supportedEvidence,
    finding: "NOT_SUPPORTED",
  });

  assert.equal(result.commit.status, "REJECTED");
  assert.equal(result.execution.effectReleased, false);
});

test("a stale candidate binding fails before semantic evidence is considered", () => {
  const result = evaluatePublicOAgentEvidence({
    ...supportedEvidence,
    baseStateHash: "tampered-state-binding",
  });

  assert.equal(result.commit.status, "STALE");
  assert.equal(result.commit.checks[0]?.key, "freshness");
  assert.equal(result.commit.checks[0]?.outcome, "FAIL");
  assert.equal(result.execution.effectReleased, false);
});
