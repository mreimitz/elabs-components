import { describe, expect, it } from "vitest";

import { collectCitations, parseCitationBracket, type CitationData } from "./citations";

describe("parseCitationBracket", () => {
  it("parses a single key", () => {
    expect(parseCitationBracket("@smith2020")).toEqual([{ key: "smith2020" }]);
  });

  it("parses multiple `;`-separated keys", () => {
    expect(parseCitationBracket("@a; @b")).toEqual([{ key: "a" }, { key: "b" }]);
  });

  it("captures a locator after the key", () => {
    expect(parseCitationBracket("@smith2020, p. 5")).toEqual([
      { key: "smith2020", locator: "p. 5" },
    ]);
  });

  it("captures the suppress-author marker", () => {
    expect(parseCitationBracket("-@smith2020")).toEqual([
      { key: "smith2020", suppressAuthor: true },
    ]);
  });

  it("captures a prefix", () => {
    expect(parseCitationBracket("see @smith2020")).toEqual([{ key: "smith2020", prefix: "see" }]);
  });

  it("accepts Better-BibTeX keys with separators", () => {
    expect(parseCitationBracket("@smith:2020a")).toEqual([{ key: "smith:2020a" }]);
  });

  it("returns null for ordinary bracketed prose (no @key)", () => {
    expect(parseCitationBracket("see figure 1")).toBeNull();
    expect(parseCitationBracket("i")).toBeNull();
  });

  it("returns null when any `;`-part is not a citation", () => {
    expect(parseCitationBracket("@a; not a cite")).toBeNull();
  });
});

describe("collectCitations", () => {
  const DB: Record<string, CitationData> = {
    smith2020: { author: "Smith", year: 2020 },
    jones2019: { author: "Jones", year: 2019 },
  };
  const resolve = (k: string) => DB[k] ?? null;

  it("numbers resolved citations in first-appearance order", () => {
    const md = "First [@jones2019], then [@smith2020], then [@jones2019] again.";
    const { order, byKey } = collectCitations(md, resolve);
    expect(order.map((e) => e.key)).toEqual(["jones2019", "smith2020"]);
    expect(byKey.get("jones2019")?.n).toBe(1);
    expect(byKey.get("smith2020")?.n).toBe(2);
  });

  it("records unresolved keys without assigning a number", () => {
    const md = "Known [@smith2020] and unknown [@ghost1999].";
    const { order, byKey } = collectCitations(md, resolve);
    expect(order.map((e) => e.key)).toEqual(["smith2020"]);
    expect(byKey.get("ghost1999")).toEqual({ key: "ghost1999", data: null });
    expect(byKey.get("smith2020")?.n).toBe(1);
  });

  it("collects every key in a multi-key bracket", () => {
    const { byKey } = collectCitations("[@smith2020; @jones2019]", resolve);
    expect(byKey.get("smith2020")?.n).toBe(1);
    expect(byKey.get("jones2019")?.n).toBe(2);
  });

  it("ignores non-citation brackets", () => {
    const { order } = collectCitations("An array[index] and a [link](x).", resolve);
    expect(order).toHaveLength(0);
  });
});
