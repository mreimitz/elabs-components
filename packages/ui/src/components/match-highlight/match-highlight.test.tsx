import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { MatchHighlight, queryToRanges, normalizeRanges } from "./match-highlight";

describe("MatchHighlight", () => {
  it("renders one <mark> per case-insensitive query occurrence, text intact", () => {
    const { container } = render(<MatchHighlight text="My Notes note" query="note" />);
    const marks = container.querySelectorAll("mark");
    expect(marks).toHaveLength(2);
    expect(marks[0]?.textContent).toBe("Note");
    expect(marks[1]?.textContent).toBe("note");
    // Full string is preserved for screen readers.
    expect(container.textContent).toBe("My Notes note");
  });

  it("merges adjacent precomputed ranges into a single <mark>", () => {
    const { container } = render(
      <MatchHighlight
        text="abcdef"
        ranges={[
          [0, 2],
          [2, 4],
        ]}
      />,
    );
    const marks = container.querySelectorAll("mark");
    expect(marks).toHaveLength(1);
    expect(marks[0]?.textContent).toBe("abcd"); // [0,4)
  });

  it("renders no <mark> for a non-matching query", () => {
    const { container } = render(<MatchHighlight text="hello world" query="xyz" />);
    expect(container.querySelectorAll("mark")).toHaveLength(0);
    expect(container.textContent).toBe("hello world");
  });

  it("renders no <mark> for empty / whitespace-only-vs-nothing query", () => {
    const { container } = render(<MatchHighlight text="hello" query="" />);
    expect(container.querySelectorAll("mark")).toHaveLength(0);
    expect(container.textContent).toBe("hello");
  });

  it("highlights multiple needles", () => {
    const { container } = render(<MatchHighlight text="red green blue" query={["red", "blue"]} />);
    const marks = container.querySelectorAll("mark");
    expect(marks).toHaveLength(2);
    expect(marks[0]?.textContent).toBe("red");
    expect(marks[1]?.textContent).toBe("blue");
  });

  it("respects caseSensitive", () => {
    const { container } = render(<MatchHighlight text="Note note" query="note" caseSensitive />);
    const marks = container.querySelectorAll("mark");
    expect(marks).toHaveLength(1);
    expect(marks[0]?.textContent).toBe("note");
  });

  it("ranges win over query", () => {
    const { container } = render(<MatchHighlight text="abcdef" query="ef" ranges={[[0, 1]]} />);
    const marks = container.querySelectorAll("mark");
    expect(marks).toHaveLength(1);
    expect(marks[0]?.textContent).toBe("a");
  });

  it("handles matches at string start and end (non-adjacent stay separate)", () => {
    const { container } = render(<MatchHighlight text="abc abc" query="abc" />);
    const marks = container.querySelectorAll("mark");
    expect(marks).toHaveLength(2);
    expect(marks[0]?.textContent).toBe("abc"); // at index 0 (start)
    expect(marks[1]?.textContent).toBe("abc"); // ending at text.length (end)
    expect(container.textContent).toBe("abc abc");
  });

  it("merges two adjacent query matches into one contiguous mark (no seam)", () => {
    const { container } = render(<MatchHighlight text="abcabc" query="abc" />);
    const marks = container.querySelectorAll("mark");
    expect(marks).toHaveLength(1);
    expect(marks[0]?.textContent).toBe("abcabc");
  });

  it("handles unicode / accented needles without index drift", () => {
    const { container } = render(<MatchHighlight text="café Café" query="café" />);
    const marks = container.querySelectorAll("mark");
    expect(marks).toHaveLength(2);
    expect(container.textContent).toBe("café Café");
  });

  it("styles the mark with the semantic highlight token pair", () => {
    const { container } = render(<MatchHighlight text="find me" query="me" />);
    const mark = container.querySelector("mark");
    expect(mark?.className).toContain("bg-highlight");
    expect(mark?.className).toContain("text-highlight-foreground");
  });

  it("marks exactly one mark as current for activeIndex, and none by default", () => {
    const { container, rerender } = render(<MatchHighlight text="abc abc abc" query="abc" />);
    expect(container.querySelectorAll("mark[data-active]")).toHaveLength(0);
    expect(container.querySelectorAll("mark[aria-current]")).toHaveLength(0);

    rerender(<MatchHighlight text="abc abc abc" query="abc" activeIndex={1} />);
    const active = container.querySelectorAll("mark[data-active]");
    expect(active).toHaveLength(1);
    expect(active[0]?.getAttribute("aria-current")).toBe("true");
    // Second of the three, in document order.
    expect(container.querySelectorAll("mark")[1]).toBe(active[0]);
  });

  it("gives the current mark its own token pair, distinct from the rest", () => {
    const { container } = render(
      <MatchHighlight text="abc abc" query="abc" activeIndex={0} data-testid="mh" />,
    );
    const [current, other] = Array.from(container.querySelectorAll("mark"));
    expect(current?.className).toContain("bg-highlight-active");
    expect(current?.className).toContain("text-highlight-active-foreground");
    expect(other?.className).toContain("bg-highlight");
    expect(other?.className).not.toContain("bg-highlight-active");
  });

  it("signals the current mark without relying on colour (WCAG 1.4.1)", () => {
    const { container } = render(<MatchHighlight text="abc abc" query="abc" activeIndex={0} />);
    const current = container.querySelector("mark[data-active]");
    // An outline is a shape cue that survives greyscale; aria-current carries it
    // to assistive tech, which never sees either colour.
    expect(current?.className).toContain("outline-2");
    expect(current?.getAttribute("aria-current")).toBe("true");
  });

  it("ignores an out-of-range activeIndex rather than clamping", () => {
    const { container } = render(<MatchHighlight text="abc abc" query="abc" activeIndex={7} />);
    expect(container.querySelectorAll("mark")).toHaveLength(2);
    expect(container.querySelectorAll("mark[data-active]")).toHaveLength(0);
  });

  it("counts activeIndex against the MERGED ranges, not the raw ones", () => {
    // [0,2) + [2,4) merge into one "abcd", so index 1 is the SECOND mark ("f").
    const { container } = render(
      <MatchHighlight
        text="abcdef"
        ranges={[
          [0, 2],
          [2, 4],
          [5, 6],
        ]}
        activeIndex={1}
      />,
    );
    const marks = container.querySelectorAll("mark");
    expect(marks).toHaveLength(2);
    expect(container.querySelector("mark[data-active]")?.textContent).toBe("f");
  });

  it("exposes stable data-slot selectors on the root and every mark", () => {
    const { container } = render(<MatchHighlight text="abc abc" query="abc" />);
    expect(container.querySelector('[data-slot="match-highlight"]')?.tagName).toBe("SPAN");
    expect(container.querySelectorAll('[data-slot="match-highlight-mark"]')).toHaveLength(2);
  });

  it("merges className last and spreads props onto the span", () => {
    const { container } = render(
      <MatchHighlight text="x" query="x" className="custom-x" data-testid="mh" />,
    );
    const span = container.querySelector("span");
    expect(span?.className).toContain("custom-x");
    expect(span?.getAttribute("data-testid")).toBe("mh");
  });
});

describe("range helpers", () => {
  it("queryToRanges finds overlapping-needle matches", () => {
    // "ab" [0,2) and "bc" [1,3) overlap; normalize should later merge.
    expect(queryToRanges("abc", ["ab", "bc"])).toEqual([
      [0, 2],
      [1, 3],
    ]);
  });

  it("normalizeRanges clamps, sorts, and merges overlaps + adjacency", () => {
    expect(
      normalizeRanges(
        [
          [1, 3],
          [2, 5],
          [5, 6],
        ],
        10,
      ),
    ).toEqual([[1, 6]]);
    expect(
      normalizeRanges(
        [
          [-2, 2],
          [8, 99],
        ],
        10,
      ),
    ).toEqual([
      [0, 2],
      [8, 10],
    ]);
    expect(normalizeRanges([[4, 4]], 10)).toEqual([]); // empty range dropped
  });
});
