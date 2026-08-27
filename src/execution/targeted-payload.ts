/** Target identity must be included inside the effect payload fingerprint. */
export interface TargetedExecutionPayload {
  target: string;
}

/** Exact visual identity expected at activation time; all fields are bound in the effect fingerprint. */
export interface VisionTargetDescriptor {
  targetId: string;
  role: string;
  name: string;
  origin: string;
  frameId: string;
  pageRevision: string;
}

export interface VisionTargetedExecutionPayload extends TargetedExecutionPayload {
  visionTarget: VisionTargetDescriptor;
}

export function targetFromPayload(payload: unknown): string {
  const target = payload && typeof payload === "object"
    ? (payload as Partial<TargetedExecutionPayload>).target
    : undefined;
  if (typeof target !== "string" || target.length === 0) {
    throw new Error("Execution payload has no bound target.");
  }
  return target;
}

export function visionTargetFromPayload(payload: unknown): VisionTargetDescriptor {
  const descriptor = payload && typeof payload === "object"
    ? (payload as Partial<VisionTargetedExecutionPayload>).visionTarget
    : undefined;
  if (
    !descriptor || descriptor.targetId !== targetFromPayload(payload)
    || !descriptor.role || !descriptor.name || !descriptor.origin
    || !descriptor.frameId || !descriptor.pageRevision
  ) {
    throw new Error("Execution payload has no complete bound Vision target descriptor.");
  }
  return descriptor;
}

export function sameVisionTarget(
  expected: VisionTargetDescriptor,
  located: VisionTargetDescriptor,
): boolean {
  return expected.targetId === located.targetId
    && expected.role === located.role
    && expected.name === located.name
    && expected.origin === located.origin
    && expected.frameId === located.frameId
    && expected.pageRevision === located.pageRevision;
}
