/**
 * Public-safe deterministic X-Node plan for a promotional email campaign.
 *
 * This is preparation only: the plan selects a mock audience and composes
 * drafts. It has no email-account access, delivery handler, or authority
 * surface. A later delivery tool must obtain a fresh, exact Commit.
 */

export interface PromotionRecipient {
  readonly customerId: string;
  readonly name: string;
  readonly email: string;
  readonly segment: "ACTIVE" | "RETURNING";
  readonly subject: string;
}

export interface CampaignNodeOutcome {
  readonly id: string;
  readonly label: string;
  readonly operations: number;
  readonly status: "COMPLETE";
}

export interface CampaignPreparation {
  readonly campaign: string;
  readonly status: "DRAFTS_PREPARED_NO_SEND_AUTHORITY";
  readonly rotation: string;
  readonly nextRun: string;
  readonly recipients: readonly PromotionRecipient[];
  readonly nodes: readonly CampaignNodeOutcome[];
  readonly totalOperations: number;
}

const recipients: readonly PromotionRecipient[] = Object.freeze(Array.from({ length: 128 }, (_, index) => {
  const number = String(index + 1).padStart(3, "0");
  const named = [
    { name: "Ada", email: "ada@example.com" },
    { name: "Lin", email: "lin@example.com" },
    { name: "Maya", email: "maya@example.com" },
    { name: "Jon", email: "jon@example.com" },
    { name: "Nora", email: "nora@example.com" },
    { name: "Eli", email: "eli@example.com" },
  ][index];
  const name = named?.name ?? `Customer ${number}`;
  return Object.freeze({
    customerId: `promo-${number}`,
    name,
    email: named?.email ?? `customer-${number}@example.com`,
    segment: index % 4 === 0 ? "RETURNING" as const : "ACTIVE" as const,
    subject: index % 3 === 0 ? `${name}, enjoy 20% off your next order` : index % 3 === 1 ? `${name}, your weekly member offer is here` : `${name}, a limited-time promotion for you`,
  });
}));

const nodes: readonly CampaignNodeOutcome[] = Object.freeze([
  { id: "brief", label: "Validate campaign brief", operations: 1, status: "COMPLETE" },
  { id: "audience", label: "Load approved audience", operations: recipients.length, status: "COMPLETE" },
  { id: "segment", label: "Segment eligible recipients", operations: recipients.length, status: "COMPLETE" },
  { id: "personalize", label: "Personalize promotion subjects", operations: recipients.length, status: "COMPLETE" },
  { id: "compose", label: "Compose email drafts", operations: recipients.length, status: "COMPLETE" },
  { id: "schedule", label: "Project campaign rotation", operations: 1, status: "COMPLETE" },
  { id: "audit", label: "Package preparation audit", operations: 1, status: "COMPLETE" },
]);

/** Runs every deterministic campaign-preparation node; no email is sent. */
export function preparePromotionalEmailCampaign(): CampaignPreparation {
  return Object.freeze({
    campaign: "Weekly promotion email — active customers",
    status: "DRAFTS_PREPARED_NO_SEND_AUTHORITY" as const,
    rotation: "Every Tuesday · 09:00 local time",
    nextRun: "Tuesday 09:00 (mock schedule)",
    recipients,
    nodes,
    totalOperations: nodes.reduce((total, node) => total + node.operations, 0),
  });
}
