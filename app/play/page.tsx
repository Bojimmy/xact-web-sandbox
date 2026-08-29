"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { LevelShell } from "../_components/LevelShell";
import { AuthorityVsScore } from "../_components/AuthorityVsScore";
import { TransitionScreen, type TransitionKind } from "../_components/TransitionScreen";
import { Mission00Authorize } from "../_components/missions/Mission00Authorize";
import { Mission01Resolve } from "../_components/missions/Mission01Resolve";
import { Mission02Reason } from "../_components/missions/Mission02Reason";
import { Mission03Commit } from "../_components/missions/Mission03Commit";
import { Mission04Execute } from "../_components/missions/Mission04Execute";
import { Mission05Verify } from "../_components/missions/Mission05Verify";
import { Mission06Absorb } from "../_components/missions/Mission06Absorb";
import { Mission07Evolve } from "../_components/missions/Mission07Evolve";
import { Mission08Teach } from "../_components/missions/Mission08Teach";
import { Mission09YourRun } from "../_components/missions/Mission09YourRun";
import {
  freshRun,
  isLevelUnlocked,
  readRun,
  writeRun,
  clearRun,
  LEVEL_VERB_PAST,
  LEVEL_VERB_PRESENT,
  LEVEL_PROVES,
  LEVEL_INSTRUCTION,
  type Run,
  type CommitAction,
  type CommitOutcome,
  type TeachOutcome,
} from "../_lib/run";
import { levelCompletionLabel } from "../_lib/campaign-policy";
import { assessResolutionRequest } from "../_lib/resolution-policy";

type TransitionState =
  | null
  | { kind: TransitionKind; stamp: string; headline?: string; stat?: string; before?: string; after?: string; qualifier?: string; verdict?: string; nextIndex: number; autoMs?: number };

