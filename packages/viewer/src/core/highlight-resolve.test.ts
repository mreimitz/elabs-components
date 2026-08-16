import { normalizeQuoteTextWithOffsets, type DocumentAddress } from "@elabs-ai/components-ui";
import { describe, expect, it } from "vitest";

import type { DocumentHighlight, HighlightSupport } from "./highlight";
import { locateQuote, resolveHighlights, type HighlightResolveContext } from "./highlight-resolve";

const DOCUMENT = "Revenue rose 12% in Q3.\nCosts fell.\nRevenue rose again in Q4.";

const ALL_KINDS: HighlightSupport = ["quote", "range", "rect"];

function context(overrides: Partial<HighlightResolveContext> = {}): HighlightResolveContext {
  return {
    normalized: normalizeQuoteTextWithOffsets(DOCUMENT),
    textLength: DOCUMENT.length,
    supported: ALL_KINDS,
    ...overrides,
  };
}

function cite(id: string, address: DocumentAddress): DocumentHighlight {
  return { id, address };
}

describe("locateQuote", () => {
  const normalized = normalizeQuoteTextWithOffsets(DOCUMENT);

  it("finds a passage whose whitespace and case do not match the file", () => {
    // What a model actually emits: re-wrapped, re-cased, re-typed.
    const range = locateQuote(normalized, { kind: "quote", text: "  COSTS\n  fell " });
    expect(range && DOCUMENT.slice(range[0], range[1])).toBe("Costs fell");
  });

  it("finds a passage whose quote glyphs do not match the file", () => {
    const file = normalizeQuoteTextWithOffsets(`He said "no" — twice`);
    const range = locateQuote(file, { kind: "quote", text: "“no” – twice" });
    expect(range && `He said "no" — twice`.slice(range[0], range[1])).toBe(`"no" — twice`);
  });

  it("takes the first occurrence by default", () => {
    const range = locateQuote(normalized, { kind: "quote", text: "Revenue rose" });
    expect(range?.[0]).toBe(0);
  });

  it("takes the occurrence the caller asked for", () => {
    const range = locateQuote(normalized, {
      kind: "quote",
      text: "Revenue rose",
      occurrence: 2,
    });
    expect(range?.[0]).toBe(DOCUMENT.lastIndexOf("Revenue rose"));
  });

  it("misses rather than falling back when the occurrence does not exist", () => {
    // Quietly marking the first would be a confidently wrong citation.
    expect(
      locateQuote(normalized, { kind: "quote", text: "Revenue rose", occurrence: 9 }),
    ).toBeUndefined();
  });

  it("uses `near.offset` to pick between repeats", () => {
    const range = locateQuote(normalized, {
      kind: "quote",
      text: "Revenue rose",
      near: { offset: DOCUMENT.length },
    });
    expect(range?.[0]).toBe(DOCUMENT.lastIndexOf("Revenue rose"));
  });

  it("still finds a passage that is nowhere near the hint", () => {
    // `near` disambiguates; it does not restrict.
    const range = locateQuote(normalized, {
      kind: "quote",
      text: "Costs fell",
      near: { offset: 0 },
    });
    expect(range && DOCUMENT.slice(range[0], range[1])).toBe("Costs fell");
  });

  it("returns nothing for an absent or empty passage", () => {
    expect(locateQuote(normalized, { kind: "quote", text: "profit" })).toBeUndefined();
    expect(locateQuote(normalized, { kind: "quote", text: "   " })).toBeUndefined();
  });
});

