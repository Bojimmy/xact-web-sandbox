import assert from "node:assert/strict";
import test from "node:test";
import { FOUNDRY_CATALOG, rankFoundryCatalog } from "../src/flagship/foundry-catalog";
import { decomposeIntent } from "../src/flagship/foundry-liaison";
import { campaignBriefFromProfile, defaultFoundryProfile } from "../src/flagship/foundry-profile";

test("every Foundry catalog recipe maps to an approved governed capability", () => {
  assert.equal(new Set(FOUNDRY_CATALOG.map((entry) => entry.id)).size, FOUNDRY_CATALOG.length);
  for (const entry of FOUNDRY_CATALOG) {
    const values = Object.fromEntries(entry.fields.map((field) => [field.key, field.defaultValue]));
    assert.equal(decomposeIntent(entry.buildIntent(values)).descriptor?.id, entry.id, entry.title);
  }
});

test("a Foundry Profile is an explicit draft input, not delivery authority", () => {
  const brief = campaignBriefFromProfile({ ...defaultFoundryProfile, companyName: "Acme Field Services", brandVoice: "Confident and concise", campaignOffer: "15% off with code DEMO15" });
  assert.equal(brief.voice, "Confident and concise");
  assert.equal(brief.offer, "15% off with code DEMO15");
  assert.equal(brief.deliveryMode, "DRAFT_ONLY");
  assert.equal(brief.sender, "Offers at Acme Field Services <offers@example.com>");
});

test("the catalog ordering follows the judge's explicit business focus", () => {
  const campaigns = rankFoundryCatalog(FOUNDRY_CATALOG, { ...defaultFoundryProfile, focus: "CAMPAIGN_OPERATIONS" });
  const operations = rankFoundryCatalog(FOUNDRY_CATALOG, { ...defaultFoundryProfile, focus: "CUSTOMER_OPERATIONS" });
  assert.ok(["get_campaign_dashboard", "prepare_weekly_promotional_email_campaign"].includes(campaigns[0].id));
  assert.ok(["get_customer_support_queue", "get_work_order_queue", "get_customer_health_summary", "get_business_operations_report"].includes(operations[0].id));
});
