"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { Topbar } from "./topbar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLanding = pathname === "/landing";

  if (isLanding) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Topbar />
      <main className="flex-1 min-w-0 w-full max-w-[1680px] mx-auto px-4 md:px-[3vw] pt-7 pb-10">
        {children}
      </main>
    </div>
  );
}
