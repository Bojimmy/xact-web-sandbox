import "./globals.css";

export default function HomePage() {
  return (
    <main>
      <p className="eyebrow">XACT · CHATGPT APP</p>
      <h1>Foundry MCP Bridge</h1>
      <p>This public endpoint lets ChatGPT list approved Xact Foundry READ recipes and request inert, governed WebMCP tool definitions.</p>
      <p><strong>It does not expose the private Xact dashboard, execute external actions, or grant Commit authority.</strong></p>
      <code>POST /mcp</code>
    </main>
  );
}
