import assert from "node:assert/strict";
import test from "node:test";
import { XactFoundryLiaison, decomposeIntent } from "../src/flagship/foundry-liaison";
import { SecureEndpointOAgentProvider } from "../src/telemetry/o-agent-provider";

function liveProvider(): SecureEndpointOAgentProvider {
  return new SecureEndpointOAgentProvider(
    "/api/o-agent",
    async () => new Response(JSON.stringify({
      kind: "LIVE_SANDBOX_MEASUREMENT",
      provider: "ollama",
      result: {
        evidence: [{ claim: "Eligibility evidence", resolves: ["credit eligibility"] }],
        inputTokens: 3,
        outputTokens: 2,
        latencyMs: 1,
      },
    }), { status: 200 }),
  );
}

test("decomposeIntent maps a service-credit intent to a governed descriptor with a limit", () => {
  const d = decomposeIntent("Build me a WebMCP tool that lets support agents issue a service credit up to $25");

  assert.equal(d.pattern?.id, "issue_service_credit");
  assert.equal(d.amountLimit, 25);
  assert.equal(d.door.admissible, true);
  assert.equal(d.ledger.valid, true);
  assert.deepEqual(d.descriptor?.inputs, ["customerId", "amount", "reason"]);
  assert.equal(d.descriptor?.capabilityKind, "MUTATION");

  const limitBoundary = d.descriptor?.boundaries.find((b) => b.primitive === "COMMIT_BOUNDARY");
  assert.deepEqual(limitBoundary?.limit, { operator: "<=", value: 25 });
});

test("buildCapability returns COMPOSED_DEFINITION — not a registered or working tool", async () => {
  const liaison = new XactFoundryLiaison(liveProvider());
  const events: string[] = [];
  const result = await liaison.buildCapability(
    "Build me a WebMCP tool that lets support agents issue a service credit up to $25",
    (a) => events.push(a.type),
  );

  assert.equal(result.outcome, "COMPOSED_DEFINITION");
  assert.ok(result.tool);
  assert.equal(result.tool.name, "issue_service_credit");
  assert.equal("execute" in result.tool!, false);
  assert.ok(result.commitAuthorization);
  assert.ok(result.reasoning);

  // The liaison emits through BUILD only — it never claims register/observe/verify.
  const expected = ["RESOLVE", "DOOR", "LEDGER", "REASON_STARTED", "REASON_EVIDENCE", "RE_ENTRY", "AUTHORIZATION", "COMMIT", "BUILD"];
  for (const type of expected) {
    assert.ok(events.includes(type), `missing event ${type}; got ${events.join(", ")}`);
  }
  for (const overclaimed of ["REGISTER", "OBSERVE", "VERIFY", "GOVERNANCE"]) {
    assert.ok(!events.includes(overclaimed), `liaison must not emit ${overclaimed}; got ${events.join(", ")}`);
  }
  assert.equal(events[0], "RESOLVE");
  assert.equal(events[events.length - 1], "BUILD");

  const a = events.indexOf("AUTHORIZATION");
  const c = events.indexOf("COMMIT");
  const b = events.indexOf("BUILD");
  assert.ok(a < c && c < b, `AUTHORIZATION(${a}) → COMMIT(${c}) → BUILD(${b}) out of order`);
});

test("reviewForAbsorption runs governance only after the build, grounded in verified registration", () => {
  const liaison = new XactFoundryLiaison(liveProvider());
  const d = decomposeIntent("Build me a WebMCP tool that lets support agents issue a service credit up to $25");

  const events: string[] = [];
  const review = liaison.reviewForAbsorption(d.descriptor!, d.candidate!, (a) => events.push(a.type));

  assert.equal(review.approved, true);
  assert.equal(review.evidence.measurement.verdict, "EFFECTIVE");
  assert.ok(review.evidence.verifiedConsequence.verificationSource.includes("Registered"));
  assert.deepEqual(events, ["GOVERNANCE"]);
});

