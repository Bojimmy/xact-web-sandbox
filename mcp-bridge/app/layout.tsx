export const metadata = {
  title: "Xact Foundry MCP Bridge",
  description: "Public-safe deterministic Xact Foundry MCP endpoint for ChatGPT.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
