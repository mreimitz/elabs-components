import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { MarkdownPreview } from "./markdown-preview";
import type { IterationData, IterationSpec } from "../markdown-iteration";

afterEach(cleanup);

/*
 * `:::iterate` cells mount a NESTED MarkdownPreview (interpolated template →
 * Streamdown). That nested render is jsdom-sensitive (it is perturbed by other
 * Streamdown renders in the same file), so — per the suite convention — these
 * live in their OWN file with the HEAVIEST (nested-iteration) case FIRST.
 */

const PEOPLE = [
  { name: "Ada", role: "Engineering" },
  { name: "Bo", role: "Design" },
];

function evaluateIteration(spec: IterationSpec): IterationData | null {
  if (spec.kind === "pivot") {
    return {
      rowHeaders: ["Q1", "Q2"],
      colHeaders: ["EU", "US"],
      cells: ["Q1", "Q2"].flatMap((r) =>
        ["EU", "US"].map((c) => ({ row: r, col: c, context: { cell: `${r}-${c}` } })),
      ),
    };
  }
  // The nested case: each person owns a sub-list of projects.
  if (spec.source === "projects") {
    const projects = (spec.attributes.of ?? "").split(",").filter(Boolean);
    return { cells: projects.map((p) => ({ context: { project: p.trim() }, key: p })) };
  }
  return { cells: PEOPLE.map((p) => ({ context: p, key: p.name })) };
}

describe("MarkdownPreview — iteration (nested render, heaviest first)", () => {
  it("renders a nested :::iterate inside an iterated cell (depth-capped, no loop)", async () => {
    const md = `:::iterate{as="person"}
### {{person.name}}

:::iterate{source="projects" of="Alpha, Beta"}
- {{project}}
:::
:::`;
    render(<MarkdownPreview evaluateIteration={evaluateIteration}>{md}</MarkdownPreview>);
    await waitFor(() => expect(screen.getByText("Ada")).toBeInTheDocument(), { timeout: 8000 });
    // Inner iteration rendered the per-person project list — once per person (2),
    // proving the outer pass left `{{project}}` literal for the inner pass.
    expect(screen.getAllByText("Alpha")).toHaveLength(2);
    expect(screen.getAllByText("Beta")).toHaveLength(2);
  });
});

describe("MarkdownPreview — iteration layouts", () => {
  it("stacked: repeats the interpolated template per item", async () => {
    const md = `:::iterate{as="p" layout="stacked"}\n**{{p.name}}** — {{p.role}}\n:::`;
    const { container } = render(
      <MarkdownPreview evaluateIteration={evaluateIteration}>{md}</MarkdownPreview>,
    );
    await waitFor(() =>
      expect(container.querySelector('[data-iteration="iterate"]')).toBeInTheDocument(),
    );
    const group = container.querySelector('[data-iteration-layout="stacked"]')!;
    expect(group.textContent).toContain("Ada");
    expect(group.textContent).toContain("Engineering");
  });

  it("pivot: builds a matrix table with row + column headers", async () => {
    const md = `:::pivot\nCell {{cell}}\n:::`;
    const { container } = render(
      <MarkdownPreview evaluateIteration={evaluateIteration}>{md}</MarkdownPreview>,
    );
    await waitFor(() =>
      expect(container.querySelector('[data-iteration="pivot"]')).toBeInTheDocument(),
    );
    const table = container.querySelector("table")!;
    expect(within(table).getByRole("columnheader", { name: "EU" })).toBeInTheDocument();
    expect(within(table).getByRole("rowheader", { name: "Q1" })).toBeInTheDocument();
    expect(table.textContent).toContain("Q1-US");
  });

  it("does not parse :::iterate when no evaluateIteration is supplied", async () => {
    // Unknown container directive → the explicit unknown-block error, not a crash.
    render(<MarkdownPreview>{`:::iterate{as="p"}\n{{p.name}}\n:::`}</MarkdownPreview>);
    await waitFor(() => expect(screen.getByText(/Unknown block/i)).toBeInTheDocument());
  });
});
