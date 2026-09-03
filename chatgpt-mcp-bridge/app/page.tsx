"use client";

import { useEffect, useState } from "react";

type McpTool = {
  name: string;
  title?: string;
  description?: string;
};

async function listTools(): Promise<McpTool[]> {
  const response = await fetch("/api/mcp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
  });

  if (!response.ok) throw new Error(`MCP request failed (${response.status})`);
  const payload = await response.json() as {
    error?: { message?: string };
    result?: { tools?: McpTool[] };
  };
  if (payload.error) throw new Error(payload.error.message ?? "MCP request failed");
  return Array.isArray(payload.result?.tools) ? payload.result.tools : [];
}

export default function Page() {
  const [tools, setTools] = useState<McpTool[] | null>(null);
  const [mcpError, setMcpError] = useState(false);

  useEffect(() => {
    listTools()
      .then((result) => setTools(result))
      .catch(() => {
        setTools([]);
        setMcpError(true);
      });
  }, []);

  const online = tools !== null && tools.length > 0 && !mcpError;

  return (
    <main className="site-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Xact Foundry home">
          <img className="brand-logo" src="/xact-foundry-logo.webp" alt="Xact Foundry" />
          <span><strong>XACT FOUNDRY</strong><small>CHATGPT APP</small></span>
        </a>
        <nav aria-label="Primary navigation">
          <a href="#boss-loop">BOSS LOOP</a>
          <a href="#boundary">BOUNDARY</a>
          <a href="https://xact-web-sandbox.bojimmy.chatgpt.site" target="_blank" rel="noreferrer">WEB SANDBOX ↗</a>
        </nav>
        <span className={`live-state ${mcpError ? "offline" : ""}`}>
          <i /> {tools === null ? "CHECKING MCP" : online ? "MCP ONLINE" : "MCP UNAVAILABLE"}
        </span>
      </header>

      <section className="hero" id="top">
        <div className="hero-art">
          <img src="/xact-foundry-hero.png" alt="Xact Foundry: secure, governed WebMCP. The AI-Boss has no access to your data; Xact holds the keys; nothing happens without approval." />
        </div>
        <div className="hero-actions hero-actions-under">
          <a className="button primary" href="https://chatgpt.com/plugins" target="_blank" rel="noreferrer">OPEN IN CHATGPT <span>↗</span></a>
          <a className="button secondary" href="https://xact-web-sandbox.bojimmy.chatgpt.site" target="_blank" rel="noreferrer">WATCH XACT EXPLAINER <span>↗</span></a>
          <a className="button secondary" href="https://xact-web-sandbox.bojimmy.chatgpt.site/foundry" target="_blank" rel="noreferrer">BYPASS DIRECT TO BOSS <span>↗</span></a>
        </div>
      </section>

      <section className="proof-section" aria-label="Xact Foundry details">
        <div className="section-heading">
          <div><p className="eyebrow">SEE THE SYSTEM</p><h2>Understand the control flow.</h2></div>
          <p>ChatGPT handles open-ended language. Xact handles the exact work: governed resolution, deterministic construction, and explicit authority. <strong>Governed means Xact has defined what may be built, what data it may use, who may use it, and what must be true before any consequence can occur.</strong></p>
        </div>
        <div className="proof-grid">
          <article className="proof-card proof-card-wide">
            <img src="/assets/natural.webp" alt="Diagram showing the flow from natural language through resolution, governance, X-Nodes construction, and verification." />
            <div><span>01 · THE FLOW</span><h3>From ordinary language to a verified capability.</h3><p>The worker starts with a request, not a tool name. Xact turns that request into a structured brief, checks its meaning and boundaries, and sends only genuine uncertainty to the Boss.</p></div>
          </article>
          <div className="proof-divider"><span>THE BOUNDARY</span><h3>Understanding opens the door. Governance decides what crosses it.</h3><p>Every request is checked against approved vocabulary, data scope, policy, and authority. If a required concept is missing or unsafe, Xact explains the boundary instead of inventing a tool.</p></div>
          <article className="proof-card">
            <div className="proof-overline"><h3>SPEED DEMON</h3><p>Once intent is governed, <strong>Xact gets the language model out of the way.</strong> Deterministic X-Nodes execute exact work at machine speed—averaging <strong>9 μs per decision and ~109,500 decisions per second</strong>, with <strong>zero LLM inference tokens</strong> on the deterministic path. The result is simple: use intelligence where reasoning is needed, and use Xact everywhere the work is already exact.</p></div>
            <img src="/assets/latency.webp" alt="Speed Demon benchmark showing 9.0 microseconds mean decision latency, approximately 109,500 decisions per second, and zero inference tokens on the deterministic path." />
            <div><span>02 · THE SPEED</span><h3>Do not spend intelligence on exact work.</h3><p>Once a capability is governed, the X-Nodes run the repeatable construction path without further model inference. The reference measurements are labeled separately from the browser demo.</p></div>
          </article>
          <div className="proof-divider"><span>THE HANDOFF</span><h3>ChatGPT can propose. Xact keeps the keys.</h3><p>ChatGPT can propose structure, but it cannot grant itself access. Construction, execution, and consequential Commit remain separate steps, with evidence and authorization checked at each boundary.</p></div>
          <article className="proof-card">
            <img src="/assets/the-xact.webp" alt="Xact Foundry emblem with shield and anvil, representing governed construction and authority." />
            <div><span>03 · THE AUTHORITY</span><h3>ChatGPT is the Boss. Xact is the authority.</h3><p>ChatGPT understands and proposes. Xact governs what may be built, what may run, and what requires a fresh Commit.</p></div>
          </article>
          <article className="proof-card">
            <img src="/assets/xact-foundry-operations.webp" alt="Xact Foundry Operations dashboard showing build brief, R/U/C analysis, X-Nodes construction, and verification." />
            <div><span>04 · THE PROOF</span><h3>Every boundary is visible.</h3><p>Resolution, reasoning, re-entry, authorization, Commit, build, registration, observation, and verification remain distinct and auditable.</p></div>
          </article>
        </div>
      </section>

      <section className="principle-strip" aria-label="Xact operating principle">
        <span>01 · RESOLVE</span><b>→</b><span>02 · CLARIFY ONLY IF NEEDED</span><b>→</b><span>03 · ASK THE BOSS FOR GENUINE U</span><b>→</b><span>04 · COMMIT IF AUTHORIZED</span>
      </section>

      <section className="o-agent-section" id="boss-loop">
        <div className="section-heading">
          <div><p className="eyebrow">BOUNDED REASONING LOOP</p><h2>ChatGPT is the Boss.<br />Xact is the authority.</h2></div>
          <p>The bridge resolves declared equivalents first, asks one concise question for close matches, and reserves ChatGPT reasoning for genuine semantic U—without inheriting execution or Commit authority.</p>
        </div>
        <h2 className="loop-summary">Resolve first → reason only for genuine uncertainty → re-enter safely.</h2>
        <p className="loop-summary-detail">Xact validates the response, rejects off-list choices, and preserves normal construction and Commit controls.</p>
        <div className="prompt-band">
          <div><span>TRY IN CHATGPT</span><p>1. Ask for examples by category. 2. Choose or edit a prompt. 3. Ask Xact to construct it. 4. Review the governed result. 5. Ask for the approved read/report when a runtime handler exists.</p><p className="chat-scope-note"><strong>Challenge scope:</strong> governed capabilities are chat-scoped. Reopen the Xact Foundry conversation from the ChatGPT sidebar to reuse them. Dashboard history is future productization.</p></div>
          <a className="button primary" href="https://xact-web-sandbox.bojimmy.chatgpt.site/foundry" target="_blank" rel="noreferrer">OPEN XACT FOUNDRY <span>↗</span></a>
        </div>
      </section>

      <section className="boundary-section" id="boundary">
        <div><p className="eyebrow">CONSEQUENCE BOUNDARY</p><h2>Reasoning is evidence.<br />Commit stays Xact.</h2></div>
        <div className="boundary-copy">
          <p>This public app exposes governed tool contracts and a bounded Boss reasoning loop. It does not expose private Xact internals, execute external actions, or grant ChatGPT Commit authority.</p>
          <a href="https://xact-web-sandbox.bojimmy.chatgpt.site" target="_blank" rel="noreferrer">EXPLORE THE PUBLIC XACT WEB SANDBOX <span>↗</span></a>
        </div>
      </section>

      <footer>
        <div className="brand footer-brand"><img className="brand-logo" src="/xact-foundry-logo.webp" alt="Xact Foundry" /><span><strong>XACT FOUNDRY</strong><small>PUBLIC-SAFE MCP</small></span></div>
        <p>ChatGPT reasons. Xact commits.</p>
        <p className="footer-note">*Xact validates the governed data, rules, and authority required for a decision before deterministic construction begins.</p>
        <div className="footer-links">
          <a href="https://chatgpt.com/plugins" target="_blank" rel="noreferrer">CHATGPT PLUGINS ↗</a>
          <a href="https://developers.openai.com/plugins/build/mcp-server" target="_blank" rel="noreferrer">MCP SERVER DOCS ↗</a>
        </div>
      </footer>
    </main>
  );
}
