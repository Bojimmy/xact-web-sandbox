import type { Metadata } from "next";
import "./globals.css";

const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin),
  title: "Xact Governance Campaign",
  description:
    "A playable, public-safe proof of Xact governance from Resolve through Commit, Execute, Verify, and learning.",
  openGraph: {
    title: "Xact Governance Campaign",
    description: "Capability ≠ Authority. Prove the Xact consequence boundary level by level.",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Xact Control Room — Capability is not authority" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Xact Governance Campaign",
    description: "Capability ≠ Authority. Prove the Xact consequence boundary level by level.",
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
