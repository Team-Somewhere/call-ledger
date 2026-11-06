"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Award,
  Compass,
  Gauge,
  Layers,
  LayoutDashboard,
  PieChart,
  Radio,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { cn } from "../lib/utils";

const navItems = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/trade", label: "Flash Trading", icon: Zap },
  { href: "/discover", label: "Discover", icon: Compass },
  { href: "/creators", label: "Creators", icon: Award },
  { href: "/signals", label: "Signals", icon: Radio },
  { href: "/strategies", label: "My Strategies", icon: Layers },
  { href: "/portfolio", label: "Portfolio", icon: PieChart },
  { href: "/activity", label: "Activity", icon: Activity },
  { href: "/monitoring", label: "Monitoring", icon: Gauge },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r border-slate-800 bg-slate-950/80 backdrop-blur-sm flex flex-col justify-between shrink-0">
      <div>
        {/* Brand Header */}
        <div className="h-16 border-b border-slate-800 flex items-center px-6 gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-emerald-500 flex items-center justify-center font-bold text-white shadow-md">
            CL
          </div>
          <div>
            <div className="font-bold text-sm text-white tracking-wide flex items-center gap-1.5">
              CallLedger
              <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.2 rounded font-normal font-mono">
                P1
              </span>
            </div>
            <div className="text-[11px] text-slate-400">
              Verifiable Social Trading
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-xs font-medium transition-colors",
                  isActive
                    ? "bg-blue-600/15 text-blue-400 border border-blue-500/30"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60",
                )}
              >
                <Icon
                  className={cn(
                    "w-4 h-4",
                    isActive ? "text-blue-400" : "text-slate-400",
                  )}
                />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Protocol Badge Footer */}
      <div className="p-4 border-t border-slate-800/80 m-3 rounded-lg bg-slate-900/40">
        <div className="flex items-center gap-2 text-xs text-slate-300 font-medium">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Arkiv Attestation</span>
        </div>
        <p className="mt-1 text-[11px] text-slate-400 leading-relaxed">
          Creator calls & performance records cryptographically anchored to
          Arkiv.
        </p>
      </div>
    </aside>
  );
}
