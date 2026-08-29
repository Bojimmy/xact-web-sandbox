import {
  XactFoundryLiaison,
  type FoundryActivity,
  type FoundryBuildResult,
} from "./foundry-liaison";
import {
  FoundryWebMCPRegistrationHost,
  type FoundryWebMCPHost,
  type RegistrationEvent,
  type RegistrationResult,
} from "./webmcp-host-registration";
import type { WebMCPToolDefinition } from "./webmcp-tool-builder";
import type { AuthorizedEffect } from "../execution/contracts";

/**
 * The single entry point that chains build → register (ADR 0019).
 *
 *   buildAndRegister(intent)
 *     → buildCapability  (RESOLVE … BUILD → COMPOSED_DEFINITION)
 *     → registerTool    (REGISTER → OBSERVE → VERIFY → WORKING_TOOL)
 *
 * Rules:
 *  - Registers ONLY a COMPOSED_DEFINITION result. BLOCKED and PENDING_GOVERNANCE
 *    never register.
 *  - REGISTER/OBSERVE/VERIFY are actual emitted host events, merged into one
 *    ordered activity stream — never inferred UI state.
 *  - Registration never executes the tool; the execute handler is injected.
 */

export type BuildAndRegisterOutcome =
  | "WORKING_TOOL"
  | "COMPOSED_DEFINITION"
  | "BLOCKED"
  | "PENDING_GOVERNANCE"
  | "REGISTRATION_FAILED";

export interface BuildAndRegisterResult {
  intent: string;
  outcome: BuildAndRegisterOutcome;
  activity: FoundryActivity[];
  build: FoundryBuildResult;
  registration?: RegistrationResult;
  tool?: WebMCPToolDefinition;
}

function toActivity(event: RegistrationEvent): FoundryActivity {
  return { type: event.type, label: event.label, detail: event.detail, status: event.status };
}

/**
 * A Commit-gated execute handler for MUTATION tools. Each invocation claims a
 * prepared AuthorizedEffect from the dispatch source — typically
 * WebMCPDispatchRegistry.claim(input) — which returns a result only when the
 * input's authorizationArtifact AND effect match the prepared effect exactly
 * (by stableFingerprint). Without a matching prepared effect it fails closed.
 * It returns the claimed effect's artifact as evidence of authorization, never
 * the effect itself and never a tampered value.
 */
export function commitGatedExecute(
  claimDispatch: (input: unknown) => AuthorizedEffect | undefined,
): (input: unknown) => Promise<unknown> {
  return async (input) => {
    const effect = claimDispatch(input);
    if (!effect) {
      throw new Error("No fresh Commit authorization for this exact consequence.");
    }
    return { authorized: true, artifact: effect.artifact };
  };
}

export async function buildAndRegister(
  intent: string,
  options: {
    liaison?: XactFoundryLiaison;
    registration?: FoundryWebMCPRegistrationHost;
    host?: FoundryWebMCPHost;
    executeFor?: (tool: WebMCPToolDefinition) => (input: unknown) => Promise<unknown>;
    onActivity?: (activity: FoundryActivity) => void;
  },
): Promise<BuildAndRegisterResult> {
  const liaison = options.liaison ?? new XactFoundryLiaison();
  const registration = options.registration ?? new FoundryWebMCPRegistrationHost();
  const activity: FoundryActivity[] = [];
  const emit = (a: FoundryActivity) => { activity.push(a); options.onActivity?.(a); };

  const build = await liaison.buildCapability(intent, emit);

  // Register only a composed definition; blocked / pending-governance never register.
  if (build.outcome !== "COMPOSED_DEFINITION" || !build.tool) {
    return { intent, outcome: build.outcome, activity, build };
  }

  if (!options.host) {
    return { intent, outcome: "COMPOSED_DEFINITION", activity, build, tool: build.tool };
  }

  const tool = build.tool;
  const execute = options.executeFor?.(tool)
    ?? (async () => { throw new Error("No execute handler supplied for registration."); });

  const regResult = await registration.registerTool(tool, options.host, execute, (e) => emit(toActivity(e)));

  return {
    intent,
    outcome: regResult.outcome === "WORKING_TOOL" ? "WORKING_TOOL" : "REGISTRATION_FAILED",
    activity,
    build,
    registration: regResult,
    tool,
  };
}
