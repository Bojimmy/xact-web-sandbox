"use client";

import { useEffect, useState } from "react";
import "./globals.css";

type Recipe = {
  id: string;
  title: string;
  description: string;
  signal: string;
};

type ToolDefinition = {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  executable: false;
  authority: "XACT_COMMIT_REQUIRED";
};

const recipes: Recipe[] = [
  { id: "inspect_request", title: "Inspect request", description: "Read the reported request envelope and its public-safe fields.", signal: "REQUEST" },
  { id: "get_customer", title: "Get customer", description: "Read the simulated customer record without exposing private data.", signal: "IDENTITY" },
  { id: "get_order", title: "Get order", description: "Read the simulated order state bound to the request.", signal: "STATE" },
  { id: "get_policy", title: "Get policy", description: "Read explicit policy constraints relevant to a consequence.", signal: "POLICY" },
  { id: "get_xact_state", title: "Get Xact state", description: "Read the current R / U / C and Commit-boundary state.", signal: "R / U / C" },
  { id: "get_audit_trace", title: "Get audit trace", description: "Read the public-safe trace of resolution, Commit, and verification.", signal: "AUDIT" },
];

async function mcpRequest(method: string, params: Record<string, unknown>, id: number) {
  const response = await fetch("/api/mcp", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
  });
  if (!response.ok) throw new Error(`MCP request failed (${response.status})`);
  const payload = await response.json();
  if (payload.error) throw new Error(payload.error.message ?? "MCP request failed");
  return payload.result;
}

