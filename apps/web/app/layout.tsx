import type { Metadata } from "next";
import "./globals.css";
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
      <body className="bg-[#FFFAF3] text-[#171717] antialiased min-h-screen w-full overflow-x-hidden flex flex-col font-sans selection:bg-[#FFE5BF] selection:text-[#171717]">
        <Topbar />
        <main className="flex-1 min-w-0 w-full max-w-[1680px] mx-auto px-4 md:px-[3vw] pt-7 pb-10">
          {children}
        </main>
      </body>
    </html>
  );
}
