import { useEffect, useRef, useState } from "react";
import { RichTokenCard } from "./RichTokenCard";
import type { DisplayCurrency } from "../utils/formatting";

export interface TokenOverlayRequest {
  symbol: string;
  triggerEl: HTMLElement;
  pinned?: boolean;
}

let requestShow: ((req: TokenOverlayRequest) => void) | null = null;
let requestHide: ((immediate?: boolean) => void) | null = null;

let dismissedElement: HTMLElement | null = null;
let dismissedUntil: number = 0;

export function triggerTokenOverlay(symbol: string, triggerEl: HTMLElement, pinned: boolean = false) {
  if (dismissedElement) {
    if (Date.now() < dismissedUntil && (dismissedElement === triggerEl || dismissedElement.contains(triggerEl) || triggerEl.contains(dismissedElement))) {
      return;
    }
    dismissedElement = null;
  }
  if (requestShow) requestShow({ symbol, triggerEl, pinned });
}

export function hideTokenOverlay(immediate: boolean = false) {
  if (requestHide) requestHide(immediate);
}

export function dismissTokenOverlay(targetEl?: HTMLElement | null) {
  const el = targetEl ?? dismissedElement;
  if (el) {
    dismissedElement = el;
    dismissedUntil = Date.now() + 3000;
  }
  if (requestHide) requestHide(true);
}

export function clearDismissedTokenOverlay() {
  dismissedElement = null;
  dismissedUntil = 0;
}

export function TokenOverlay({ currency = "USD" }: { currency?: DisplayCurrency }) {
  const [active, setActive] = useState<{
    symbol: string;
    top: number;
    left: number;
    width: number;
    pinned: boolean;
  } | null>(null);

  const activeRef = useRef(active);
  activeRef.current = active;

  const hideTimerRef = useRef<number | undefined>(undefined);
  const showTimerRef = useRef<number | undefined>(undefined);
  const triggerElRef = useRef<HTMLElement | null>(null);
  const cardElRef = useRef<HTMLDivElement | null>(null);
  const isMouseOverCardRef = useRef(false);

  const calculateCoords = (el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    const cardWidth = Math.min(500, window.innerWidth - 32);

    let left = rect.left;
    if (left + cardWidth > window.innerWidth - 16) {
      left = window.innerWidth - cardWidth - 16;
    }
    if (left < 16) left = 16;

    let top = rect.bottom + 8;
    const estimatedHeight = 410;
    if (top + estimatedHeight > window.innerHeight && rect.top > estimatedHeight + 16) {
      top = rect.top - estimatedHeight - 8;
    }
    if (top < 16) top = 16;

    return { top, left, width: cardWidth };
  };

  useEffect(() => {
    if (active) {
      document.body.classList.add("cl-overlay-active");
    } else {
      document.body.classList.remove("cl-overlay-active");
    }
    return () => {
      document.body.classList.remove("cl-overlay-active");
    };
  }, [active]);

  useEffect(() => {
    requestShow = ({ symbol, triggerEl, pinned = false }: TokenOverlayRequest) => {
      window.clearTimeout(hideTimerRef.current);
      triggerElRef.current = triggerEl;

      const performOpen = () => {
        const coords = calculateCoords(triggerEl);
        setActive({
          symbol: symbol.toUpperCase(),
          top: coords.top,
          left: coords.left,
          width: coords.width,
          pinned,
        });
      };

      if (pinned || activeRef.current != null) {
        window.clearTimeout(showTimerRef.current);
        performOpen();
      } else {
        window.clearTimeout(showTimerRef.current);
        showTimerRef.current = window.setTimeout(performOpen, 160);
      }
    };

    requestHide = (immediate = false) => {
      window.clearTimeout(showTimerRef.current);
      if (activeRef.current?.pinned && !immediate) return;

      if (immediate) {
        window.clearTimeout(hideTimerRef.current);
        isMouseOverCardRef.current = false;
        setActive(null);
        triggerElRef.current = null;
      } else {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = window.setTimeout(() => {
          if (isMouseOverCardRef.current && !activeRef.current?.pinned) {
            return; // Mouse is currently inside the card, do not dismiss!
          }
          setActive(null);
          triggerElRef.current = null;
        }, 450);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && activeRef.current) {
        requestHide?.(true);
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (!activeRef.current) return;
      const target = e.target as Node;
      if (cardElRef.current?.contains(target) || triggerElRef.current?.contains(target)) {
        return;
      }
      requestHide?.(true);
    };

    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      requestShow = null;
      requestHide = null;
      window.clearTimeout(hideTimerRef.current);
      window.clearTimeout(showTimerRef.current);
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  if (!active) return null;

  return (
    <div
      ref={cardElRef}
      className="cl-overlay-container"
      style={{
        position: "fixed",
        top: `${active.top}px`,
        left: `${active.left}px`,
        width: `${active.width}px`,
        zIndex: 2147483647,
        pointerEvents: "auto",
      }}
      onMouseEnter={() => {
        isMouseOverCardRef.current = true;
        window.clearTimeout(hideTimerRef.current);
      }}
      onMouseLeave={() => {
        isMouseOverCardRef.current = false;
        if (!active.pinned) {
          requestHide?.(false);
        }
      }}
      onClick={() => {
        // Any click inside the card automatically pins it so the user can interact freely
        if (!active.pinned) {
          setActive((prev) => (prev ? { ...prev, pinned: true } : null));
        }
      }}
    >
      <RichTokenCard
        symbol={active.symbol}
        currency={currency}
        onClose={() => dismissTokenOverlay(triggerElRef.current)}
      />
    </div>
  );
}