export default function PlayPage() {
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);
  const [run, setRun] = useState<Run | null>(null);
  const [transition, setTransition] = useState<TransitionState>(null);

  useEffect(() => {
    let stored = readRun();
    if (!stored) {
      // No run yet — they're authorized but never started. Boot a fresh run at L00.
      stored = freshRun();
      stored.currentLevel = 0;
      writeRun(stored);
    }
    // Browser-owned run state is intentionally hydrated after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRun(stored);
    setHydrated(true);
  }, []);

  const updateRun = useCallback((patch: Partial<Run> | ((r: Run) => Run)) => {
    setRun((prev) => {
      if (!prev) return prev;
      const next = typeof patch === "function" ? patch(prev) : { ...prev, ...patch };
      writeRun(next);
      return next;
    });
  }, []);

  const advanceTo = useCallback((nextIndex: number) => {
    updateRun((r) => ({ ...r, currentLevel: Math.max(0, Math.min(9, nextIndex)) }));
    setTransition(null);
  }, [updateRun]);

  const markComplete = useCallback((level: number) => {
    updateRun((r) => {
      if (r.completed.includes(level)) return r;
      return { ...r, completed: [...r.completed, level] };
    });
  }, [updateRun]);

  const completeMission = useCallback((level: number, transitionOverride?: TransitionState) => {
    markComplete(level);
    if (level >= 9) return; // Last level — stay
    const next = level + 1;
    if (transitionOverride) {
      setTransition(transitionOverride);
    } else {
      setTransition({
        kind: "experience",
        stamp: "LEVEL COMPLETE",
        headline: `${LEVEL_VERB_PAST[level]} PROVEN`,
        stat: "✓",
        verdict: LEVEL_PROVES[level],
        nextIndex: next,
        autoMs: 1600,
      });
    }
  }, [markComplete]);

  // Mission handlers ───────────────────────────────────────────────

  function handleAuthorize(result: "AGREE" | "DENY") {
    if (!run) return;
    if (result === "AGREE") {
      updateRun((r) => ({
        ...r,
        data: { ...r.data, authorize: { result: "AGREE", ts: Date.now() } },
      }));
      completeMission(0, {
        kind: "experience",
        stamp: "AUTHORITY GRANTED",
        headline: "LEVEL 00 COMPLETE",
        stat: "9",
        verdict: "Levels remaining · 9",
        nextIndex: 1,
        autoMs: 1300,
      });
    } else {
      updateRun((r) => {
        const next = { ...r, denialCount: r.denialCount + 1 };
        return {
          ...next,
          data: { ...next.data, authorize: { result: "DENY", ts: Date.now() } },
        };
      });
    }
  }

  function handleReconsider() {
    updateRun((r) => ({
      ...r,
      data: { ...r.data, authorize: undefined },
    }));
  }

  function handleResolveSubmit(request: string) {
    if (!run) return;
    const assessment = assessResolutionRequest(request);
    updateRun((r) => ({
      ...r,
      data: { ...r.data, resolve: { request, facts: assessment.facts, unresolved: assessment.unresolved, completed: true, ts: Date.now() } },
    }));
    completeMission(1, {
      kind: "experience",
      stamp: "EXPERIENCE GAINED",
      headline: "DETERMINISM PROVEN",
      stat: "0",
      verdict: "O-Agent invocations this mission · reasoning reserved for genuine U",
      nextIndex: 2,
      autoMs: 1500,
    });
  }

  function handleReasonSubmit(input: string, ambiguity: boolean) {
    if (!run) return;
    updateRun((r) => ({
      ...r,
      data: { ...r.data, reason: { input, ambiguity, oAgentInvoked: ambiguity, completed: true, ts: Date.now() } },
    }));
    completeMission(2, {
      kind: "experience",
      stamp: "EXPERIENCE GAINED",
      headline: ambiguity ? "REASONING WAS NECESSARY" : "REASONING NOT NECESSARY",
      stat: ambiguity ? "1" : "0",
      verdict: ambiguity ? "O-Agent invoked for the genuine U" : "O-Agent not invoked. No semantic gap.",
      nextIndex: 3,
      autoMs: 1500,
    });
  }

  function handleCommitChoose(action: CommitAction, outcome: CommitOutcome) {
    if (!run) return;
    updateRun((r) => ({
      ...r,
      data: { ...r.data, commit: { action, outcome, completed: true, ts: Date.now() } },
    }));
    if (outcome === "AUTHORIZED") {
      completeMission(3, {
        kind: "experience",
        stamp: "COMMIT ACCEPTED",
        headline: "AUTHORIZED",
        stat: "4/4",
        verdict: "Policy · Authority · Capability · State binding — all pass.",
        nextIndex: 4,
        autoMs: 1500,
      });
    } else if (outcome === "REJECTED_EXCESS") {
      completeMission(3, {
        kind: "experience",
        stamp: "COMMIT REFUSED",
        headline: "EXCESS VS. POLICY",
        stat: "✕",
        verdict: "You successfully discovered that $12,900 is not authorized by a $100 ceiling.",
        nextIndex: 4,
        autoMs: 1800,
      });
    } else if (outcome === "REJECTED_SOCIAL") {
      completeMission(3, {
        kind: "experience",
        stamp: "COMMIT REFUSED",
        headline: "SOCIAL PROOF ≠ AUTHORITY",
        stat: "✕",
        verdict: "You successfully discovered that confidence and job title are not authorization.",
        nextIndex: 4,
        autoMs: 1800,
      });
    } else {
      completeMission(3, {
        kind: "experience",
        stamp: "COMMIT REFUSED",
        headline: "CONSTRAINT NOT SATISFIED",
        stat: "✕",
        verdict: "The resolved request carried an unbound constraint into Commit. No authority was issued.",
        nextIndex: 4,
        autoMs: 1800,
      });
    }
  }

  function handleExecuteComplete(execData: Run["data"]["execute"]) {
    if (!run) return;
    updateRun((r) => ({
      ...r,
      data: { ...r.data, execute: execData },
    }));
    if (execData!.disposition === "BLOCKED_NO_AUTHORITY") {
      completeMission(4, {
        kind: "experience",
        stamp: "EXECUTION REFUSED",
        headline: "NO AUTHORITY · NO EFFECT",
        stat: "0",
        verdict: "No substrate selected. No consequence attempted. The Commit boundary held.",
        nextIndex: 5,
        autoMs: 1700,
      });
      return;
    }

    const subCount = new Set(execData!.attempts.filter((a) => a.substrate !== "NONE").map((a) => a.substrate)).size;
    const decoyOk = execData!.decoy?.outcome === "BLOCKED" || execData!.decoy?.outcome === "EXECUTED";
    completeMission(4, {
      kind: "experience",
      stamp: "SIMULATION COMPLETE",
      headline: `${execData!.attempts.length} ATTEMPTS LOGGED`,
      stat: subCount > 1 ? `${subCount} substrates` : `${subCount} substrate`,
      verdict: decoyOk
        ? execData!.decoy!.outcome === "BLOCKED"
          ? "You tried to use the decoy. Xact refused. The artifact-bound target check caught it."
          : "You picked the authorized target. The public-safe effect simulation ran."
        : "Substrate fallback demonstrated.",
      nextIndex: 5,
      autoMs: 1500,
    });
  }

  function handleVerifyComplete(inspections: string[]) {
    if (!run) return;
    updateRun((r) => ({
      ...r,
      data: { ...r.data, verify: { inspections, completed: true, ts: Date.now() } },
    }));
    completeMission(5, {
      kind: "experience",
      stamp: "VERIFIED",
      headline: "STATE INSPECTED",
      stat: `${inspections.length}/5`,
      verdict: run.data.commit?.outcome === "AUTHORIZED"
        ? "Simulation evidence · target binding · provenance — inspected."
        : "Commit refusal · zero-effect record · non-execution — inspected.",
      nextIndex: 6,
      autoMs: 1500,
    });
  }

  function handleAbsorbComplete(decision: "SUBMIT" | "DECLINE") {
    if (!run) return;
    updateRun((r) => ({
      ...r,
      data: {
        ...r.data,
        absorb: { decision, evidence: { door: true, ledger: true, effective: true }, completed: true, ts: Date.now() },
      },
    }));
    if (decision === "SUBMIT") {
      completeMission(6, {
        kind: "evolved",
        stamp: "GOVERNANCE DECISION",
        headline: "APPROVED",
        before: "30",
        after: "0",
        stat: "→",
        verdict: "Activation proceeds. The O-Agent invocation is recorded but not repeated.",
        nextIndex: 7,
      });
    } else {
      completeMission(6, {
        kind: "experience",
        stamp: "GOVERNANCE NOT ENGAGED",
        headline: "DECLINE RECORDED",
        stat: "0",
        verdict: "Reasoning will continue at the same rate. The cost shows at Level 07.",
        nextIndex: 7,
        autoMs: 1500,
      });
    }
  }

  function handleEvolveComplete(before: number, after: number) {
    if (!run) return;
    const absorbed = run.data.absorb?.decision === "SUBMIT";
    updateRun((r) => ({
      ...r,
      data: { ...r.data, evolve: { beforeCount: before, afterCount: after, completed: true, ts: Date.now() } },
    }));
    const pct = absorbed ? Math.round(((before - after) / before) * 1000) / 10 : 0;
    completeMission(7, {
      kind: absorbed ? "evolve-stat" : "experience",
      stamp: "XACT EVOLVED",
      headline: absorbed ? "REASONING REDUCTION" : "NO REDUCTION",
      stat: absorbed ? `−${pct}%` : "0%",
      before: absorbed ? `${before} → ${after}` : undefined,
      after: undefined,
      verdict: absorbed
        ? "Artifact checksum identical. No capability creep."
        : "The decline at Level 06 produced no measurable improvement.",
      qualifier: absorbed ? "Capability activated. Authority unchanged." : undefined,
      nextIndex: 8,
      ...(absorbed ? {} : { autoMs: 1700 }),
    });
  }

  function handleTeachComplete(input: string, bounded: boolean, outcome: TeachOutcome, reason: string) {
    if (!run) return;
    updateRun((r) => ({
      ...r,
      data: { ...r.data, teach: { input, bounded, outcome, reason, completed: true, ts: Date.now() } },
    }));
    completeMission(8, {
      kind: "experience",
      stamp: outcome === "ACCEPTED" ? "PROPOSAL ACCEPTED" : "PROPOSAL REFUSED",
      headline: outcome === "ACCEPTED" ? "BOUNDED · READY FOR GOVERNANCE" : "XACT DID NOT LEARN TO OVERSTEP",
      stat: outcome === "ACCEPTED" ? "✓" : "✕",
      verdict: reason,
      nextIndex: 9,
      autoMs: 1800,
    });
  }

  function handleReplay() {
    clearRun();
    router.push("/play");
    router.refresh();
  }

  // ─── Render ───────────────────────────────────────────────────────

  if (!hydrated || !run) return null;

  const current = run.currentLevel;
  const statusLabel = current === 0 && !run.completed.includes(0)
    ? "AWAITING COMPLIANCE"
    : current === 4 && run.data.commit?.outcome !== "AUTHORIZED"
      ? "EXECUTION AUTHORITY NOT ESTABLISHED"
      : `${run.completed.includes(current)
          ? levelCompletionLabel(current, run.data.commit?.outcome)
          : LEVEL_VERB_PRESENT[current]}`;
  const currentInstruction = current === 4 && run.data.commit?.outcome !== "AUTHORIZED"
    ? "Inspect the refused Commit. Record that no substrate was selected and no consequence was attempted."
    : LEVEL_INSTRUCTION[current];

  // For the level ladder: if a level is complete, show the past-tense verb.
  const transitionView = transition ? (
    <TransitionScreen
      kind={transition.kind}
      stamp={transition.stamp}
      headline={transition.headline}
      stat={transition.stat}
      before={transition.before}
      after={transition.after}
      qualifier={transition.qualifier}
      verdict={transition.verdict}
      onContinue={() => advanceTo(transition.nextIndex)}
      autoContinueMs={transition.autoMs}
    />
  ) : null;

  return (
    <>
      <LevelShell
        run={run}
        onJump={(i) => {
          if (isLevelUnlocked(run, i) || run.completed.includes(i)) {
            updateRun({ currentLevel: i });
          }
        }}
        statusLabel={statusLabel}
        showLadder
        showSide
        side={
          <>
            <h4>Current mission <span className="now">{LEVEL_VERB_PRESENT[current]}</span></h4>
            <div className="lvl-stat-block">
              <span className="k">YOU MUST</span>
              <span className="v" style={{ fontSize: 13, lineHeight: 1.35 }}>{currentInstruction}</span>
            </div>
            <h4>This run <span className="now">{run.id.slice(-6)}</span></h4>
            <div className="lvl-meter">
              <div className="row"><span>Levels complete</span><span className="v acid">{String(run.completed.length).padStart(2, "0")} / 10</span></div>
              <div className="row"><span>Denials this run</span><span className="v red">{String(run.denialCount).padStart(3, "0")}</span></div>
              <div className="row"><span>Trace</span><span className="v">{run.traceId}</span></div>
              <div className="row"><span>Authority ≠ Score</span><span className="v acid">Holds.</span></div>
            </div>
            <p className="lvl-quote">
              You don’t progress by clicking. You progress by proving.
            </p>
          </>
        }
      >
        <main className="lvl-main">
          <AuthorityVsScore />
          {current === 0 && (
            <Mission00Authorize
              run={run}
              onAgree={() => handleAuthorize("AGREE")}
              onDeny={() => handleAuthorize("DENY")}
              onReconsider={handleReconsider}
            />
          )}
          {current === 1 && run.completed.includes(0) && (
            <Mission01Resolve run={run} onComplete={handleResolveSubmit} />
          )}
          {current === 2 && run.completed.includes(1) && (
            <Mission02Reason run={run} onComplete={handleReasonSubmit} />
          )}
          {current === 3 && run.completed.includes(2) && (
            <Mission03Commit run={run} onComplete={handleCommitChoose} />
          )}
          {current === 4 && run.completed.includes(3) && (
            <Mission04Execute run={run} onComplete={handleExecuteComplete} />
          )}
          {current === 5 && run.completed.includes(4) && (
            <Mission05Verify run={run} onComplete={handleVerifyComplete} />
          )}
          {current === 6 && run.completed.includes(5) && (
            <Mission06Absorb run={run} onComplete={handleAbsorbComplete} />
          )}
          {current === 7 && run.completed.includes(6) && (
            <Mission07Evolve run={run} onComplete={handleEvolveComplete} />
          )}
          {current === 8 && run.completed.includes(7) && (
            <Mission08Teach run={run} onComplete={handleTeachComplete} />
          )}
          {current === 9 && run.completed.includes(8) && (
            <Mission09YourRun run={run} onReplay={handleReplay} />
          )}
        </main>
      </LevelShell>
      {transitionView}
    </>
  );
}
