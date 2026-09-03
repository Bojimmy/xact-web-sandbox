import { referenceEvolutionResults } from "./reference-results";
import type { EvolutionSnapshot, PromotionState } from "./contracts";

const lifecycle: PromotionState[] = ["OBSERVED", "CANDIDATE", "VALIDATED", "APPROVED", "ACTIVE"];
const nextLabel: Partial<Record<PromotionState, string>> = {
  OBSERVED: "Create candidate",
  CANDIDATE: "Validate candidate",
  VALIDATED: "Approve candidate",
  APPROVED: "Promote to ACTIVE",
};

export function EvolutionPanel({
  snapshot,
  busy,
  onStart,
  onAdvance,
  onReplay,
  onReset,
}: {
  snapshot: EvolutionSnapshot;
  busy: boolean;
  onStart: () => void;
  onAdvance: () => void;
  onReplay: () => void;
  onReset: () => void;
}) {
  const candidate = snapshot.candidate;
  const activeIndex = candidate ? lifecycle.indexOf(candidate.state) : -1;

  return (
    <section className="capability-panel evolution-panel" id="evolution" aria-labelledby="evolution-title">
      <div className="capability-heading">
        <div><span className="section-kicker">06 / Xact evolution</span><h2 id="evolution-title">Reasoning reduces future reasoning</h2></div>
        <span className="simulation-boundary">Public-safe simulation</span>
      </div>

      <div className="evolution-principle">
        <strong>Learning improves resolution.</strong>
        <span>It never grants authority. Every ACTIVE pattern still flows through Validate → Authorize → Commit.</span>
      </div>

      <div className="lifecycle-row" aria-label="Governed promotion lifecycle">
        {lifecycle.map((state, index) => (
          <div key={state} className={`lifecycle-state ${index < activeIndex ? "complete" : index === activeIndex ? "current" : "pending"}`}>
            <span>{String(index + 1).padStart(2, "0")}</span><strong>{state}</strong>
          </div>
        ))}
      </div>

      <div className="evolution-actions">
        {!candidate
          ? <button type="button" onClick={onStart} disabled={busy}>Start first encounter</button>
          : candidate.state !== "ACTIVE"
            ? <button type="button" onClick={onAdvance} disabled={busy}>{nextLabel[candidate.state]}</button>
            : <button type="button" className="replay-action" onClick={onReplay} disabled={busy}>Replay equivalent request</button>}
        <button type="button" className="quiet-action" onClick={onReset} disabled={busy}>Reset evolution</button>
        <p>{candidate
          ? `${candidate.label} · validation ${candidate.validationStatus} · approval ${candidate.approvalStatus} · promotion ${candidate.promotionStatus}`
          : "Begin with one unresolved semantic field and complete the normal re-entry + Commit path."}</p>
      </div>

      <div className="evolution-grid">
        <div className="coverage-card">
          <div className="evidence-label live-label"><strong>Simulation evolution snapshot</strong><span>Explicit five-case demo cohort</span></div>
          {snapshot.coverage.map((point) => (
            <article className="coverage-row" key={point.label}>
              <div><strong>{point.label}</strong><span>n={point.cohortSize}</span></div>
              <label><span>Deterministic coverage</span><meter min="0" max="100" value={point.deterministicCoveragePercent} /> <strong>{point.deterministicCoveragePercent}%</strong></label>
              <label><span>Reasoning frequency</span><meter className="reasoning-meter" min="0" max="100" value={point.reasoningFrequencyPercent} /> <strong>{point.reasoningFrequencyPercent}%</strong></label>
            </article>
          ))}
        </div>

        <div className="trace-compare">
          <div><span>First encounter</span>{snapshot.beforeTrace.length
            ? <ol>{snapshot.beforeTrace.map((item) => <li key={item}>{item}</li>)}</ol>
            : <p>Complete the ambiguity → evidence → re-entry → Commit path.</p>}</div>
          <div><span>Equivalent encounter after ACTIVE</span>{snapshot.afterTrace.length
            ? <ol>{snapshot.afterTrace.map((item) => <li key={item}>{item}</li>)}</ol>
            : <p>Promote through governance, then replay the equivalent request.</p>}</div>
        </div>

        <aside className="evolution-reference">
          <div className="evidence-label reference-label"><strong>Reference Xact results</strong><span>Historical evidence · not this sandbox</span></div>
          <div className="reference-shift"><span>Deterministic coverage</span><strong>{referenceEvolutionResults.deterministicCoverage.beforePercent}% → {referenceEvolutionResults.deterministicCoverage.afterPercent}%</strong></div>
          <div className="reference-shift"><span>O-Agent invocation / escalation</span><strong>{referenceEvolutionResults.reasoningFrequency.beforePercent}% → {referenceEvolutionResults.reasoningFrequency.afterPercent}%</strong></div>
          <div className="reference-shift"><span>Governed promotions</span><strong>{referenceEvolutionResults.promotedPatterns}</strong></div>
          <div className="reference-shift"><span>Exact-match routing maintained</span><strong>{referenceEvolutionResults.exactMatchRouting.maintained.toLocaleString()} / {referenceEvolutionResults.exactMatchRouting.total.toLocaleString()}</strong></div>
        </aside>
      </div>

      <p className="encapsulation-note">{snapshot.notice}</p>
    </section>
  );
}
