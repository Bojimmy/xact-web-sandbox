import type { Metadata } from "next";
import "./globals.css";

const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin),
  title: "Xact Control Room",
  description:
    "A public-safe visual proof of the Xact consequence boundary for agentic web execution.",
  openGraph: {
    title: "Xact Control Room",
    description: "Capability ≠ Authority. A public-safe Xact simulation.",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Xact Control Room — Capability is not authority" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Xact Control Room",
    description: "Capability ≠ Authority. A public-safe Xact simulation.",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
