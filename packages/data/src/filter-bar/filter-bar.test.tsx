/**
 * filter-bar.test.tsx — smoke + layout-contract lock for the table toolbar (#59).
 *
 * FilterBar is deliberately thin: it is the two-cluster toolbar grammar (filters
 * on the leading edge, actions on the trailing edge) that every data screen
 * repeats. The contract worth locking is that both clusters exist, that the
 * actions cluster is OMITTED (not rendered empty) when there are no actions —
 * an empty flex box would still eat the `gap` — and that it composes.
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { FilterBar } from "./filter-bar";

describe("FilterBar", () => {
  it("renders its filter children", () => {
    render(
      <FilterBar>
        <button type="button">Status</button>
      </FilterBar>,
    );
    expect(screen.getByRole("button", { name: "Status" })).toBeInTheDocument();
  });

  it("renders the actions cluster when actions are supplied", () => {
    render(
      <FilterBar actions={<button type="button">Export</button>}>
        <button type="button">Status</button>
      </FilterBar>,
    );
    expect(screen.getByRole("button", { name: "Export" })).toBeInTheDocument();
  });

  it("keeps filters and actions in SEPARATE clusters (leading vs trailing)", () => {
    const { container } = render(
      <FilterBar actions={<button type="button">Export</button>}>
        <button type="button">Status</button>
      </FilterBar>,
    );
    const clusters = container.firstElementChild?.children;
    expect(clusters).toHaveLength(2);
    expect(clusters?.[0]).toHaveTextContent("Status");
    expect(clusters?.[1]).toHaveTextContent("Export");
  });

  it("omits the actions cluster entirely when there are no actions", () => {
    const { container } = render(
      <FilterBar>
        <button type="button">Status</button>
      </FilterBar>,
    );
    // One child only — an empty second flex row would still consume the gap.
    expect(container.firstElementChild?.children).toHaveLength(1);
  });

  it("merges a caller className onto the root without dropping the layout classes", () => {
    const { container } = render(<FilterBar className="extra">x</FilterBar>);
    expect(container.firstChild).toHaveClass("extra");
    expect(container.firstChild).toHaveClass("flex");
  });
});
