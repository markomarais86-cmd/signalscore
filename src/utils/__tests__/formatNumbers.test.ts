import { describe, it, expect } from "vitest";
import { formatNumber, formatCurrency, formatAbbreviated } from "../format-numbers";

describe("formatNumber", () => {
  it("formats integers with commas", () => {
    expect(formatNumber(1234567)).toBe("1,234,567");
  });

  it("handles zero", () => {
    expect(formatNumber(0)).toBe("0");
  });

  it("parses string numbers", () => {
    expect(formatNumber("42000")).toBe("42,000");
  });

  it("returns '0' for NaN strings", () => {
    expect(formatNumber("abc")).toBe("0");
  });

  it("returns '0' for null/undefined", () => {
    expect(formatNumber(null as any)).toBe("0");
    expect(formatNumber(undefined as any)).toBe("0");
  });

  it("respects decimal places", () => {
    expect(formatNumber(1234.5678, 2)).toBe("1,234.57");
    expect(formatNumber(100, 2)).toBe("100.00");
  });
});

describe("formatCurrency", () => {
  it("formats USD by default", () => {
    expect(formatCurrency(1500)).toBe("$1,500");
  });

  it("handles zero", () => {
    expect(formatCurrency(0)).toBe("$0");
  });

  it("returns '$0' for null/undefined", () => {
    expect(formatCurrency(null as any)).toBe("$0");
    expect(formatCurrency(undefined as any)).toBe("$0");
  });

  it("formats large values", () => {
    expect(formatCurrency(1000000)).toBe("$1,000,000");
  });
});

describe("formatAbbreviated", () => {
  it("abbreviates billions", () => {
    expect(formatAbbreviated(2500000000)).toBe("2.5B");
  });

  it("abbreviates millions", () => {
    expect(formatAbbreviated(1200000)).toBe("1.2M");
  });

  it("abbreviates thousands", () => {
    expect(formatAbbreviated(5300)).toBe("5.3K");
  });

  it("returns plain number for small values", () => {
    expect(formatAbbreviated(42)).toBe("42");
    expect(formatAbbreviated(999)).toBe("999");
  });

  it("handles zero", () => {
    expect(formatAbbreviated(0)).toBe("0");
  });

  it("returns '0' for null/undefined", () => {
    expect(formatAbbreviated(null as any)).toBe("0");
    expect(formatAbbreviated(undefined as any)).toBe("0");
  });
});
