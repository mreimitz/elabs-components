import { describe, expect, it } from "vitest";
import { initialsOf } from "./initials";

describe("initialsOf", () => {
  it("takes the first letter of the first two words, upper-cased", () => {
    expect(initialsOf("Mara Osei")).toBe("MO");
    expect(initialsOf("ada lovelace byron")).toBe("AL");
  });
  it("handles single words, e-mails and stray whitespace", () => {
    expect(initialsOf("priya")).toBe("P");
    expect(initialsOf("  jo@example.com ")).toBe("J");
    expect(initialsOf("")).toBe("");
  });
  it("respects a custom maximum and multi-byte glyphs", () => {
    expect(initialsOf("Ada Lovelace Byron", 3)).toBe("ALB");
    expect(initialsOf("Émile Zola")).toBe("ÉZ");
  });
});
