export const SCALE_TOTAL_OPERATIONS = 10_011;
export const SCALE_DEPENDENCY_STAGES = 47;
/**
 * Chosen from the recorded Chrome sweep: the former 160-round default measured
 * worker-start/message overhead, not useful deterministic parallel work.
 * This remains fixed work (not a timer or artificial delay).
 */
export const SCALE_WORK_ROUNDS = 50_000;

export interface ScaleStage { stage: number; start: number; count: number; }

/** A 47-stage graph with ~213 independent deterministic operations per stage. */
export function createScaleGraph(): ScaleStage[] {
  const base = Math.floor(SCALE_TOTAL_OPERATIONS / SCALE_DEPENDENCY_STAGES);
  const remainder = SCALE_TOTAL_OPERATIONS % SCALE_DEPENDENCY_STAGES;
  let start = 0;
  return Array.from({ length: SCALE_DEPENDENCY_STAGES }, (_, stage) => {
    const count = base + (stage < remainder ? 1 : 0);
    const node = { stage, start, count };
    start += count;
    return node;
  });
}

function fingerprint(value: string): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

/**
 * Actual deterministic construction work: compose descriptor fields, validate
 * the schema/binding, evaluate constraints, and fingerprint the artifact.
 */
export function executeDeterministicRange(start: number, count: number): { checksum: number; completed: number } {
  let checksum = 0;
  for (let operation = start; operation < start + count; operation += 1) {
    const descriptor = `component:${operation}:table|store:local|binding:quantity|constraint:nonnegative`;
    const valid = descriptor.includes("component:") && descriptor.includes("binding:quantity") && descriptor.endsWith("nonnegative");
    if (!valid) throw new Error("Deterministic construction descriptor validation failed.");
    let value = fingerprint(descriptor);
    for (let round = 0; round < SCALE_WORK_ROUNDS; round += 1) {
      value = Math.imul(value ^ (operation + round), 16_777_619) >>> 0;
    }
    checksum = (checksum ^ value) >>> 0;
  }
  return { checksum, completed: count };
}
