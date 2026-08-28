/**
 * Governed capability construction vocabulary — Xact Foundry seed (ADR 0016).
 *
 * A bounded language of known-safe primitives from which governed capabilities
 * may be COMPOSED deterministically. It is deliberately not a code generator:
 * composing a descriptor never authorizes the capability's consequences.
 *
 * The sandbox already instantiates a small subset of this vocabulary:
 *   CandidateCapability             → READ_CAPABILITY (boundary-free seed)
 *   ServiceOperationsToolDescriptor → TOOL_DEFINITION + kind
 *   CommitConstraint                → COMMIT_BOUNDARY / ACTOR_BINDING / SESSION_REQUIREMENT
 *   AuthorizationArtifact           → EFFECT_FINGERPRINT
 *   ExecutionObservation / VerificationResult → OBSERVATION / VERIFICATION
 *
 * Post-challenge, Xact Foundry composes these primitives into WebMCP tools;
 * this module is the compiler front end, not the foundry itself.
 */

export type CapabilityPrimitive =
  | "TOOL_DEFINITION"
  | "INPUT_SCHEMA"
  | "OUTPUT_SCHEMA"
  | "READ_CAPABILITY"
  | "MUTATION_CAPABILITY"
  | "SESSION_REQUIREMENT"
  | "STATE_BINDING"
  | "ACTOR_BINDING"
  | "CONFIRMATION_REQUIREMENT"
  | "EFFECT_FINGERPRINT"
  | "OBSERVATION"
  | "VERIFICATION"
  | "AUDIT_EVENT"
  | "ERROR_CONTRACT"
  | "ROLLBACK_CAPABILITY"
  | "COMMIT_BOUNDARY";

export const CAPABILITY_PRIMITIVES: readonly CapabilityPrimitive[] = Object.freeze([
  "TOOL_DEFINITION",
  "INPUT_SCHEMA",
  "OUTPUT_SCHEMA",
  "READ_CAPABILITY",
  "MUTATION_CAPABILITY",
  "SESSION_REQUIREMENT",
  "STATE_BINDING",
  "ACTOR_BINDING",
  "CONFIRMATION_REQUIREMENT",
  "EFFECT_FINGERPRINT",
  "OBSERVATION",
  "VERIFICATION",
  "AUDIT_EVENT",
  "ERROR_CONTRACT",
  "ROLLBACK_CAPABILITY",
  "COMMIT_BOUNDARY",
]);

export type CapabilityKind = "READ" | "MUTATION";

export type LimitOperator = "<=" | "<" | "==" | ">=" | ">";

/**
 * One governed boundary instantiated from a construction primitive. The
 * optional fields carry the constraint this boundary instance enforces;
 * future slices add input/output schema payloads as the vocabulary grows.
 */
export interface CapabilityBoundary {
  primitive: CapabilityPrimitive;
  description: string;
  actor?: string;
  limit?: { operator: LimitOperator; value: number };
  freshnessRequired?: boolean;
  auditRequired?: boolean;
  confirmationRequired?: boolean;
  rollbackAvailable?: boolean;
}

export interface GovernedCapabilityDescriptor {
  readonly kind: "GOVERNED_CAPABILITY_DESCRIPTOR";
  readonly id: string;
  readonly capabilityKind: CapabilityKind;
  readonly label: string;
  /** The resolution surface this capability satisfies (future R fields). */
  readonly resolves: readonly string[];
  readonly boundaries: readonly CapabilityBoundary[];
}

/**
 * Compose a governed capability descriptor from the closed vocabulary.
 * Descriptive only: the returned descriptor has no execute / authorize /
 * commit / activate surface, and composing it grants no authority over any
 * consequence.
 */
export function describeCapability(input: {
  id: string;
  capabilityKind: CapabilityKind;
  label: string;
  resolves: readonly string[];
  boundaries?: readonly CapabilityBoundary[];
}): GovernedCapabilityDescriptor {
  if (!input.id.trim()) {
    throw new Error("A governed capability descriptor requires an id.");
  }
  for (const boundary of input.boundaries ?? []) {
    if (!CAPABILITY_PRIMITIVES.includes(boundary.primitive)) {
      throw new Error(`Unknown construction primitive: ${String(boundary.primitive)}.`);
    }
  }
  return Object.freeze({
    kind: "GOVERNED_CAPABILITY_DESCRIPTOR" as const,
    id: input.id,
    capabilityKind: input.capabilityKind,
    label: input.label,
    resolves: Object.freeze([...input.resolves]),
    boundaries: Object.freeze((input.boundaries ?? []).map((boundary) => Object.freeze({ ...boundary }))),
  });
}

/**
 * Recognition + validation of an existing descriptor (which may have been
 * assembled as a plain object, bypassing describeCapability). This is the
 * deterministic "recognize, do not compose" step: it validates against the
 * closed vocabulary and returns an inert result whose `composed` field is
 * typed `false` — a construction Node recognizes a governed capability without
 * generating a tool, effect, or artifact.
 */
export interface CapabilityRecognitionResult {
  readonly kind: "CAPABILITY_RECOGNITION";
  readonly recognized: boolean;
  readonly descriptorId: string;
  readonly capabilityKind: CapabilityKind;
  readonly checks: readonly string[];
  /** Type-level inertness: recognition never composes a tool, effect, or artifact. */
  readonly composed: false;
}

export function recognizeGovernedCapability(descriptor: GovernedCapabilityDescriptor): CapabilityRecognitionResult {
  const checks: string[] = [];
  if (!descriptor.id.trim()) {
    checks.push("Descriptor id is empty.");
  }
  if (descriptor.capabilityKind !== "READ" && descriptor.capabilityKind !== "MUTATION") {
    checks.push(`Unknown capability kind: ${String(descriptor.capabilityKind)}.`);
  }
  descriptor.resolves.forEach((field, index) => {
    if (typeof field !== "string" || !field.trim()) {
      checks.push(`resolves[${index}] is empty.`);
    }
  });
  for (const boundary of descriptor.boundaries) {
    if (!CAPABILITY_PRIMITIVES.includes(boundary.primitive)) {
      checks.push(`Boundary references unknown primitive: ${String(boundary.primitive)}.`);
      continue;
    }
    if (boundary.limit !== undefined && !Number.isFinite(boundary.limit.value)) {
      checks.push(`Boundary ${boundary.primitive} has a non-finite limit.`);
    }
  }
  return Object.freeze({
    kind: "CAPABILITY_RECOGNITION" as const,
    recognized: checks.length === 0,
    descriptorId: descriptor.id,
    capabilityKind: descriptor.capabilityKind,
    checks: Object.freeze([...checks]),
    composed: false as const,
  });
}