export default function HomePage() {
  const [toolCount, setToolCount] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [definition, setDefinition] = useState<ToolDefinition | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    mcpRequest("tools/list", {}, 1)
      .then((result) => setToolCount(Array.isArray(result?.tools) ? result.tools.length : 0))
      .catch(() => setToolCount(0));
  }, []);

  async function requestDefinition(recipeId: string) {
    setBusy(recipeId);
    setError(null);
    try {
      const result = await mcpRequest("tools/call", { name: "request_webmcp_tool", arguments: { recipeId } }, 2);
      setDefinition(result?.structuredContent?.tool ?? null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Definition request failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="site-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Xact Foundry home">
          <span className="brand-mark">X</span>
          <span><strong>XACT FOUNDRY</strong><small>CHATGPT APP</small></span>
        </a>
        <nav aria-label="Primary navigation">
          <a href="#read-surface">READ SURFACE</a>
          <a href="#boundary">BOUNDARY</a>
          <a href="https://xact-web-sandbox.bojimmy.chatgpt.site" target="_blank" rel="noreferrer">WEB SANDBOX ↗</a>
        </nav>
        <span className={`live-state ${toolCount === 0 ? "offline" : ""}`}>
          <i /> {toolCount === null ? "CHECKING MCP" : toolCount > 0 ? "MCP ONLINE" : "MCP UNAVAILABLE"}
        </span>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">THE COMMIT LAYER FOR AGENTIC WEB</p>
          <h1>Reason when necessary.<br /><em>Execute Xactly.</em></h1>
          <p className="lede">A public-safe ChatGPT app for inspecting governed READ capabilities and constructing inert WebMCP definitions—without confusing capability with authority.</p>
          <div className="hero-actions">
            <a className="button primary" href="https://chatgpt.com/plugins" target="_blank" rel="noreferrer">OPEN IN CHATGPT <span>↗</span></a>
            <a className="button secondary" href="#read-surface">EXPLORE READ SURFACE <span>↓</span></a>
          </div>
        </div>
        <aside className="signal-panel" aria-label="Xact system status">
          <div className="panel-head"><span>SYSTEM / PUBLIC</span><strong>LIVE</strong></div>
          <dl>
            <div><dt>TRANSPORT</dt><dd>STREAMABLE HTTP</dd></div>
            <div><dt>AUTH</dt><dd>PUBLIC / NO AUTH</dd></div>
            <div><dt>MODE</dt><dd>READ DEFINITIONS</dd></div>
            <div><dt>TOOLS</dt><dd>{toolCount === null ? "SCANNING" : String(toolCount).padStart(2, "0") + " DISCOVERED"}</dd></div>
          </dl>
          <div className="boundary-line"><span>COMMIT AUTHORITY</span><strong>NOT GRANTED</strong></div>
        </aside>
      </section>

      <section className="principle-strip" aria-label="Xact operating principle">
        <span>01 · RESOLVE</span><b>→</b><span>02 · REASON IF NEEDED</span><b>→</b><span>03 · COMMIT</span><b>→</b><span>04 · EXECUTE + VERIFY</span>
      </section>

      <section className="surface-section" id="read-surface">
        <div className="section-heading">
          <div><p className="eyebrow">APPROVED PUBLIC SURFACE</p><h2>Six governed READ recipes.</h2></div>
          <p>Select a recipe to ask the live MCP server for its inert WebMCP definition. No external effect is executed.</p>
        </div>

        <div className="surface-grid">
          <div className="recipe-grid">
            {recipes.map((recipe, index) => (
              <article className="recipe-card" key={recipe.id}>
                <div className="recipe-index">{String(index + 1).padStart(2, "0")}</div>
                <div className="recipe-body">
                  <span>{recipe.signal}</span>
                  <h3>{recipe.title}</h3>
                  <p>{recipe.description}</p>
                </div>
                <button type="button" onClick={() => requestDefinition(recipe.id)} disabled={busy !== null}>
                  {busy === recipe.id ? "REQUESTING…" : "VIEW DEFINITION →"}
                </button>
              </article>
            ))}
          </div>

          <aside className="definition-panel" aria-live="polite">
            <div className="panel-head"><span>WEBMCP / DEFINITION</span><strong>{definition ? "RETURNED" : "READY"}</strong></div>
            {error ? <p className="definition-error">{error}</p> : definition ? (
              <div className="definition-content">
                <p className="definition-label">{definition.name}</p>
                <h3>{definition.title}</h3>
                <p>{definition.description}</p>
                <dl>
                  <div><dt>EXECUTABLE</dt><dd>{String(definition.executable).toUpperCase()}</dd></div>
                  <div><dt>AUTHORITY</dt><dd>{definition.authority}</dd></div>
                </dl>
                <pre>{JSON.stringify(definition.inputSchema, null, 2)}</pre>
              </div>
            ) : (
              <div className="definition-empty">
                <span className="reticle">+</span>
                <h3>Choose a READ recipe</h3>
                <p>The returned definition will appear here. Definitions are inspectable and intentionally inert.</p>
              </div>
            )}
          </aside>
        </div>
      </section>

      <section className="boundary-section" id="boundary">
        <div><p className="eyebrow">CONSEQUENCE BOUNDARY</p><h2>Capability is visible.<br />Authority stays separate.</h2></div>
        <div className="boundary-copy">
          <p>This app exposes public-safe contracts, simulated state, and approved READ definitions. It does not expose private Xact internals, execute external actions, or grant Commit authority.</p>
          <a href="https://xact-web-sandbox.bojimmy.chatgpt.site" target="_blank" rel="noreferrer">EXPLORE THE PUBLIC XACT WEB SANDBOX <span>↗</span></a>
        </div>
      </section>

      <footer>
        <div className="brand footer-brand"><span className="brand-mark">X</span><span><strong>XACT FOUNDRY</strong><small>PUBLIC-SAFE MCP</small></span></div>
        <p>Reasoning may propose a consequence. Only Xact may commit one.</p>
        <div className="footer-links">
          <a href="https://chatgpt.com/plugins" target="_blank" rel="noreferrer">CHATGPT PLUGINS ↗</a>
          <a href="https://developers.openai.com/plugins/build/mcp-server" target="_blank" rel="noreferrer">MCP SERVER DOCS ↗</a>
        </div>
      </footer>
    </main>
  );
}
