"use client";

import { createContext, useContext, useMemo, useState } from "react";
import type { WebMCPToolDefinition } from "../../src/flagship/webmcp-tool-builder";
import { defaultFoundryProfile, type FoundryProfile } from "../../src/flagship/foundry-profile";
import { stableFingerprint } from "../../src/xact/authorization-artifact";

interface FoundrySessionValue {
  readonly tools: readonly WebMCPToolDefinition[];
  readonly profile: FoundryProfile;
  addTool: (tool: WebMCPToolDefinition) => void;
  updateProfile: (changes: Partial<Omit<FoundryProfile, "version">>) => void;
}

const FoundrySessionContext = createContext<FoundrySessionValue | undefined>(undefined);

function toolContractKey(tool: WebMCPToolDefinition): string {
  return stableFingerprint({ name: tool.name, capabilityKind: tool.capabilityKind, inputSchema: tool.inputSchema, boundaries: tool.boundaries, requiresCommit: tool.requiresCommit });
}

/** In-memory session shelf shared by Boss Chat and the Foundry Catalog. */
export function FoundrySessionProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const [tools, setTools] = useState<readonly WebMCPToolDefinition[]>([]);
  const [profile, setProfile] = useState<FoundryProfile>(defaultFoundryProfile);
  const value = useMemo<FoundrySessionValue>(() => ({
    tools,
    profile,
    addTool: (tool) => setTools((current) => current.some((existing) => toolContractKey(existing) === toolContractKey(tool)) ? current : [...current, tool]),
    updateProfile: (changes) => setProfile((current) => ({ ...current, ...changes, version: current.version + 1 })),
  }), [profile, tools]);
  return <FoundrySessionContext.Provider value={value}>{children}</FoundrySessionContext.Provider>;
}

export function useFoundrySession(): FoundrySessionValue {
  const value = useContext(FoundrySessionContext);
  if (!value) throw new Error("Foundry session is unavailable outside the Foundry route.");
  return value;
}
