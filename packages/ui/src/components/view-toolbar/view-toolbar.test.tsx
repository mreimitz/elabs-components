import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FilterChip, ResultCount, ViewToolbar, ViewToolbarFilters } from "./view-toolbar";

describe("ViewToolbar", () => {
  it("renders the row shell with stable data-slot seams", () => {
    const { container } = render(
      <ViewToolbar actions={<button type="button">New run</button>}>
        <span>Left</span>
      </ViewToolbar>,
    );

    expect(container.querySelector("[data-slot='view-toolbar']")).not.toBeNull();
    expect(container.querySelector("[data-slot='view-toolbar-content']")).not.toBeNull();
    expect(container.querySelector("[data-slot='view-toolbar-actions']")).not.toBeNull();
  });

  it("forwards its ref, merges className and spreads props onto the root", () => {
    const ref = createRef<HTMLDivElement>();
    render(<ViewToolbar ref={ref} className="custom-row" id="runs-toolbar" data-testid="row" />);

    const root = screen.getByTestId("row");
    expect(ref.current).toBe(root);
    expect(root).toHaveAttribute("id", "runs-toolbar");
    expect(root.className).toContain("custom-row");
    // The row wraps rather than clipping — the narrow-width contract.
    expect(root.className).toContain("flex-wrap");
  });

  it("omits the actions cluster when no actions are supplied", () => {
    const { container } = render(<ViewToolbar>Left</ViewToolbar>);
    expect(container.querySelector("[data-slot='view-toolbar-actions']")).toBeNull();
  });

  it("renders the info affordance only when `info` is supplied", async () => {
    const { rerender } = render(<ViewToolbar>Left</ViewToolbar>);
    expect(screen.queryByRole("button", { name: "About this view" })).toBeNull();

    rerender(<ViewToolbar info="Everything that ran in the last 30 days.">Left</ViewToolbar>);
    expect(screen.getByRole("button", { name: "About this view" })).toBeInTheDocument();
  });

  /**
   * The narrow-width AC in DOM terms: nothing between the action and the row may
   * carry `overflow: hidden`, which is what would put the action cluster out of
   * reach once the row wraps. (jsdom has no layout, so the geometric half of the
   * assertion lives in the `Overflowing` story's play function, which runs in a
   * real browser.)
   */
  it("never clips the action cluster out of the row", () => {
    const { container } = render(
      <ViewToolbar
        info="Runs"
        actions={
          <button type="button" data-testid="primary-action">
            New run
          </button>
        }
      >
        <ViewToolbarFilters>
          <FilterChip label="Status: Failed" onRemove={() => undefined} />
        </ViewToolbarFilters>
        <ResultCount count={3} total={128} />
      </ViewToolbar>,
    );

    const root = container.querySelector("[data-slot='view-toolbar']") as HTMLElement;
    const action = screen.getByTestId("primary-action");

    for (let node: HTMLElement | null = action; node && node !== root; node = node.parentElement) {
      expect(node.className).not.toMatch(/\boverflow-hidden\b/);
    }
    expect(root.className).not.toMatch(/\boverflow-hidden\b/);
  });

  /**
   * The other half of the narrow-width AC, and the reason the DOM assertion
   * above is not enough: a `shrink-0` action cluster whose buttons cannot wrap
   * does not get clipped — it OVERFLOWS the row, escaping the row's box by
   * ~8px at a 320px viewport. The cluster must be able to shrink AND wrap.
   * (The geometric proof runs in a real browser — see the `Overflowing`
   * story's play function; jsdom has no layout.)
   */
  it("lets the action cluster wrap instead of overflowing the row", () => {
    const { container } = render(
      <ViewToolbar actions={<button type="button">New run</button>}>Left</ViewToolbar>,
    );

    const actions = container.querySelector("[data-slot='view-toolbar-actions']") as HTMLElement;
    expect(actions.className).toMatch(/\bflex-wrap\b/);
    expect(actions.className).not.toMatch(/\bshrink-0\b/);
  });
});

