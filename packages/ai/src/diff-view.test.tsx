import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type DiffLine } from "@elabs-ai/components-ui";
import { DiffView } from "./diff-view";

/**
 * No `LocaleProvider` wrapper: `useLocale()` falls back to the shipped English
 * defaults, so these assertions prove the real `ai.diffView.*` catalogue in
 * `packages/ui/src/components/locale-provider/messages.ts` — not a local stub
 * that would keep passing if the central entry were missing or misspelled.
 */
function renderDiffView(ui: React.ReactElement) {
  return render(ui);
}

const MIXED_LINES: DiffLine[] = [
  { type: "hunk", text: "@@ -1,3 +1,4 @@" },
  { type: "context", oldNumber: 1, newNumber: 1, text: "function add(a, b) {" },
  { type: "del", oldNumber: 2, text: "  return a - b; // bug" },
  { type: "add", newNumber: 2, text: "  return a + b;" },
  { type: "add", newNumber: 3, text: "  // fixed" },
  { type: "context", oldNumber: 3, newNumber: 4, text: "}" },
];

describe("DiffView — gutter correctness (the off-by-one this model exists to prevent)", () => {
  it("shows an add row's new number only, and a del row's old number only", () => {
    const { container } = renderDiffView(<DiffView lines={MIXED_LINES} />);
    const rows = container.querySelectorAll('[data-slot="diff-view-row"][data-diff-type]');

    const del = Array.from(rows).find((r) => r.getAttribute("data-diff-type") === "del")!;
    expect(within(del as HTMLElement).getByText("2")).toBeInTheDocument();
    expect(del.querySelector('[data-slot="diff-view-gutter-old"]')?.textContent).toBe("2");
    expect(del.querySelector('[data-slot="diff-view-gutter-new"]')?.textContent).toBe("");

    const add = Array.from(rows).find(
      (r) => r.getAttribute("data-diff-type") === "add" && r.textContent?.includes("fixed"),
    )!;
    expect(add.querySelector('[data-slot="diff-view-gutter-new"]')?.textContent).toBe("3");
    expect(add.querySelector('[data-slot="diff-view-gutter-old"]')?.textContent).toBe("");

    const context = Array.from(rows).find((r) => r.getAttribute("data-diff-type") === "context")!;
    expect(context.querySelector('[data-slot="diff-view-gutter-old"]')?.textContent).toBe("1");
    expect(context.querySelector('[data-slot="diff-view-gutter-new"]')?.textContent).toBe("1");
  });
});

