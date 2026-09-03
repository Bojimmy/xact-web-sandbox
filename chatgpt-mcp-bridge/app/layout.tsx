import "./styles.css";

export const metadata = {
  metadataBase: new URL("https://xact-foundry-mcp.bojimmy.chatgpt.site"),
  title: "Xact Foundry — ChatGPT Boss Bridge",
  description: "ChatGPT supplies bounded Boss reasoning; Xact retains Commit authority.",
  openGraph: {
    title: "Xact Foundry — ChatGPT Boss Bridge",
    description: "Reason when necessary. Execute Xactly.",
    type: "website",
  },
};

export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
