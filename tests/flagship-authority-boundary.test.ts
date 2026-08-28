import assert from "node:assert/strict";
import test from "node:test";
import {
  activateResolutionAuthority,
  commitAuthorizationFrom,
  createCandidateCapability,
  type ActivatedResolutionAuthority,
  type CommitAuthorization,
} from "../src/flagship/authority-contracts";
import { LearningSimulationProvider } from "../src/evolution/learning-simulation-provider";
import { createCommerceSimulationEngine } from "../src/runtime/commerce-engine";
import type { CommerceScenarioInputs } from "../src/scenarios/commerce-v1";

function activatedLearning(): LearningSimulationProvider<CommerceScenarioInputs> {
  const learning = new LearningSimulationProvider<CommerceScenarioInputs>({
    candidateId: "capability:service-recovery-rationale",
    label: "Service recovery rationale",
    caseKey: (inputs) => inputs.semanticAmbiguity ? "commerce:service-recovery" : undefined,
    equivalentCaseKey: "commerce:service-recovery",
    resolves: ["refund-rationale"],
  });
  learning.observe({ evidenceId: "evidence:service-recovery", claim: "Governed evidence resolves the public rationale.", beforeTrace: ["U: refund-rationale"] });
  for (const state of ["CANDIDATE", "VALIDATED", "APPROVED", "ACTIVATED"] as const) learning.transition(state);
  return learning;
}

test("candidate capability has no executable surface and authority types cannot be assigned to one another", () => {
  const candidate = createCandidateCapability({
    id: "capability:service-recovery-rationale",
    label: "Service recovery rationale",
    resolves: ["refund-rationale"],
  });

  assert.equal("execute" in candidate, false);
  assert.equal("artifact" in candidate, false);
  assert.throws(
    () => commitAuthorizationFrom(candidate as never),
    /Only an AUTHORIZED Commit decision/,
  );

});

test("ACTIVATED resolves U to R but still cannot execute before a fresh Commit", async () => {
  const learning = activatedLearning();
  const candidate = createCandidateCapability({
    id: "capability:service-recovery-rationale",
    label: "Service recovery rationale",
    resolves: ["refund-rationale"],
  });
  const resolutionAuthority = activateResolutionAuthority(candidate, learning.snapshot().candidate!);
  const evidence = resolutionAuthority.resolve();

  // @ts-expect-error Commit authority and activated resolution authority are opaque, distinct types.
  const notCommit: CommitAuthorization = resolutionAuthority;
  void notCommit;

  assert.deepEqual(evidence.resolves, ["refund-rationale"]);
  assert.equal("artifact" in resolutionAuthority, false);
  assert.equal("execute" in resolutionAuthority, false);

  const engine = createCommerceSimulationEngine({ resolutionEvidenceProvider: learning });
  let session = engine.updateInputs(engine.createSession(), { semanticAmbiguity: true });
  session = await engine.resolve(session);
  assert.equal(session.candidate?.resolution.unresolved.length, 0, "ACTIVATED may resolve U → R");
  assert.equal(session.decision, undefined);
  assert.equal(session.selectedSubstrate, "NONE");
  await assert.rejects(() => engine.executeAndVerify(session), /AUTHORIZED/);

  session = await engine.commit(session);
  assert.equal(session.decision?.status, "AUTHORIZED");
  const consequence = commitAuthorizationFrom(session.decision!);
  assert.equal(consequence.kind, "COMMIT_AUTHORIZATION");
  assert.equal(consequence.artifact.effectFingerprint.length > 0, true);
  // @ts-expect-error A Commit artifact cannot be repurposed as resolution authority.
  const notResolution: ActivatedResolutionAuthority = consequence;
  void notResolution;
});

test("only the governed candidate to Commit to observe/verify path reaches a verified consequence", async () => {
  const learning = activatedLearning();
  const candidate = createCandidateCapability({
    id: "capability:service-recovery-rationale",
    label: "Service recovery rationale",
    resolves: ["refund-rationale"],
  });
  const resolutionAuthority = activateResolutionAuthority(candidate, learning.snapshot().candidate!);
  assert.equal(resolutionAuthority.resolve().resolves?.[0], "refund-rationale");
  const engine = createCommerceSimulationEngine({ resolutionEvidenceProvider: learning });
  let session = engine.updateInputs(engine.createSession(), { semanticAmbiguity: true });

  session = await engine.resolve(session);
  assert.equal(session.selectedSubstrate, "NONE");
  session = await engine.commit(session);
  assert.deepEqual(session.decision?.checks.map((check) => check.key), ["resolution", "freshness", "policy", "authority", "capability"]);
  const authorization = commitAuthorizationFrom(session.decision!);
  assert.equal(authorization.artifact.nonce.length > 0, true);
  session = await engine.executeAndVerify(session);

  assert.equal(session.phase, "VERIFIED");
  assert.equal(session.verification?.verified, true);
  assert.deepEqual(session.trace.map((entry) => entry.phase), ["Input", "Input", "Resolve", "Commit", "Execute", "Verify"]);
});