describe("resolveHighlights", () => {
  it("reports a kind the adapter never declared as a capability gap", () => {
    // Not a failure and not retryable — the file is fine, this build simply
    // cannot draw a box on a Word document.
    const [resolved] = resolveHighlights(
      [cite("a", { kind: "rect", page: 1, rects: [{ x: 0, y: 0, width: 1, height: 1 }] })],
      context({ supported: ["quote"] }),
    );
    expect(resolved?.status).toBe("unsupported");
  });

  it("tells 'not in the document' apart from 'past what we previewed'", () => {
    const address: DocumentAddress = { kind: "quote", text: "nowhere" };
    expect(resolveHighlights([cite("a", address)], context())[0]).toMatchObject({
      status: "not-found",
      reason: "absent",
    });
    expect(resolveHighlights([cite("a", address)], context({ truncated: true }))[0]).toMatchObject({
      status: "not-found",
      reason: "truncated",
    });
  });

  it("clamps a range to the projection, and calls an emptied one a miss", () => {
    const [clamped] = resolveHighlights(
      [cite("a", { kind: "range", start: 5, end: 5000 })],
      context(),
    );
    expect(clamped).toMatchObject({ status: "resolved", range: [5, DOCUMENT.length] });

    // Offsets computed against a LONGER projection than the one we have: the
    // clamp collapses them, and a zero-width mark would point at nothing.
    const [collapsed] = resolveHighlights(
      [cite("b", { kind: "range", start: 900, end: 950 })],
      context(),
    );
    expect(collapsed?.status).toBe("not-found");
  });

  it("never lets a producer's page HINT stand in for where the passage landed", () => {
    // The regression this locks: `page` was copied off the address, and the PDF
    // renderer prefers `ResolvedHighlight.page` over its own index — so a stale
    // hint turned the reader to a blank page while the mark sat somewhere else.
    // Both fields are documented as hints; only `rect` may say where it is.
    const [byRange] = resolveHighlights(
      [cite("a", { kind: "range", start: 0, end: 5, page: 99 })],
      context(),
    );
    expect(byRange).toMatchObject({ status: "resolved", range: [0, 5] });
    expect(byRange?.page).toBeUndefined();

    const [byQuote] = resolveHighlights(
      [cite("b", { kind: "quote", text: "Costs fell", near: { page: 99 } })],
      context(),
    );
    expect(byQuote?.status).toBe("resolved");
    expect(byQuote?.page).toBeUndefined();
  });

  it("passes a rect straight through — geometry needs no text", () => {
    const rects = [{ x: 0.1, y: 0.2, width: 0.3, height: 0.05 }];
    const [resolved] = resolveHighlights(
      [cite("a", { kind: "rect", page: 3, rects })],
      context({ normalized: undefined, textLength: undefined }),
    );
    expect(resolved).toMatchObject({ status: "resolved", page: 3, rects });
  });

  it("orders by position in the DOCUMENT, not by the order asked for", () => {
    // "Next match" has to mean the next one down the page; an app listing
    // citations by relevance would otherwise send the reader backwards.
    const resolved = resolveHighlights(
      [cite("late", { kind: "quote", text: "Q4" }), cite("early", { kind: "quote", text: "Q3" })],
      context(),
    );
    expect(resolved.map((highlight) => highlight.id)).toEqual(["early", "late"]);
  });

  it("numbers per source, so the find count never includes citations", () => {
    const resolved = resolveHighlights(
      [
        cite("c1", { kind: "quote", text: "Revenue" }),
        { id: "f1", source: "search", address: { kind: "range", start: 24, end: 29 } },
        { id: "f2", source: "search", address: { kind: "range", start: 35, end: 42 } },
      ],
      context(),
    );
    const byId = new Map(resolved.map((highlight) => [highlight.id, highlight]));
    expect(byId.get("c1")?.index).toBe(1);
    expect(byId.get("f1")?.index).toBe(1);
    expect(byId.get("f2")?.index).toBe(2);
  });

  it("does not let a miss consume a number the reader is counting through", () => {
    const resolved = resolveHighlights(
      [
        cite("hit", { kind: "quote", text: "Revenue rose 12%" }),
        cite("miss", { kind: "quote", text: "profit" }),
        cite("hit2", { kind: "quote", text: "Q4" }),
      ],
      context(),
    );
    const byId = new Map(resolved.map((highlight) => [highlight.id, highlight]));
    expect(byId.get("hit")?.index).toBe(1);
    expect(byId.get("hit2")?.index).toBe(2);
    expect(byId.get("miss")?.index).toBeUndefined();
  });

  it("flags exactly the active one", () => {
    const resolved = resolveHighlights(
      [cite("a", { kind: "quote", text: "Q3" }), cite("b", { kind: "quote", text: "Q4" })],
      context({ activeId: "b" }),
    );
    expect(resolved.filter((highlight) => highlight.active).map((h) => h.id)).toEqual(["b"]);
  });

  it("keeps the request on a miss, so the chrome has something to name", () => {
    const [resolved] = resolveHighlights(
      [{ id: "a", label: "Q2 guidance", address: { kind: "quote", text: "nowhere" } }],
      context(),
    );
    expect(resolved).toMatchObject({ label: "Q2 guidance", address: { kind: "quote" } });
  });
});
