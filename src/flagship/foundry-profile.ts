import type { CampaignBuildBrief } from "./promotional-campaign-nodes";

/**
 * Explicit, judge-controlled defaults for this in-memory Foundry session.
 * They accelerate proposals and draft preparation; they are neither authority
 * nor a policy/Commit substitute.
 */
export interface FoundryProfile {
  readonly version: number;
  readonly companyName: string;
  readonly focus: "CUSTOMER_OPERATIONS" | "CAMPAIGN_OPERATIONS";
  readonly approvedAudience: "FOUNDRY_MOCK_CUSTOMER_DIRECTORY";
  readonly deliveryMode: "DRAFT_ONLY";
  readonly brandVoice: string;
  readonly campaignStyle: string;
  readonly campaignOffer: string;
  readonly defaultActor: string;
  readonly serviceCreditCeiling: string;
}

export const defaultFoundryProfile: FoundryProfile = Object.freeze({
  version: 1,
  companyName: "Xact Demo",
  focus: "CUSTOMER_OPERATIONS",
  approvedAudience: "FOUNDRY_MOCK_CUSTOMER_DIRECTORY",
  deliveryMode: "DRAFT_ONLY",
  brandVoice: "Warm, clear, and helpful",
  campaignStyle: "Short promotional email with one clear offer",
  campaignOffer: "20% off with code WEEKLY20, valid through Sunday at midnight",
  defaultActor: "support agent",
  serviceCreditCeiling: "25",
});

export function campaignBriefFromProfile(profile: FoundryProfile): CampaignBuildBrief {
  return {
    audienceSource: profile.approvedAudience,
    deliveryMode: profile.deliveryMode,
    rotation: "Every Tuesday · 09:00 local time",
    sender: `Offers at ${profile.companyName} <offers@example.com>`,
    offer: profile.campaignOffer,
    voice: profile.brandVoice,
    style: profile.campaignStyle,
    auditRequired: true,
  };
}