describe("DiffView — colour is never the only channel (accessibility.md)", () => {
  it("gives add and del rows DIFFERENT accessible text and a different marker glyph — not merely different classes", () => {
    const { container } = renderDiffView(
      <DiffView
        lines={[
          { type: "del", oldNumber: 1, text: "old line" },
          { type: "add", newNumber: 1, text: "new line" },
        ]}
      />,
    );

    // Accessible text: the sr-only polarity word actually differs.
    expect(screen.getByText("Added:", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("Removed:", { exact: false })).toBeInTheDocument();

    // Marker glyph: a real, different rendered character per row — the shape
    // channel a colour-blind or greyscale reader relies on.
    const delMarker = container.querySelector(
      '[data-diff-type="del"] [data-slot="diff-view-marker"]',
    );
    const addMarker = container.querySelector(
      '[data-diff-type="add"] [data-slot="diff-view-marker"]',
    );
    expect(delMarker?.textContent).toBe("−");
    expect(addMarker?.textContent).toBe("+");
    expect(delMarker?.textContent).not.toBe(addMarker?.textContent);
  });

  it("gives the del row's marker a distinct tone class from the add row's — but that alone is insufficient (locked above by text+glyph)", () => {
    const { container } = renderDiffView(
      <DiffView
        lines={[
          { type: "del", oldNumber: 1, text: "old line" },
          { type: "add", newNumber: 1, text: "new line" },
        ]}
      />,
    );
    const delMarker = container.querySelector(
      '[data-diff-type="del"] [data-slot="diff-view-marker"]',
    );
    const addMarker = container.querySelector(
      '[data-diff-type="add"] [data-slot="diff-view-marker"]',
    );
    expect(delMarker?.className).not.toBe(addMarker?.className);
  });
});

describe("DiffView — loading vocabulary (loading-states.md)", () => {
  it("loading renders layout-shaped skeleton rows sharing the real row's height class (no shift on settle)", () => {
    const { container: loadingContainer } = renderDiffView(<DiffView lines={[]} loading />);
    const { container: settledContainer } = renderDiffView(<DiffView lines={MIXED_LINES} />);

    const skeletonRow = loadingContainer.querySelector('[data-slot="diff-view-row"]');
    const realRow = settledContainer.querySelector(
      '[data-slot="diff-view-row"][data-diff-type="add"]',
    );
    expect(skeletonRow).toBeTruthy();
    expect(realRow).toBeTruthy();
    // Same grid template + padding class => same row height; only the tint axis differs.
    expect(skeletonRow?.className).toContain("grid-cols-[2.75rem_2.75rem_1.25rem_1fr]");
    expect(realRow?.className).toContain("grid-cols-[2.75rem_2.75rem_1.25rem_1fr]");

    expect(screen.getByText("Loading diff…")).toBeInTheDocument();
  });

  it("isStreaming with a truncated final line renders no error surface", () => {
    const truncated: DiffLine[] = [
      { type: "context", oldNumber: 1, newNumber: 1, text: "const partial = {" },
      { type: "add", newNumber: 2, text: '  key: "unterminated' },
    ];
    renderDiffView(<DiffView lines={truncated} isStreaming />);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText("Generating…")).toBeInTheDocument();
  });
});

describe("DiffView — variants", () => {
  it('renders one row per line for variant="inline" (default)', () => {
    const { container } = renderDiffView(<DiffView lines={MIXED_LINES} />);
    expect(container.querySelectorAll('[data-slot="diff-view-row"]')).toHaveLength(
      MIXED_LINES.length,
    );
  });

  it('renders two aligned columns for variant="split"', () => {
    const { container } = renderDiffView(
      <DiffView
        lines={[
          { type: "del", oldNumber: 1, text: "old" },
          { type: "add", newNumber: 1, text: "new" },
        ]}
        variant="split"
      />,
    );
    const rows = container.querySelectorAll('[data-slot="diff-view-row"][data-diff-type]');
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      // Each row is split into exactly two side-by-side panes.
      expect(row.children).toHaveLength(2);
    }
  });
});

describe("DiffView — pager (absorbs CodexDiff)", () => {
  it("renders a scroll-position indicator, a key legend, and a named region", () => {
    renderDiffView(<DiffView lines={MIXED_LINES} pager file="src/add.ts" />);

    const region = screen.getByRole("region", { name: "Code diff: src/add.ts" });
    expect(region).toBeInTheDocument();
    expect(
      within(region).getByText("Arrow keys scroll, Page Up/Down page, Home/End jump"),
    ).toBeInTheDocument();
    expect(within(region).getByText("0%")).toBeInTheDocument();
  });
});

describe("DiffView — contextLines collapsing", () => {
  const longContext: DiffLine[] = Array.from({ length: 10 }, (_, i) => ({
    type: "context" as const,
    oldNumber: i + 1,
    newNumber: i + 1,
    text: `line ${i + 1}`,
  }));

  it("collapses a long context run behind a show-more control that restores it", async () => {
    const user = userEvent.setup();
    const { container } = renderDiffView(<DiffView lines={longContext} contextLines={4} />);

    expect(screen.queryByText("line 5")).not.toBeInTheDocument();
    const control = screen.getByRole("button", { name: /more line/ });
    expect(control).toBeInTheDocument();

    await user.click(control);

    expect(screen.getByText("line 5")).toBeInTheDocument();
    expect(container.querySelectorAll('[data-slot="diff-view-row"]')).toHaveLength(
      longContext.length,
    );
  });
});
