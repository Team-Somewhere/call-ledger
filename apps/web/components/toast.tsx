"use client";

import React, { createContext, useCallback, useContext, useState } from "react";
import { AlertTriangle, CheckCircle2, X } from "lucide-react";
import { cn } from "../lib/utils";

type ToastKind = "success" | "error" | "info";

interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastContextValue {
  notify: (kind: ToastKind, message: string) => void;
}

const ToastContext = createContext<ToastContextValue>({ notify: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

let nextId = 1;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const notify = useCallback((kind: ToastKind, message: string) => {
    const id = nextId++;
    setToasts((current) => [...current, { id, kind, message }]);
    setTimeout(() => {
      setToasts((current) => current.filter((t) => t.id !== id));
    }, 6000);
  }, []);

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 max-w-sm">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              "flex items-start gap-2 px-3 py-2 rounded-sm border text-xs font-mono shadow-lg bg-[#FFFAF3]",
              toast.kind === "success" &&
                "border-[#16A34A]/40 text-[#16A34A]",
              toast.kind === "error" && "border-[#F62440]/40 text-[#F62440]",
              toast.kind === "info" && "border-[#E8DFD1] text-[#171717]",
            )}
          >
            {toast.kind === "error" ? (
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            )}
            <span className="font-sans leading-relaxed">{toast.message}</span>
            <button
              onClick={() =>
                setToasts((current) => current.filter((t) => t.id !== toast.id))
              }
              className="ml-1 text-[#78716C] hover:text-[#171717]"
              aria-label="Dismiss"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
