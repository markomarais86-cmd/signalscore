import { describe, it, expect } from "vitest";
import {
  formatToE164,
  isValidE164,
  getCountryCode,
  formatForDisplay,
  getCountryCodeFromCountry,
} from "../phone-formatter";

describe("formatToE164", () => {
  it("formats US number with country code", () => {
    expect(formatToE164("(415) 555-2671")).toBe("+14155552671");
  });

  it("returns null for null input", () => {
    expect(formatToE164(null)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(formatToE164("")).toBeNull();
  });

  it("returns null for non-digit strings", () => {
    expect(formatToE164("no-digits-here!")).toBeNull();
  });

  it("preserves existing country code", () => {
    expect(formatToE164("14155552671")).toBe("+14155552671");
  });

  it("uses custom default country code", () => {
    expect(formatToE164("7911123456", "44")).toBe("+447911123456");
  });
});

describe("isValidE164", () => {
  it("validates correct E.164 numbers", () => {
    expect(isValidE164("+14155552671")).toBe(true);
    expect(isValidE164("+447911123456")).toBe(true);
  });

  it("rejects invalid formats", () => {
    expect(isValidE164(null)).toBe(false);
    expect(isValidE164("14155552671")).toBe(false); // missing +
    expect(isValidE164("+0123")).toBe(false); // starts with 0
    expect(isValidE164("+")).toBe(false);
  });
});

describe("getCountryCode", () => {
  it("extracts country code prefix (up to 3 digits)", () => {
    expect(getCountryCode("+14155552671")).toBe("141");
    expect(getCountryCode("+447911123456")).toBe("44");
  });

  it("returns null for invalid input", () => {
    expect(getCountryCode(null)).toBeNull();
    expect(getCountryCode("14155552671")).toBeNull();
  });
});

describe("formatForDisplay", () => {
  it("formats 11-digit US numbers", () => {
    expect(formatForDisplay("14155552671")).toBe("(415) 555-2671");
  });

  it("formats 10-digit numbers", () => {
    expect(formatForDisplay("4155552671")).toBe("(415) 555-2671");
  });

  it("returns null for null input", () => {
    expect(formatForDisplay(null)).toBeNull();
  });

  it("returns original for international numbers", () => {
    expect(formatForDisplay("+447911123456")).toBe("+447911123456");
  });
});

describe("getCountryCodeFromCountry", () => {
  it("returns correct codes for known countries", () => {
    expect(getCountryCodeFromCountry("United States")).toBe("1");
    expect(getCountryCodeFromCountry("United Kingdom")).toBe("44");
    expect(getCountryCodeFromCountry("Germany")).toBe("49");
    expect(getCountryCodeFromCountry("Japan")).toBe("81");
  });

  it("handles abbreviations", () => {
    expect(getCountryCodeFromCountry("US")).toBe("1");
    expect(getCountryCodeFromCountry("UK")).toBe("44");
  });

  it("defaults to US for unknown countries", () => {
    expect(getCountryCodeFromCountry("Narnia")).toBe("1");
    expect(getCountryCodeFromCountry(null)).toBe("1");
  });
});
