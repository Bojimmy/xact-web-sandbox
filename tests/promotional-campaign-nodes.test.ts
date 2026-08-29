import assert from "node:assert/strict";
import test from "node:test";
import { preparePromotionalEmailCampaign } from "../src/flagship/promotional-campaign-nodes";

test("campaign X-Nodes prepare a bounded promotional audience without delivery authority", () => {
  const campaign = preparePromotionalEmailCampaign();

  assert.equal(campaign.status, "DRAFTS_PREPARED_NO_SEND_AUTHORITY");
  assert.equal(campaign.recipients.length, 128);
  assert.equal(campaign.nodes.length, 7);
  assert.equal(campaign.totalOperations, 515);
  assert.ok(campaign.nodes.every((node) => node.status === "COMPLETE"));
  assert.ok(campaign.recipients.some((recipient) => recipient.subject.includes("20% off")));
});
