import type { Metadata } from "next";
import "./globals.css";
import { MockBanner } from "../components/mock-banner";
import { Topbar } from "../components/topbar";

export const metadata: Metadata = {
  title: "CallLedger — Verifiable Social Crypto Trading",
  description:
    "Discover top crypto traders on X, inspect on-chain Arkiv verified signals, and build personalized copy-trading strategies.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-[#FFFAF3] text-[#171717] antialiased min-h-screen flex flex-col font-sans selection:bg-[#FFE5BF] selection:text-[#171717]">
        <Topbar />
        <MockBanner />
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-8 py-6 md:py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
