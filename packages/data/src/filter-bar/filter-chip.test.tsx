/**
 * filter-chip.test.tsx — smoke + count-in-accessible-name lock (#221).
 *
 * `FilterChip` composes `@elabs-ai/components-ui`'s FilterChip; the contract worth
 * locking here is specific to the count feature this wrapper adds: the
 * formatted count reaches the VISIBLE text and the chip's ACCESSIBLE NAME
 * (WCAG 2.5.3), and removing one chip never touches its siblings.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FilterChip } from "./filter-chip";

describe("FilterChip", () => {
  it("renders the bare label with no count", () => {
    render(<FilterChip label="Status: Failed" onRemove={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: "Remove filter: Status: Failed" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Status: Failed")).toBeInTheDocument();
  });

  it("renders 'excluded 1,204' (locale-formatted) alongside the label", () => {
    render(
      <FilterChip label="Status: Failed" count={1204} countLabel="excluded" onRemove={vi.fn()} />,
    );
    expect(screen.getByText("Status: Failed · excluded 1,204")).toBeInTheDocument();
  });

  it("folds the count into the chip's ACCESSIBLE NAME, not only its visible text", () => {
    render(
      <FilterChip label="Status: Failed" count={1204} countLabel="excluded" onRemove={vi.fn()} />,
    );
    expect(
      screen.getByRole("button", { name: "Remove filter: Status: Failed · excluded 1,204" }),
    ).toBeInTheDocument();
  });

  it("renders a bare formatted count with no countLabel", () => {
    render(<FilterChip label="Status: Failed" count={1204} onRemove={vi.fn()} />);
    expect(screen.getByText("Status: Failed · 1,204")).toBeInTheDocument();
  });

  it("fires onRemove for the clicked chip only, leaving sibling chips untouched", async () => {
    const user = userEvent.setup();
    const removeFirst = vi.fn();
    const removeSecond = vi.fn();
    render(
      <>
        <FilterChip label="Status: Failed" onRemove={removeFirst} />
        <FilterChip label="Region: EU" onRemove={removeSecond} />
      </>,
    );
    await user.click(screen.getByRole("button", { name: "Remove filter: Status: Failed" }));
    expect(removeFirst).toHaveBeenCalledTimes(1);
    expect(removeSecond).not.toHaveBeenCalled();
  });

  it("merges a caller className onto the root", () => {
    render(<FilterChip label="Status: Failed" onRemove={vi.fn()} className="extra" />);
    expect(screen.getByRole("button")).toHaveClass("extra");
  });
});
