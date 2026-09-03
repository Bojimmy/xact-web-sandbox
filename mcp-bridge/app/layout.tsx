export const metadata = {
  metadataBase: new URL("https://xact-foundry-mcp.bojimmy.chatgpt.site"),
  title: "Xact Foundry — The Commit Layer for Agentic Web",
  description: "Inspect governed Xact Foundry READ recipes and inert WebMCP definitions through ChatGPT.",
  openGraph: {
    title: "Xact Foundry — The Commit Layer for Agentic Web",
    description: "Reason when necessary. Execute Xactly.",
    type: "website",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
