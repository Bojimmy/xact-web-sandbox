import type { ReferenceEvolutionResults } from "./contracts";

export const referenceEvolutionResults: ReferenceEvolutionResults = Object.freeze({
  kind: "REFERENCE_RESULTS",
  appliesTo: "REFERENCE_IMPLEMENTATION_NOT_SANDBOX",
  deterministicCoverage: { beforePercent: 86.9, afterPercent: 97.5 },
  reasoningFrequency: { beforePercent: 13.1, afterPercent: 2.5 },
  promotedPatterns: 407,
  exactMatchRouting: { maintained: 3_314, total: 3_400 },
  provenance: "Historical evidence supplied for the reference Xact implementation.",
});
