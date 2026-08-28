"use client";

import { useMemo, useState } from "react";
import type { PromotionState } from "../evolution/contracts";
import { LearningSimulationProvider } from "../evolution/learning-simulation-provider";
import { SecureEndpointOAgentProvider, type ReasoningResult } from "../telemetry/o-agent-provider";
import { activateResolutionAuthority } from "./authority-contracts";
import {
  analyzeCapabilityRequest,
  CapabilityConstructionEngine,
  type CapabilityConstructionSession,
  type ProposalAnalysis,
} from "./capability-extension";
import { governCandidate, issueGovernanceDecision, recordOutcomeEvidence, type OutcomeEvidence, type PromotionDecision } from "./outcome-effectiveness-gate";
import { buildSecurityBoundaryTrace } from "./security-boundary-trace";

const nextLifecycle: Partial<Record<PromotionState, PromotionState>> = {
  OBSERVED: "CANDIDATE",
  CANDIDATE: "VALIDATED",
  APPROVED: "ACTIVATED",
};

function Gate({ label, passed, detail }: { label: string; passed?: boolean; detail: string }) {
  return <article className={`teach-gate ${passed === undefined ? "pending" : passed ? "pass" : "block"}`}><span>{label}</span><strong>{passed === undefined ? "PENDING" : passed ? "PASS" : "BLOCK"}</strong><small>{detail}</small></article>;
}

/**
 * Stage 3's judge-facing bounded extension proof. The model is asked only for
 * evidence about U. The candidate identifier, allowlist validation, Commit,
 * construction, verification, and governed activation are local Xact steps.
 */
