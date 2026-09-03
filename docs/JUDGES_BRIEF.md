# Xact Foundry: Open-Ended Understanding. Governed Execution.

What you are about to witness is not an AI choosing from a list of prebuilt tools.

ChatGPT is the **Boss**: it can interpret open-ended human intent and propose a structured capability. Xact determines whether that proposal is already governed, can be composed from governed primitives, needs clarification, crosses a novel boundary, or lacks authority.

> **The Boss can understand more than Xact is allowed to build.**

## The short version

Xact Foundry turns ordinary human intent into governed agent capability.

In this demonstration, ChatGPT is the conversational **Boss**: it understands what the user means and, when necessary, proposes a structured interpretation. Xact is the authority: it decides what that intent is allowed to become, constructs only an approved contract, and keeps consequence authority behind an explicit Commit boundary.

The central idea is simple:

> **The Boss can understand intent. Xact decides what may become real.**

## Recommended judge workflow

1. Ask ChatGPT: "Show me Xact Foundry build examples by category."
2. Choose or edit a prompt.
3. Ask Xact to construct it.
4. See the governed result in chat.
5. Ask for the approved read/report if that capability has a runtime handler.

## Challenge scope

For this Challenge build, governed capabilities are chat-scoped. Reopen the Xact Foundry conversation from the ChatGPT sidebar to reuse them.

Dashboard integration is future productization, not missing functionality. The important thing judges need to see is that Xact can construct, govern, reuse, block, and execute appropriately — they do not need a second persistence layer just for presentation.

## What the user will see

Describe a capability normally, for example:

> "Give my support team a way to see which customers have been waiting the longest."

Xact resolves the request against its governed vocabulary. It will either:

- build an already-governed capability immediately (**ALREADY_GOVERNED**);
- compose a new capability when every requested primitive is governed (**COMPOSABLE**);
- ask one concise clarification when a real semantic choice remains (**NEEDS_RESOLUTION**);
- give a truthful, productive boundary explanation when the request exceeds the approved language (**NOVEL_BOUNDARY** or **UNAUTHORIZED**).

The system never silently substitutes a similar-looking capability. A customer order-status request is not falsely mapped to a field work-order queue.

### Adversarial boundary

Adversarial requests do not create a side door. Xact may understand an unauthorized request, but it fails closed: no tool is built, no data is read, and no consequence occurs. **Xact understood the request. It simply refused to grant it authority.**

## What "built" means here

The demo uses fictional, public-safe workspace data by design, so the user sees the governance and safety behavior without exposing a real company's customers or systems.

The ChatGPT connector intentionally uses **No Auth** for this demonstration because it exposes only fictional, public-safe demo data and inert capability definitions. This is **public-safe demo mode**, not a production security model. A real deployment would require authenticated company identity, tenant isolation, role-based access, durable audit logging, and authenticated runtime handlers.

When Xact reports **BUILT** or **COMPOSABLE**, it has validated and constructed a governed tool contract.

- **Read** — the contract connects to an approved on-demand read handler. The live demo reads the governed workspace snapshot (open work orders, support cases, at-risk accounts) on demand — never polling, never scheduled.
- **Mutation** — construction does **not** authorize an external consequence. Every future use requires a fresh Xact Commit, with the applicable actor, confirmation, audit, and state checks.

The demo does not claim to be connected to a production CRM, ticketing platform, or dispatch system, and it does not poll or send notifications.

## Why this matters beyond the demo

In a real company, the fictional substrate is replaced by an approved connector to the company's systems. The governed contract specifies the permitted fields, operation, tenant and role boundaries, freshness requirements, and the meaning of measurements such as "waiting time."

That separation is the architectural shift:

- a language model may interpret an open-ended request;
- a governed system determines whether the requested capability exists, can be composed safely, or needs review;
- a runtime handler reads only from an approved data source;
- consequential actions remain behind explicit, auditable authority.

This is a path toward agents that are useful without being trusted blindly: flexible at the conversation layer, deterministic at the authority boundary, and honest about what they did and did not do.

## Governed Self-Service for the Enterprise

Xact Foundry is designed to let employees ask for the agent capabilities they need **without giving employees—or the AI—unrestricted authority to create consequences**. A worker can describe a capability in ordinary language, while Xact independently checks the actor, permitted capability, data boundaries, policy, state, and required authority before anything consequential can occur.

**Permission to construct a tool is not permission to execute it.**

In a production deployment with authenticated company identity and durable audit storage, Xact can preserve evidence of **who requested the capability, what was built, what authority was granted, who invoked it, what action was committed, and whether the consequence was verified.** This gives organizations a path toward employee self-service agent creation without surrendering governance, accountability, or control.

> ### **Give workers freedom to ask for what they need without giving agents freedom to do whatever they want.**
>
> **Every capability has an owner. Every consequence has authority. Every committed action leaves evidence.**

## The proof

The user is not asked to believe that a mock customer record is a production integration. The proof is the control flow — and that the deterministic path is *measured*, not asserted.

Once intent is resolved, Xact's validation, authorization, construction, and governed runtime paths are deterministic. Already-governed capabilities can resolve and construct with zero LLM inference tokens.

The X-Nodes perform the actual governed construction and tool-path work deterministically. The Boss does not generate code, choose authority, or run the tool. In a production integration, an external system can still return an error or change state; Xact treats that as runtime evidence and fails closed rather than converting it into a success claim.

The deterministic construction system has been measured directly: 10,011 deterministic construction operations were exercised in the browser benchmark, with parallel execution reaching ~6.1× speedup while preserving a bit-identical checksum. Parallelism changed how quickly the workload completed; it did not change the result. Separately, the *reference* Xact implementation measured ~9 µs mean decision latency on a single CPU; that figure is the reference, not this demo.

Xact's governed surface today spans operational and support reads, customer and employee views, sales and marketing reporting, draft-only campaign preparation, and Commit-gated mutation tools — credits, refunds, reassignment, escalation, plan changes, and status updates. These are the **already-governed compositions**: the fast path, not the ceiling. The Boss can propose a composition beyond them, and Xact decides whether it is composable from governed primitives.

> **The Boss proposes structure; it does not expand the governed vocabulary or grant itself authority.**

This is also how Xact learns without surrendering control. A novel composition may begin with Boss reasoning, but only validation and governance can activate it. Once activated, the same governed composition can resolve deterministically as ALREADY_GOVERNED. Reasoning can therefore reduce the future need for reasoning without granting the reasoning model new authority.

**understand → resolve → clarify or compose → validate → build → read through an approved handler or prepare a bounded draft → Commit before any external consequence**

Xact makes that control flow visible, testable, and safe to connect to real enterprise systems later.

The benchmark figures above are documented as evidence in the repository's [architecture benchmark](../ARCHITECTURE.md#experimental-construction-benchmark); they are reference and experiment measurements, not a claim that network calls to a production system have zero latency.
