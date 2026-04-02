import { describe, it, expect } from "vitest";
import { normalizeDomain, createNormalizedDomainMap } from "../domain-normalizer";

describe("normalizeDomain", () => {
  it("removes https protocol", () => {
    expect(normalizeDomain("https://example.com")).toBe("example.com");
  });

  it("removes http protocol", () => {
    expect(normalizeDomain("http://example.com")).toBe("example.com");
  });

  it("removes www prefix", () => {
    expect(normalizeDomain("www.example.com")).toBe("example.com");
  });

  it("removes protocol and www", () => {
    expect(normalizeDomain("https://www.example.com")).toBe("example.com");
  });

  it("removes trailing paths", () => {
    expect(normalizeDomain("example.com/page/sub")).toBe("example.com");
  });

  it("removes trailing dots", () => {
    expect(normalizeDomain("example.com.")).toBe("example.com");
  });

  it("lowercases the domain", () => {
    expect(normalizeDomain("Example.COM")).toBe("example.com");
  });

  it("trims whitespace", () => {
    expect(normalizeDomain("  example.com  ")).toBe("example.com");
  });

  it("returns empty string for null/undefined", () => {
    expect(normalizeDomain(null)).toBe("");
    expect(normalizeDomain(undefined)).toBe("");
    expect(normalizeDomain("")).toBe("");
  });
});

describe("createNormalizedDomainMap", () => {
  it("maps normalized domains to external ids", () => {
    const accounts = [
      { domain: "https://www.acme.com/about", external_id: "1" },
      { domain: "Widget.io", external_id: "2" },
    ];
    const map = createNormalizedDomainMap(accounts);
    expect(map.get("acme.com")).toBe("1");
    expect(map.get("widget.io")).toBe("2");
  });

  it("skips null domains", () => {
    const accounts = [
      { domain: null, external_id: "1" },
      { domain: "example.com", external_id: "2" },
    ];
    const map = createNormalizedDomainMap(accounts);
    expect(map.size).toBe(1);
    expect(map.get("example.com")).toBe("2");
  });
});