describe("ViewToolbarFilters", () => {
  it("names the chip run as a group so it is findable in assistive tech", () => {
    render(
      <ViewToolbarFilters>
        <FilterChip label="Status: Failed" onRemove={() => undefined} />
      </ViewToolbarFilters>,
    );

    expect(screen.getByRole("group", { name: "Active filters" })).toBeInTheDocument();
  });

  it("renders 'Clear all' only when onClearAll is supplied, and calls it", async () => {
    const onClearAll = vi.fn();
    const { rerender } = render(
      <ViewToolbarFilters>
        <FilterChip label="Status: Failed" onRemove={() => undefined} />
      </ViewToolbarFilters>,
    );
    expect(screen.queryByRole("button", { name: "Clear all" })).toBeNull();

    rerender(
      <ViewToolbarFilters onClearAll={onClearAll}>
        <FilterChip label="Status: Failed" onRemove={() => undefined} />
      </ViewToolbarFilters>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Clear all" }));
    expect(onClearAll).toHaveBeenCalledTimes(1);
  });

  it("lets a caller override the group's accessible name", () => {
    render(
      <ViewToolbarFilters aria-label="Active run filters">
        <FilterChip label="Status: Failed" onRemove={() => undefined} />
      </ViewToolbarFilters>,
    );
    expect(screen.getByRole("group", { name: "Active run filters" })).toBeInTheDocument();
  });
});

describe("FilterChip", () => {
  it("renders label-in-value text verbatim", () => {
    render(<FilterChip label="Status: Failed" onRemove={() => undefined} />);
    expect(screen.getByText("Status: Failed")).toBeInTheDocument();
  });

  it("is a real button whose accessible name contains the visible label", () => {
    render(<FilterChip label="Status: Failed" onRemove={() => undefined} />);
    const chip = screen.getByRole("button", { name: "Remove filter: Status: Failed" });
    expect(chip.tagName).toBe("BUTTON");
    // WCAG 2.5.3 Label in Name.
    expect(chip).toHaveAccessibleName(expect.stringContaining("Status: Failed"));
  });

  it("calls onRemove on click", async () => {
    const onRemove = vi.fn();
    render(<FilterChip label="Status: Failed" onRemove={onRemove} />);
    await userEvent.click(screen.getByRole("button", { name: "Remove filter: Status: Failed" }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("calls onRemove on Enter", async () => {
    const onRemove = vi.fn();
    render(<FilterChip label="Status: Failed" onRemove={onRemove} />);
    screen.getByRole("button", { name: "Remove filter: Status: Failed" }).focus();
    await userEvent.keyboard("{Enter}");
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("calls onRemove on Space", async () => {
    const onRemove = vi.fn();
    render(<FilterChip label="Status: Failed" onRemove={onRemove} />);
    screen.getByRole("button", { name: "Remove filter: Status: Failed" }).focus();
    await userEvent.keyboard(" ");
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("is reachable by keyboard", async () => {
    render(
      <ViewToolbarFilters>
        <FilterChip label="Status: Failed" onRemove={() => undefined} />
        <FilterChip label="Owner: Data platform" onRemove={() => undefined} />
      </ViewToolbarFilters>,
    );

    await userEvent.tab();
    expect(screen.getByRole("button", { name: "Remove filter: Status: Failed" })).toHaveFocus();
    await userEvent.tab();
    expect(
      screen.getByRole("button", { name: "Remove filter: Owner: Data platform" }),
    ).toHaveFocus();
  });

  it("lets a caller's onClick run first and cancel the removal", async () => {
    const onRemove = vi.fn();
    render(
      <FilterChip
        label="Status: Failed"
        onRemove={onRemove}
        onClick={(event) => event.preventDefault()}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Remove filter: Status: Failed" }));
    expect(onRemove).not.toHaveBeenCalled();
  });

  it("carries the view-toolbar-filter-chip slot and forwards its ref", () => {
    const ref = createRef<HTMLButtonElement>();
    const { container } = render(
      <FilterChip ref={ref} label="Status: Failed" onRemove={() => undefined} />,
    );
    const chip = container.querySelector("[data-slot='view-toolbar-filter-chip']");
    expect(chip).not.toBeNull();
    expect(ref.current).toBe(chip);
  });
});

describe("ResultCount", () => {
  it("renders 'N of M' when both counts are supplied", () => {
    const { container } = render(<ResultCount count={24} total={128} />);
    expect(container.textContent).toBe("24 of 128");
  });

  it("falls back to a bare count when no total is supplied", () => {
    const { container } = render(<ResultCount count={128} />);
    expect(container.textContent).toBe("128");
  });

  it("appends an optional trailing noun", () => {
    const { container } = render(
      <ResultCount count={24} total={128}>
        runs
      </ResultCount>,
    );
    // Joined with a NON-BREAKING space (U+00A0, written as an escape so the
    // assertion cannot be silently "fixed" into a plain space): the number must
    // never wrap off its noun. See the micro-typography rule.
    expect(container.textContent).toBe(`24 of 128\u00A0runs`);
  });

  it("renders 0 honestly rather than hiding an emptied view", () => {
    const { container } = render(<ResultCount count={0} total={128} />);
    expect(container.textContent).toBe("0 of 128");
  });

  it("uses tabular figures so counts do not jitter", () => {
    const { container } = render(<ResultCount count={24} total={128} />);
    const span = container.querySelector("[data-slot='view-toolbar-result-count']") as HTMLElement;
    expect(span.className).toContain("tabular-nums");
  });

  it("renders a placeholder — never a number — while loading", () => {
    const { container } = render(<ResultCount count={0} total={128} loading />);
    expect(container.textContent).not.toContain("0 of 128");
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("forwards its ref and keeps the slot in both states", () => {
    const ref = createRef<HTMLSpanElement>();
    const { container, rerender } = render(<ResultCount ref={ref} count={24} total={128} />);
    expect(ref.current).toBe(container.querySelector("[data-slot='view-toolbar-result-count']"));

    rerender(<ResultCount ref={ref} count={24} total={128} loading />);
    expect(ref.current).toBe(container.querySelector("[data-slot='view-toolbar-result-count']"));
  });
});