test("the refusal path blocks a delete with IMPLEMENTATION POSSIBLE / AUTHORITY NOT ESTABLISHED", async () => {
  const liaison = new XactFoundryLiaison(liveProvider());
  const result = await liaison.buildCapability("Build a WebMCP tool that lets any agent delete any customer");

  assert.equal(result.outcome, "BLOCKED");
  assert.ok(result.refusal);
  assert.equal(result.refusal.implementationPossible, true);
  assert.equal(result.refusal.authorityEstablished, false);
  assert.ok(result.refusal.reasons.some((r) => r.includes("irreversible")));
  assert.equal(result.tool, undefined);
  assert.equal(result.commitAuthorization, undefined);
  assert.ok(result.activity.some((a) => a.type === "BLOCKED"));
});

test("an unfamiliar request invokes the O-Agent and returns PENDING_GOVERNANCE", async () => {
  const result = await new XactFoundryLiaison(liveProvider()).buildCapability("Keep me updated on user stats and requests");

  assert.equal(result.outcome, "PENDING_GOVERNANCE");
  assert.ok(result.reasoning);
  assert.deepEqual(result.reasoning.unresolved, ["the requested capability"]);
  assert.ok(result.reasoning.claims.length > 0);
  assert.equal(result.tool, undefined);
  assert.equal(result.commitAuthorization, undefined);
  assert.ok(result.activity.some((a) => a.type === "REASON_STARTED"));
  assert.ok(result.activity.some((a) => a.type === "REASON_EVIDENCE"));
});

test("a READ capability builds with no reasoning events", async () => {
  const result = await new XactFoundryLiaison(liveProvider()).buildCapability("Find customers by email");

  assert.equal(result.outcome, "COMPOSED_DEFINITION");
  assert.equal(result.tool?.capabilityKind, "READ");
  assert.equal(result.tool?.requiresCommit, false);
  assert.ok(!result.activity.some((a) => a.type === "REASON_STARTED"));
});

test("a bounded active-user and request snapshot is a governed read capability", async () => {
  const result = await new XactFoundryLiaison(liveProvider()).buildCapability(
    "Build a WebMCP tool that shows active users and open support requests as an on-demand snapshot",
  );

  assert.equal(result.outcome, "COMPOSED_DEFINITION");
  assert.equal(result.tool?.name, "read_active_users_and_open_requests");
  assert.equal(result.tool?.capabilityKind, "READ");
  assert.deepEqual(result.tool?.inputSchema.required, []);
  assert.ok(!result.activity.some((a) => a.type === "REASON_STARTED"));
});

test("a promotional-email request builds a preparation tool, not an email delivery tool", async () => {
  const result = await new XactFoundryLiaison(liveProvider()).buildCapability(
    "Build a weekly promotional email campaign with personalized drafts",
  );

  assert.equal(result.outcome, "COMPOSED_DEFINITION");
  assert.equal(result.tool?.name, "prepare_weekly_promotional_email_campaign");
  assert.equal(result.tool?.capabilityKind, "READ");
  assert.equal(result.tool?.requiresCommit, false);
  assert.ok(result.tool?.boundaries.some((boundary) => boundary.description.includes("delivery requires a separate fresh Commit")));
  assert.ok(!result.activity.some((a) => a.type === "REASON_STARTED"));
});

test("fail closed: an unavailable provider emits REASON_FAILED and throws", async () => {
  const unavailable = new SecureEndpointOAgentProvider("/api/o-agent", async () => new Response("unavailable", { status: 503 }));
  const liaison = new XactFoundryLiaison(unavailable);
  const events: string[] = [];

  await assert.rejects(
    () => liaison.buildCapability("Issue a service credit up to $25", (a) => events.push(a.type)),
    /unavailable/,
  );
  assert.ok(events.includes("REASON_STARTED"));
  assert.ok(events.includes("REASON_FAILED"));
});
