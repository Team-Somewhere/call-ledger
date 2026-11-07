import type { Metadata } from "next";
import "./globals.css";
import { WalletSessionProvider } from "../lib/use-wallet-session";
import { AppShell } from "../components/app-shell";

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
    <html lang="en" className="scroll-smooth">
      <body className="bg-[#FFFAF3] text-[#171717] antialiased min-h-screen font-sans selection:bg-[#FFE5BF] selection:text-[#171717]">
        <WalletSessionProvider>
          <AppShell>{children}</AppShell>
        </WalletSessionProvider>
      </body>
    </html>
  );
}
