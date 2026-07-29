import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Giga Deck Builder",
  description:
    "Generate branded Giga / UNICEF / Digital Impact Division slide decks from a prompt",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
