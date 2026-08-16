import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CalcBlock } from "./calc-block";
import type { CalcSheet, EvaluateCalc } from "./types";

const SHEET: CalcSheet = {
  results: [
    {
      line: 1,
      tokens: [{ start: 0, end: 5, kind: "var-def", resolved: true }],
      value: { kind: "number", raw: 800, display: "800" },
    },
    {
      line: 2,
      tokens: [{ start: 0, end: 4, kind: "unknown", resolved: false }],
      error: { message: "unknown unit" },
    },
  ],
  total: { kind: "number", raw: 1000, display: "1,000" },
};

// No TooltipProvider on purpose: CalcBlock must render standalone (it uses a
// native `title`, not a Radix Tooltip) — including its inline error marker —
// since it mounts inside MarkdownPreview / a story with no provider ancestor.
function renderBlock(
  source: string,
  evaluate: EvaluateCalc,
  props?: Partial<{ showTotal: boolean }>,
) {
  return render(<CalcBlock source={source} evaluate={evaluate} showTotal {...props} />);
}

describe("CalcBlock", () => {
  it("renders the header, the result value, the total, and a per-line error", () => {
    renderBlock("gross = 800\noops", () => SHEET);
    expect(screen.getByText("calc")).toBeInTheDocument();
    expect(screen.getByText("800")).toBeInTheDocument(); // the value cell
    expect(screen.getByText("Total")).toBeInTheDocument();
    expect(screen.getByText("1,000")).toBeInTheDocument();
    expect(screen.getByLabelText(/^Error:/)).toBeInTheDocument();
  });

  it("tags each token span with its brand-calc-tok role class (the #226 non-hue cue hook)", () => {
    const { container } = renderBlock("gross = 800\noops", () => SHEET);
    // The role classes are what the low-chroma cues (weight/underline) hang off,
    // so both the editor decorations and the rendered block read identically.
    expect(container.querySelector(".brand-calc-tok.brand-calc-tok--var-def")).toBeInTheDocument();
    expect(container.querySelector(".brand-calc-tok.brand-calc-tok--unknown")).toBeInTheDocument();
  });

  it("does not bundle a math engine — values come only from the evaluate hook", () => {
    let called = "";
    renderBlock("anything", (src) => {
      called = src;
      return { results: [] };
    });
    expect(called).toBe("anything");
  });

  it("omits the total footer when showTotal is false", () => {
    renderBlock("gross = 800", () => SHEET, { showTotal: false });
    expect(screen.queryByText("Total")).not.toBeInTheDocument();
  });

  it("renders an empty calc block gracefully", () => {
    renderBlock("", () => ({ results: [] }));
    expect(screen.getByText("Empty calc block.")).toBeInTheDocument();
  });

  it("lifts a leading `# Heading` into the title bar and drops it from the body", () => {
    const sheet: CalcSheet = {
      results: [
        { line: 1, tokens: [] },
        { line: 2, tokens: [], value: { kind: "number", raw: 1, display: "1" } },
      ],
    };
    const { container } = render(
      <CalcBlock source={"# Lisbon trip\nx = 1"} evaluate={() => sheet} />,
    );
    // Title shown once (header), not duplicated as a body heading row, and the
    // neutral `calc` label is gone.
    expect(screen.getAllByText("Lisbon trip")).toHaveLength(1);
    expect(screen.queryByText("calc")).not.toBeInTheDocument();
    // The group is labelled by the title.
    expect(container.querySelector('[role="group"]')).toHaveAccessibleName("Lisbon trip");
  });

  it("lets the `title` prop override the displayed title", () => {
    const sheet: CalcSheet = { results: [{ line: 1, tokens: [] }] };
    render(<CalcBlock source={"x = 1"} title="Receipt" evaluate={() => sheet} />);
    expect(screen.getByText("Receipt")).toBeInTheDocument();
    expect(screen.queryByText("calc")).not.toBeInTheDocument();
  });

  it("marks rows with a rule (divider) and a tint via data attributes", () => {
    const sheet: CalcSheet = {
      results: [
        { line: 1, tokens: [], value: { kind: "number", raw: 1, display: "1" }, rule: "double" },
        { line: 2, tokens: [], value: { kind: "number", raw: 2, display: "2" }, tint: "success" },
      ],
    };
    const { container } = render(<CalcBlock source={"a = 1\nb = 2"} evaluate={() => sheet} />);
    expect(container.querySelector('[data-rule="double"]')).toBeInTheDocument();
    expect(container.querySelector('[data-tint="success"]')).toBeInTheDocument();
  });

  it("applies trailing author markers, strips them from the text, and hides them from evaluate", () => {
    let seen = "";
    const sheet: CalcSheet = {
      results: [
        { line: 1, tokens: [], value: { kind: "number", raw: 1, display: "1" } },
        { line: 2, tokens: [], value: { kind: "number", raw: 2, display: "2" } },
      ],
    };
    const { container } = render(
      <CalcBlock
        source={"a = 1 @success @line\nb = 2 @danger"}
        evaluate={(src) => {
          seen = src;
          return sheet;
        }}
      />,
    );
    // The evaluator never sees the markers (cleaned source).
    expect(seen).toBe("a = 1\nb = 2");
    // Markers are stripped from the rendered rows…
    expect(screen.queryByText(/@success|@line|@danger/)).not.toBeInTheDocument();
    // …and applied as tint/rule (note `@danger` → destructive).
    expect(container.querySelector('[data-rule="single"]')).toBeInTheDocument();
    expect(container.querySelector('[data-tint="success"]')).toBeInTheDocument();
    expect(container.querySelector('[data-tint="destructive"]')).toBeInTheDocument();
  });

  it("leaves an unrecognized trailing @word as literal text", () => {
    const sheet: CalcSheet = { results: [{ line: 1, tokens: [] }] };
    render(<CalcBlock source={"ping = host @bogus"} evaluate={() => sheet} />);
    expect(screen.getByText(/@bogus/)).toBeInTheDocument();
  });

  it("does not parse markers when markers={false}", () => {
    const sheet: CalcSheet = { results: [{ line: 1, tokens: [] }] };
    const { container } = render(
      <CalcBlock source={"a = 1 @success"} markers={false} evaluate={() => sheet} />,
    );
    expect(screen.getByText(/@success/)).toBeInTheDocument();
    expect(container.querySelector("[data-tint]")).not.toBeInTheDocument();
  });

  it("overrides the footer total value and label", () => {
    render(
      <CalcBlock
        source={"gross = 800"}
        evaluate={() => SHEET}
        totalLabel="Budget left"
        total={{ kind: "number", raw: 425, display: "425" }}
      />,
    );
    expect(screen.getByText("Budget left")).toBeInTheDocument();
    expect(screen.getByText("425")).toBeInTheDocument();
    // The overridden total replaces the sheet's computed total.
    expect(screen.queryByText("1,000")).not.toBeInTheDocument();
  });
});
