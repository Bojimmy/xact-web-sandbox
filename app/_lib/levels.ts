// The 10 levels of the Xact demo. Each level is a proof, not a step.
// The verb is what the judge does. The "proves" is the technical claim.
// Sub-stages are the small visible sub-checks that have to pass before
// the level counts as "complete."

export type Accent = "acid" | "cyan" | "amber" | "red" | "slate";

export type SubStatus = "pending" | "active" | "complete";

export interface SubStage {
  key: string;
  label: string;
  status: SubStatus;
}

export interface Level {
  number: string; // "00" .. "09"
  key: string;
  verb: string; // AUTHORIZATION, RESOLVE, REASON, COMMIT, EXECUTE, VERIFY, ABSORB, EVOLVE, TEACH, YOUR RUN
  tagline: string; // one-line flavour text
  proves: string; // the technical claim
  substages: SubStage[];
  accent: Accent;
  // Optional: a headline stat that appears when this level completes.
  reward?: { label: string; value: string };
}

export const LEVELS: Level[] = [
  {
    number: "00",
    key: "authorization",
    verb: "AUTHORIZATION",
    tagline: "The participation agreement",
    proves: "Capability ≠ Authority",
    substages: [
      { key: "terms", label: "TERMS", status: "active" },
      { key: "consent", label: "CONSENT", status: "pending" },
    ],
    accent: "red",
  },
  {
    number: "01",
    key: "resolve",
    verb: "RESOLVE",
    tagline: "R / U / C decomposition",
    proves: "Determinism first",
    substages: [
      { key: "facts", label: "FACTS", status: "complete" },
      { key: "unresolved", label: "UNRESOLVED", status: "complete" },
      { key: "constraints", label: "CONSTRAINTS", status: "complete" },
    ],
    accent: "cyan",
    reward: { label: "Facts bound", value: "3" },
  },
  {
    number: "02",
    key: "reason",
    verb: "REASON",
    tagline: "Genuine U invokes the O-Agent",
    proves: "Reason only when necessary",
    substages: [
      { key: "u-detected", label: "U DETECTED", status: "complete" },
      { key: "o-agent", label: "O-AGENT", status: "complete" },
      { key: "evidence", label: "EVIDENCE", status: "complete" },
    ],
    accent: "amber",
    reward: { label: "Reasoning calls", value: "1" },
  },
  {
    number: "03",
    key: "commit",
    verb: "COMMIT",
    tagline: "Try allowed + forbidden consequences",
    proves: "Only Xact commits",
    substages: [
      { key: "policy", label: "POLICY", status: "complete" },
      { key: "authority", label: "AUTHORITY", status: "complete" },
      { key: "capability", label: "CAPABILITY", status: "complete" },
      { key: "binding", label: "BINDING", status: "complete" },
    ],
    accent: "cyan",
    reward: { label: "Commit checks", value: "4/4" },
  },
  {
    number: "04",
    key: "execute",
    verb: "EXECUTE",
    tagline: "WebMCP → DOM → Vision",
    proves: "Substrate can change",
    substages: [
      { key: "selected", label: "SELECTED", status: "complete" },
      { key: "fallback", label: "FALLBACK", status: "complete" },
      { key: "effect", label: "EFFECT", status: "complete" },
    ],
    accent: "acid",
    reward: { label: "Substrates", value: "3" },
  },
  {
    number: "05",
    key: "verify",
    verb: "VERIFY",
    tagline: "Evidence · state · checksum",
    proves: "Don't trust it — prove it",
    substages: [
      { key: "evidence", label: "EVIDENCE", status: "complete" },
      { key: "state", label: "STATE", status: "complete" },
      { key: "hash", label: "CHECKSUM", status: "complete" },
    ],
    accent: "cyan",
    reward: { label: "Verifications", value: "3/3" },
  },
  {
    number: "06",
    key: "absorb",
    verb: "ABSORB",
    tagline: "Door → Ledger → Effectiveness → Governance",
    proves: "Governed learning",
    substages: [
      { key: "door", label: "DOOR", status: "complete" },
      { key: "ledger", label: "LEDGER", status: "complete" },
      { key: "effective", label: "EFFECTIVE", status: "complete" },
      { key: "governance", label: "GOVERNANCE", status: "active" },
    ],
    accent: "amber",
    reward: { label: "Lifecycle", value: "CANDIDATE" },
  },
  {
    number: "07",
    key: "evolve",
    verb: "EVOLVE",
    tagline: "Reasoning becomes rarer",
    proves: "30 → 4 O-Agent calls (−86.7%)",
    substages: [
      { key: "observe", label: "OBSERVE", status: "complete" },
      { key: "validate", label: "VALIDATE", status: "complete" },
      { key: "approved", label: "APPROVED", status: "complete" },
      { key: "activated", label: "ACTIVATED", status: "active" },
    ],
    accent: "acid",
    reward: { label: "Reduction", value: "−86.7%" },
  },
  {
    number: "08",
    key: "teach",
    verb: "TEACH XACT",
    tagline: "Judge proposes a bounded WebMCP ability",
    proves: "The judge can propose; governance decides",
    substages: [
      { key: "define", label: "DEFINE", status: "pending" },
      { key: "bound", label: "BOUND", status: "pending" },
      { key: "test", label: "TEST", status: "pending" },
    ],
    accent: "amber",
  },
  {
    number: "09",
    key: "your-run",
    verb: "YOUR RUN",
    tagline: "Evidence-grounded explainer",
    proves: "Xact explains what *they* just proved",
    substages: [
      { key: "capture", label: "CAPTURE", status: "pending" },
      { key: "render", label: "RENDER", status: "pending" },
      { key: "share", label: "SHARE", status: "pending" },
    ],
    accent: "slate",
  },
];

export const ACCENT_VAR: Record<Accent, { main: string; glow: string; soft: string }> = {
  acid:  { main: "#c9f43d", glow: "rgb(201 244 61 / 35%)",  soft: "rgb(201 244 61 / 14%)" },
  cyan:  { main: "#5fb4d4", glow: "rgb(95 180 212 / 35%)", soft: "rgb(95 180 212 / 14%)" },
  amber: { main: "#f0b54d", glow: "rgb(240 181 77 / 35%)",  soft: "rgb(240 181 77 / 14%)" },
  red:   { main: "#ff6b52", glow: "rgb(255 107 82 / 35%)",  soft: "rgb(255 107 82 / 14%)" },
  slate: { main: "#9aa6b3", glow: "rgb(154 166 179 / 25%)", soft: "rgb(154 166 179 / 10%)" },
};
