import type { Metadata } from "next";
import "../globals.css";

export const metadata: Metadata = {
  title: "CallLedger — Public Trade Calls, Structured",
  description:
    "CallLedger monitors public trade calls from crypto creators, structures them into verifiable signals, and lets you review every call in context — from source to outcome.",
  openGraph: {
    title: "CallLedger — Public Trade Calls, Structured",
    description:
      "Follow creator calls. Review the signal. Know what happened.",
    type: "website",
  },
};

/**
 * Minimal marketing layout: suppresses the root layout's inner padding
 * and makes the page full-bleed.
 *
 * The root layout renders a <main> with max-width, padding, and pt-7.
 * We escape that by using negative margins on the wrapper so the landing
 * page can be truly full-width with its own sections.
 */
export default function LandingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    /*
     * -mx-4 md:-mx-[3vw]  → cancel root <main>'s horizontal padding
     * -mt-7 -mb-10        → cancel root <main>'s vertical padding
     * w-screen max-w-none → ensure full viewport width
     */
    <div className="-mx-4 md:-mx-[3vw] -mt-7 -mb-10 w-[100vw] max-w-none overflow-x-hidden">
      {children}
    </div>
  );
}
