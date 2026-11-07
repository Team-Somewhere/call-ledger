import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "CallLedger — Public Trade Calls, Structured & Verified On-Chain",
  description:
    "Follow creator calls. Review verified trade signals. Track real outcomes on-chain with Arkiv and execute non-custodial orders via Definitive Flash.",
};

export default function LandingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <>{children}</>;
}
