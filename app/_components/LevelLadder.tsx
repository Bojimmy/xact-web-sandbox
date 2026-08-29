"use client";

import { LEVEL_VERB_PRESENT, type Run } from "../_lib/run";
import { levelCompletionLabel } from "../_lib/campaign-policy";

// The vertical "10 levels" rail with the locked ladder state the user
// specced: ● completed / ○ current / 🔒 locked. Completed levels use the
// past-tense verb (AUTHORIZED, RESOLVED, REASONED, ...).
export function LevelLadder({
  run,
  onJump,
}: {
  run: Run;
  onJump: (index: number) => void;
}) {
  const totalLevels = 10;
  const current = run.currentLevel;
  const completedCount = run.completed.length;
  return (
    <aside className="lvl-ladder" aria-label="Level ladder">
      <div className="lvl-ladder-head">
        <span>Run</span>
        <strong>{String(completedCount).padStart(2, "0")} / {String(totalLevels).padStart(2, "0")}</strong>
      </div>
      <ol className="lvl-ladder-list">
        {Array.from({ length: totalLevels }).map((_, i) => {
          const isComplete = run.completed.includes(i);
          const isActive = i === current;
          const isLocked = !isComplete && !isActive;
          const verb = isComplete
            ? levelCompletionLabel(i, run.data.commit?.outcome)
            : LEVEL_VERB_PRESENT[i];
          return (
            <li
              key={i}
              className={
                isActive ? "is-active" :
                isComplete ? "is-complete" :
                isLocked ? "is-locked" : ""
              }
              onClick={() => {
                if (!isLocked || isComplete) onJump(i);
              }}
              role="button"
              tabIndex={isLocked ? -1 : 0}
              aria-current={isActive ? "step" : undefined}
              aria-disabled={isLocked}
            >
              <span className="num">{String(i).padStart(2, "0")}</span>
              <span className="verb">{verb}</span>
              <span className="mark">{isComplete ? "●" : isActive ? "○" : "🔒"}</span>
            </li>
          );
        })}
      </ol>
      <div className="lvl-ladder-foot">
        <span>Authority</span>
        <strong style={{ color: "var(--lvl-cyan)" }}>≠</strong>
      </div>
    </aside>
  );
}
