import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Plum · Relationship intelligence",
  description:
    "Build explainable contact segments from your CRM and complete email conversations.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
