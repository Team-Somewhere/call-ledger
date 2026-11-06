import { describe, expect, it } from "vitest";
import { formatCompact, formatCurrency, formatPercent, usdToInr } from "../utils/formatting";

describe("INR and USD formatting", () => {
  it("formats INR with Indian digit grouping", () => {
    // Indian grouping: 2,50,000 (lakh), not 250,000.
    expect(formatCurrency(250000, "INR")).toBe("₹2,50,000.00");
  });

  it("formats USD in the en-US style", () => {
    expect(formatCurrency(3000, "USD")).toBe("$3,000.00");
  });

  it("keeps precision for sub-dollar token prices", () => {
    expect(formatCurrency(0.00012345, "USD")).toMatch(/^\$0\.00012/);
  });

  it("returns Unavailable instead of a number for missing values", () => {
    expect(formatCurrency(null, "INR")).toBe("Unavailable");
    expect(formatCurrency(Number.NaN, "USD")).toBe("Unavailable");
  });

  it("compacts large INR figures using lakh/crore-friendly notation", () => {
    expect(formatCompact(94_000_000, "INR")).toMatch(/₹/);
  });

  it("converts USD to INR with a supplied rate", () => {
    expect(usdToInr(100, 94.5)).toBeCloseTo(9450);
  });

  it("formats signed percentages", () => {
    expect(formatPercent(2.5)).toBe("+2.50%");
    expect(formatPercent(-1.2)).toBe("-1.20%");
    expect(formatPercent(null)).toBe("—");
  });
});
