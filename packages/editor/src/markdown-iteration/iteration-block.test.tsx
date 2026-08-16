import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { IterationBlock, type IterationData, type IterationSpec } from "./iteration";

afterEach(cleanup);

// A plain cell renderer (NOT a nested MarkdownPreview) keeps these tests
// deterministic + light — they exercise layout + interpolation, not markdown.
const plainRender = (md: string) => <span data-cell="">{md}</span>;

const spec = (over: Partial<IterationSpec> = {}): IterationSpec => ({
  kind: "iterate",
  layout: "stacked",
  template: "{{name}}",
  as: "item",
  attributes: {},
  ...over,
});

describe("IterationBlock", () => {
  it("stacked: renders one interpolated cell per item, in order", () => {
    const data: IterationData = {
      cells: [{ context: { name: "Ada" } }, { context: { name: "Bo" } }],
    };
    render(<IterationBlock spec={spec()} evaluate={() => data} render={plainRender} />);
    const cells = screen.getAllByText(/Ada|Bo/);
    expect(cells.map((c) => c.textContent)).toEqual(["Ada", "Bo"]);
  });

  it("grid: lays cells into a table with the given column headers", () => {
    const data: IterationData = {
      columns: ["A", "B"],
      cells: [{ context: { n: 1 } }, { context: { n: 2 } }, { context: { n: 3 } }],
    };
    render(
      <IterationBlock
        spec={spec({ layout: "grid", template: "{{n}}" })}
        evaluate={() => data}
        render={plainRender}
      />,
    );
    expect(screen.getByRole("columnheader", { name: "A" })).toBeInTheDocument();
    // 3 cells + 2 columns → 2 rows (row-major).
    expect(screen.getAllByRole("row")).toHaveLength(3); // header + 2 body rows
  });

  it("bento: renders one BentoGrid tile (bg-card surface) per cell", () => {
    const data: IterationData = {
      cells: [{ context: { n: 1 } }, { context: { n: 2 } }, { context: { n: 3 } }],
    };
    const { container } = render(
      <IterationBlock
        spec={spec({ layout: "bento", template: "{{n}}" })}
        evaluate={() => data}
        render={plainRender}
      />,
    );
    expect(container.querySelector('[data-iteration-layout="bento"]')).toBeInTheDocument();
    // Each tile composes Card (bg-card) → 3 cells = 3 tiles.
    expect(container.querySelectorAll(".bg-card")).toHaveLength(3);
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("matrix: builds a pivot table with row + column headers and cells at intersections", () => {
    const data: IterationData = {
      rowHeaders: ["Q1", "Q2"],
      colHeaders: ["EU", "US"],
      cells: ["Q1", "Q2"].flatMap((r) =>
        ["EU", "US"].map((c) => ({ row: r, col: c, context: { v: `${r}/${c}` } })),
      ),
    };
    render(
      <IterationBlock
        spec={spec({ kind: "pivot", layout: "matrix", template: "{{v}}" })}
        evaluate={() => data}
        render={plainRender}
      />,
    );
    expect(screen.getByRole("columnheader", { name: "EU" })).toBeInTheDocument();
    expect(screen.getByRole("rowheader", { name: "Q1" })).toBeInTheDocument();
    expect(screen.getByText("Q1/US")).toBeInTheDocument();
  });

  it("matrix without both axes falls back to a grid (no crash)", () => {
    const data: IterationData = { cells: [{ context: { v: "x" } }] };
    render(
      <IterationBlock
        spec={spec({ kind: "pivot", layout: "matrix", template: "{{v}}" })}
        evaluate={() => data}
        render={plainRender}
      />,
    );
    expect(screen.getByText("x")).toBeInTheDocument();
  });

  it("renders a quiet empty state when there is no data", () => {
    render(<IterationBlock spec={spec()} evaluate={() => null} render={plainRender} />);
    expect(screen.getByRole("group", { name: "Iteration" })).toHaveTextContent(
      /Nothing to iterate/i,
    );
  });

  it("degrades a throwing evaluate to the empty state (never crashes)", () => {
    const evaluate = vi.fn(() => {
      throw new Error("boom");
    });
    render(<IterationBlock spec={spec()} evaluate={evaluate} render={plainRender} />);
    expect(screen.getByRole("group", { name: "Iteration" })).toBeInTheDocument();
  });

  it("uses a cell's pre-rendered markdown, skipping interpolate", () => {
    const interpolate = vi.fn(() => "INTERPOLATED");
    const data: IterationData = { cells: [{ context: {}, markdown: "PRERENDERED" }] };
    render(
      <IterationBlock
        spec={spec()}
        evaluate={() => data}
        interpolate={interpolate}
        render={plainRender}
      />,
    );
    expect(screen.getByText("PRERENDERED")).toBeInTheDocument();
    expect(interpolate).not.toHaveBeenCalled();
  });

  it("exposes the loop variable + fields to the template scope", () => {
    const data: IterationData = { cells: [{ context: { name: "Ada" } }] };
    render(
      <IterationBlock
        spec={spec({ as: "p", template: "{{p.name}}={{name}}" })}
        evaluate={() => data}
        render={plainRender}
      />,
    );
    expect(screen.getByText("Ada=Ada")).toBeInTheDocument();
  });
});
