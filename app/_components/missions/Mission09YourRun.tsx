"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Run } from "../../_lib/run";

// MISSION 09 — YOUR RUN
// The personalized evidence-grounded explainer.
// Generated entirely from the run state — what THIS judge actually did.

export function Mission09YourRun({
  run,
  onReplay,
}: {
  run: Run;
  onReplay: () => void;
}) {
  const router = useRouter();
  const [explained, setExplained] = useState(run.completed.includes(9));
  const d = run.data;

  const deniedAt00 = run.denialCount > 0;
  const commit = d.commit;
  const execute = d.execute;
  const executionBlocked = commit?.outcome !== "AUTHORIZED" || execute?.disposition === "BLOCKED_NO_AUTHORITY";
  const decoy = execute?.decoy;
  const absorbed = d.absorb?.decision === "SUBMIT";
  const declined = d.absorb?.decision === "DECLINE";
  const teach = d.teach;

  return (
    <div>
      <div className="lvl-hero">
        <div className="num">09</div>
        <div className="word">
          <p className="tagline">Your evidence-grounded explainer</p>
          <h1 className="verb">YOUR RUN</h1>
          <p className="proves"><strong>PROVES</strong> Xact explains what *they* just proved</p>
        </div>
      </div>

      <div className="lvl-body">
        <div className="lvl-body-grid">
          <p className="lvl-h3">Run <strong>{run.id}</strong> · trace {run.traceId}</p>

          {!explained ? (
            <button type="button" className="lvl-advance" onClick={() => setExplained(true)}>
              <span className="arrow">▸</span>
              <span className="verb-text">EXPLAIN MY RUN</span>
              <span className="label">Generate the personalized story</span>
            </button>
          ) : null}

          {explained ? (
            <>
              <p style={{ fontSize: 15, color: "var(--lvl-text)", lineHeight: 1.65, fontFamily: "var(--sans)", maxWidth: 720, margin: 0 }}>
                This is your run. Every line below is what <em>you</em> did, bound to the
                evidence Xact recorded while you did it.
              </p>

              <ol className="m09-timeline">
                <li>
                  <span className="m09-mark">00</span>
                  <div>
                    <strong>You {deniedAt00 ? "tested the participation boundary" : d.authorize?.result === "AGREE" ? "authorized participation" : "started"}.</strong>
                    {deniedAt00 ? (
                      <p>You were denied {run.denialCount} time{run.denialCount === 1 ? "" : "s"}, then reconsidered and authorized participation within the stated boundary.</p>
                    ) : (
                      <p>You agreed to participate within the authority granted to you. Capability ≠ Authority still holds.</p>
                    )}
                  </div>
                </li>

                <li>
                  <span className="m09-mark">01</span>
                  <div>
                    <strong>You gave Xact a request.</strong>
                    {d.resolve?.request ? (
                      <p>
                        Your request: <code style={{ color: "var(--lvl-acid)" }}>“{d.resolve.request}”</code>.
                        Xact decomposed it into {d.resolve.facts.length} fact
                        {d.resolve.facts.length === 1 ? "" : "s"} and{" "}
                        {d.resolve.unresolved[0]?.toLowerCase().includes("none") ? "0" : "1"} genuine U.
                      </p>
                    ) : (
                      <p>(skipped or empty)</p>
                    )}
                  </div>
                </li>

                <li>
                  <span className="m09-mark">02</span>
                  <div>
                    <strong>You submitted something with {d.reason?.ambiguity ? "genuine ambiguity" : "no genuine ambiguity"}.</strong>
                    {d.reason ? (
                      <p>
                        O-Agent invocations: <strong>{d.reason.oAgentInvoked ? 1 : 0}</strong>.
                        {" "}Reasoning was {d.reason.oAgentInvoked ? "necessary" : "not necessary"} here.
                      </p>
                    ) : null}
                  </div>
                </li>

                <li>
                  <span className="m09-mark">03</span>
                  <div>
                    <strong>You attempted {commit?.action === "ALLOWED" ? "an allowed commit" : commit?.action === "EXCESS" ? "an excess commit" : commit?.action === "SOCIAL" ? "a social-proof override" : "a commit"}.</strong>
                    {commit ? (
                      <p>
                        Xact’s verdict: <strong style={{ color: commit.outcome === "AUTHORIZED" ? "var(--lvl-acid)" : "var(--lvl-red)" }}>
                          {commit.outcome}
                        </strong>.
                        {commit.outcome === "AUTHORIZED"
                          ? " Capability present, authority granted, policy intact, state bound."
                          : commit.outcome === "REJECTED_EXCESS"
                            ? " Excess vs. policy. No escalation. The system refuses and returns the request to the queue."
                            : " Authority is not asserted by social proof. Status, title, and persuasion do not change the decision."}
                      </p>
                    ) : null}
                  </div>
                </li>

                <li>
                  <span className="m09-mark">04</span>
                  <div>
                    <strong>{executionBlocked ? "Xact did not run the execution loadout." : "You ran the public-safe execution simulation."}</strong>
                    {execute ? (
                      executionBlocked ? (
                        <p>Commit was refused, so no substrate was selected and no effect was attempted. The zero-effect path is the correct governed outcome.</p>
                      ) : (
                        <p>
                          {execute.attempts.length} attempt{execute.attempts.length === 1 ? "" : "s"} logged.
                          {" "}Simulated substrates exercised: {[...new Set(execute.attempts.filter((a) => a.substrate !== "NONE").map((a) => a.substrate))].join(", ") || "none"}.
                          {" "}{decoy ? (
                            decoy.target === "AUTHORIZED"
                              ? <><br />Decoy challenge: you picked the authorized target. The public-safe effect simulation ran.</>
                              : <><br />Decoy challenge: you picked the decoy. Xact refused. The artifact-bound target check caught it.</>
                          ) : <>Decoy challenge: not attempted.</>}
                        </p>
                      )
                    ) : null}
                  </div>
                </li>

                <li>
                  <span className="m09-mark">05</span>
                  <div>
                    <strong>You inspected the resulting state.</strong>
                    {d.verify ? (
                      <p>
                        Evidence rows clicked: {d.verify.inspections.length} / 5. {executionBlocked
                          ? "Commit refusal and non-execution were verified; no effect was attempted."
                          : "The campaign’s simulated receipt and target binding were inspected. No claim of live control-room mutation was made."}
                      </p>
                    ) : null}
                  </div>
                </li>

                <li>
                  <span className="m09-mark">06</span>
                  <div>
                    <strong>You {absorbed ? "submitted" : declined ? "declined" : "made a governance decision"}.</strong>
                    {absorbed ? (
                      <p>The pattern was approved for activation.</p>
                    ) : declined ? (
                      <p>The pattern was not engaged. Reasoning will continue at the same rate.</p>
                    ) : null}
                  </div>
                </li>

                <li>
                  <span className="m09-mark">07</span>
                  <div>
                    <strong>You re-ran the scenario set.</strong>
                    {d.evolve ? (
                      <p>
                        {d.evolve.beforeCount} → {d.evolve.afterCount} O-Agent calls.
                        {" "}Delta: <strong style={{ color: absorbed ? "var(--lvl-acid)" : "var(--lvl-dim)" }}>
                          {absorbed ? `−${Math.round(((d.evolve.beforeCount - d.evolve.afterCount) / d.evolve.beforeCount) * 1000) / 10}%` : "0%"}
                        </strong>.
                        {" "}Artifact checksum: identical.
                      </p>
                    ) : null}
                  </div>
                </li>

                <li>
                  <span className="m09-mark">08</span>
                  <div>
                    <strong>You proposed {teach?.outcome === "ACCEPTED" ? "a bounded capability" : teach?.outcome === "REFUSED" ? "a capability Xact refused" : "nothing yet"}.</strong>
                    {teach ? (
                      <p>
                        Your capability: <code style={{ color: teach.outcome === "ACCEPTED" ? "var(--lvl-acid)" : "var(--lvl-red)" }}>“{teach.input}”</code>
                        <br />
                        {teach.reason}
                      </p>
                    ) : null}
                  </div>
                </li>
              </ol>

              <div className="lvl-card" style={{ borderColor: "var(--lvl-acid)" }}>
                <span className="k" style={{ color: "var(--lvl-acid)" }}>YOU TESTED XACT’S LEARNING BOUNDARY.</span>
                <span className="v" style={{ color: "var(--lvl-acid)" }}>Xact did not learn to overstep.</span>
                <p>
                  AUTHORITY ≠ SCORE. Reaching Level 09 did not increase your authority. It
                  increased your capability to experiment with — and every experiment you ran
                  was bound by the same checks. Xact is a consequence engine, not a permissions
                  engine.
                </p>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button type="button" className="lvl-advance" onClick={onReplay}>
                  <span className="arrow">▸</span>
                  <span className="verb-text">Replay this run</span>
                  <span className="label">Watch the trail</span>
                </button>
                <button
                  type="button"
                  className="lvl-advance"
                  style={{ background: "var(--lvl-surface-2)" }}
                  onClick={() => {
                    if (typeof window !== "undefined") {
                      window.localStorage.removeItem("xact.run.v1");
                      window.sessionStorage.removeItem("xact.authorized");
                      router.push("/");
                      router.refresh();
                    }
                  }}
                >
                  <span className="arrow">▸</span>
                  <span className="verb-text">New run</span>
                  <span className="label">Reset everything</span>
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