export function TeachItPanel() {
  const provider = useMemo(() => new SecureEndpointOAgentProvider(), []);
  const construction = useMemo(() => new CapabilityConstructionEngine(), []);
  const learning = useMemo(() => new LearningSimulationProvider<{ capability: string }>({
    candidateId: "candidate:get_audit_history",
    label: "Read customer audit history",
    caseKey: (input) => input.capability === "get_audit_history" ? "service-operations:audit-history" : undefined,
    equivalentCaseKey: "service-operations:audit-history",
    resolves: ["service-history"],
  }), []);
  const [request, setRequest] = useState("Show me audit history for customer 1042");
  const [analysis, setAnalysis] = useState<ProposalAnalysis>();
  const [reasoning, setReasoning] = useState<ReasoningResult>();
  const [session, setSession] = useState<CapabilityConstructionSession>();
  const [evolution, setEvolution] = useState(() => learning.snapshot());
  const [evidence, setEvidence] = useState<OutcomeEvidence>();
  const [promotion, setPromotion] = useState<PromotionDecision>();
  const [activatedResolution, setActivatedResolution] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const analyze = async () => {
    setBusy(true); setError(undefined); setReasoning(undefined); setSession(undefined); setEvidence(undefined); setPromotion(undefined); setActivatedResolution(false); setEvolution(learning.reset());
    try {
      const result = analyzeCapabilityRequest(request);
      setAnalysis(result);
      if (!result.candidate) return;
      const oAgent = await provider.reason({
        context: { stage: "flagship-teach-it", request: request.slice(0, 240), candidate: result.proposal.capability },
        unresolved: ["whether the request fits the exact proposed read capability"],
      });
      setReasoning(oAgent);
      setSession(construction.createSession(result.candidate));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The evidence provider was unavailable; no candidate was advanced."); }
    finally { setBusy(false); }
  };

  const runConstruction = async (action: (current: CapabilityConstructionSession) => Promise<CapabilityConstructionSession>) => {
    if (!session) return;
    setBusy(true); setError(undefined);
    try {
      const next = await action(session);
      setSession(next);
      if (next.phase === "VERIFIED" && analysis?.candidate && next.decision?.artifact && next.execution?.receipt) {
        const outcome = recordOutcomeEvidence({
          id: `outcome:${analysis.candidate.id}:${next.decision.artifact.commitId}`,
          capabilityId: analysis.candidate.id,
          resolves: analysis.candidate.resolves,
          verifiedConsequence: { effectFingerprint: next.decision.artifact.effectFingerprint, verifiedAtEpochMs: Date.now(), verificationSource: "LOCAL construction adapter + independent verification" },
          measurement: { verdict: "EFFECTIVE", objective: "Construct the exact inert resolution descriptor", observedMetric: { key: "descriptor-constructed", value: 1, unit: "descriptor" }, measuredAtEpochMs: Date.now(), notes: `Receipt ${String(next.execution.receipt)}` },
        });
        setEvidence(outcome);
        setEvolution(learning.observe({ evidenceId: outcome.id, claim: "The exact artifact-bound resolution descriptor was observed and verified.", beforeTrace: next.trace.map((entry) => `${entry.phase}: ${entry.outcome}`) }));
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Construction step failed closed."); }
    finally { setBusy(false); }
  };

  const advanceLifecycle = () => {
    const candidate = evolution.candidate;
    if (!candidate) return;
    setError(undefined);
    try {
      if (candidate.state === "VALIDATED") {
        if (!analysis?.candidate || !evidence) throw new Error("Verified outcome evidence is required before governance can approve.");
        const decision = issueGovernanceDecision({ id: `governance:${evidence.id}`, evidenceId: evidence.id, approval: "APPROVED", decidedBy: "Explicit Stage 3 governance action", rationale: "Verified outcome evidence supports the bounded resolution capability.", decidedAtEpochMs: Date.now() });
        setPromotion(governCandidate(analysis.candidate, evidence, decision));
        setEvolution(learning.transition("APPROVED"));
        return;
      }
      const next = nextLifecycle[candidate.state];
      if (next) setEvolution(learning.transition(next));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Governance step failed closed."); }
  };

  const activate = () => {
    if (!analysis?.candidate || evolution.candidate?.state !== "APPROVED" || !promotion) return;
    try {
      const next = learning.transition("ACTIVATED");
      activateResolutionAuthority(analysis.candidate, next.candidate!);
      setEvolution(next);
      setActivatedResolution(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Activation failed closed."); }
  };

  const candidateState = evolution.candidate?.state;
  const forbidden = analysis && !analysis.candidate;
  const artifactIssued = session?.decision?.status === "AUTHORIZED" && Boolean(session.decision.artifact);
  const nextConstruction = session?.phase === "READY" ? "Resolve construction" : session?.phase === "RESOLVED" ? "Commit construction" : session?.phase === "AUTHORIZED" ? "Construct, observe, verify" : undefined;
  const securityTrace = buildSecurityBoundaryTrace({
    requestSource: analysis ? "Operator input → deterministic bounded decomposition" : undefined,
    provider: reasoning?.provider,
    doorPassed: analysis?.door.admissible,
    ledgerPassed: analysis?.ledger.valid,
    commitStatus: session?.decision?.status,
    artifact: session?.decision?.artifact ? { commitId: session.decision.artifact.commitId, capability: session.decision.artifact.capability, effectFingerprint: session.decision.artifact.effectFingerprint } : undefined,
    target: session?.decision?.candidate.proposedEffect.target,
    verification: session?.verification,
    governanceActor: promotion ? "Explicit Stage 3 governance action" : undefined,
    promotionApproved: Boolean(promotion),
    lifecycleState: candidateState,
  });

  return <section className="teach-it-panel construction-comparison" aria-labelledby="teach-it-title">
    <header className="construction-heading"><div><span className="section-kicker">Stage 3 / Part II · Teach It</span><h3 id="teach-it-title">Give Xact one bounded new resolution ability</h3><p>O-Agent evidence may clarify U. It cannot choose authority, construct a tool, or execute an effect.</p></div><span className="simulation-boundary">Live protected O-Agent endpoint</span></header>
    <div className="teach-it-input"><label htmlFor="teach-it-request">Novel capability request</label><textarea id="teach-it-request" value={request} onChange={(event) => setRequest(event.target.value)} disabled={busy} /><div className="construction-actions"><button type="button" onClick={() => setRequest("Show me audit history for customer 1042")} disabled={busy}>Use allowlisted read example</button><button type="button" onClick={() => setRequest("Delete customer account 1042")} disabled={busy}>Try forbidden example</button><button type="button" className="primary-action" onClick={() => void analyze()} disabled={busy || !request.trim()}>1 · Decompose + reason about U</button></div></div>
    <div className="teach-gates"><Gate label="R / U / C" passed={analysis ? true : undefined} detail={analysis ? `R: request · U: exact read semantics · C: closed ontology, no authority surface` : "Decompose a request first."} /><Gate label="Door" passed={analysis?.door.admissible} detail={analysis ? analysis.door.errors[0] ?? "Capability is in the closed ontology." : "Allowlisted capability only."} /><Gate label="Ledger" passed={analysis?.ledger.valid} detail={analysis ? analysis.ledger.violations[0] ?? "Proposal carries no authority or execution surface." : "Candidate must remain descriptive."} /><Gate label="Commit artifact" passed={artifactIssued ? true : undefined} detail={artifactIssued ? "Exact construction artifact issued." : session ? "No construction artifact before AUTHORIZED Commit." : "No candidate, no artifact."} /></div>
    {reasoning ? <div className="teach-evidence"><strong>O-Agent evidence · {reasoning.provider}</strong><span>{reasoning.inputTokens} in / {reasoning.outputTokens} out · {reasoning.latencyMs.toFixed(1)} ms</span><p>{reasoning.evidence[0]?.claim ?? "No structured evidence returned."}</p><small>Evidence only. It did not create a capability or authorize construction.</small></div> : null}
    {forbidden ? <div className="teach-refusal"><strong>REQUEST UNDERSTOOD ✓</strong><span>CAPABILITY NOT ACTIVATED</span><p>{analysis.door.errors[0] ?? "The request is outside the closed capability ontology."}</p><small>Knowing how is not authority to act. No candidate, artifact, executable surface, or effect was created.</small></div> : null}
    {analysis?.candidate && session ? <><div className="construction-actions teach-construction-actions"><button type="button" disabled={busy || !nextConstruction} onClick={() => void runConstruction((current) => current.phase === "READY" ? construction.resolve(current) : current.phase === "RESOLVED" ? construction.commit(current) : construction.executeAndVerify(current))}>{nextConstruction ?? "Construction verified"}</button></div><dl className="teach-status"><div><dt>Candidate</dt><dd>{analysis.candidate.id}</dd></div><div><dt>Construction Commit</dt><dd>{session.decision?.status ?? "PENDING"}</dd></div><div><dt>Artifact</dt><dd>{artifactIssued ? "ISSUED" : "NONE"}</dd></div><div><dt>Verification</dt><dd>{session.verification?.verified ? "VERIFIED" : "NOT RUN"}</dd></div></dl>{session.trace.length > 1 ? <ol className="construction-trace">{session.trace.map((entry) => <li key={`${entry.sequence}:${entry.phase}`}><strong>{entry.phase} · {entry.outcome}</strong><span>{entry.detail}</span></li>)}</ol> : null}</> : null}
    {evidence ? <div className="teach-evidence outcome-evidence"><strong>Outcome effectiveness evidence · {evidence.measurement.verdict}</strong><span>{evidence.verifiedConsequence.verificationSource}</span><p>{evidence.measurement.objective}</p><small>Verified consequence fingerprint: {evidence.verifiedConsequence.effectFingerprint}</small></div> : null}
    {evolution.candidate ? <><div className="teach-lifecycle">{(["OBSERVED", "CANDIDATE", "VALIDATED", "APPROVED", "ACTIVATED"] as const).map((state) => <span key={state} className={state === candidateState ? "current" : (["OBSERVED", "CANDIDATE", "VALIDATED", "APPROVED", "ACTIVATED"].indexOf(state) < ["OBSERVED", "CANDIDATE", "VALIDATED", "APPROVED", "ACTIVATED"].indexOf(candidateState!) ? "complete" : "")}>{state}</span>)}</div><div className="construction-actions teach-construction-actions">{candidateState === "APPROVED" ? <button type="button" className="reentry-action" onClick={activate} disabled={busy}>Activate resolution only</button> : candidateState !== "ACTIVATED" ? <button type="button" className="reentry-action" onClick={advanceLifecycle} disabled={busy}>{candidateState === "VALIDATED" ? "Explicit governance approve" : `Advance → ${nextLifecycle[candidateState!]}`}</button> : null}</div><p className="teach-final-state">{activatedResolution ? "ACTIVATED resolves future U → R only. It has no artifact, execute method, or consequence authority; every effect still needs a fresh Commit." : promotion ? "Governance approved promotion. Activation remains a separate resolution-only action." : "Outcome evidence informs governance; it cannot approve or activate itself."}</p></> : null}
    <section className="security-boundary-trace" aria-labelledby="security-boundary-title">
      <div><span className="section-kicker">Inspectable security boundary</span><h4 id="security-boundary-title">Clean absorption gate</h4><p>Only admissible, valid, verified, explicitly governed evidence may become future resolution knowledge.</p></div>
      <ol>{securityTrace.map((entry) => <li key={entry.id} className={`security-trace-${entry.status.toLowerCase()}`}><span>{entry.label}</span><strong>{entry.status.replace("_", " ")}</strong><p>{entry.detail}</p></li>)}</ol>
      <small>Scope: proposal-to-consequence protection. Host compromise, identity takeover, and network attacks require their own security controls.</small>
    </section>
    {error ? <p className="runtime-error" role="alert">{error}</p> : null}
  </section>;
}
