import "./styles.css";

export const metadata = {
  title: "Xact Foundry MCP Bridge",
  description: "Public-safe deterministic Xact Foundry MCP endpoint for ChatGPT.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
