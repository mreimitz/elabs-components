/**
 * process-filter-bar.test.tsx — RM-056, #205.
 *
 * `intents` carries no ids (`useProcessExplorer`'s real contract) — every assertion below
 * keys by ARRAY INDEX, matching `onRemove(index)`/`clearIntent(index)`.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { FilterIntent } from "../use-process-explorer";
import { ProcessFilterBar } from "./process-filter-bar";

const chainIntents: FilterIntent[] = [
  { kind: "with", activity: "Reject Order" },
  { kind: "without", activity: "Amend Order" },
  { kind: "variant", ids: ["v-1", "v-2"] },
  { kind: "cases", ids: ["c-1", "c-2", "c-3"] },
];

describe("ProcessFilterBar", () => {
  it("renders one chip per intent, worded as a sentence fragment, with its own excluded count", () => {
    render(
      <ProcessFilterBar
        intents={chainIntents}
        excludedByIntent={[12, 4, 30, 7]}
        totalCases={100}
        filteredCases={60}
        onRemove={vi.fn()}
        onClearAll={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Remove filter: Contains Reject Order · excluded 12" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Remove filter: Excludes Amend Order · excluded 4" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Remove filter: 2 variants selected · excluded 30" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Remove filter: 3 cases selected · excluded 7" }),
    ).toBeInTheDocument();
  });

  it("removing a chip calls onRemove with that intent's index and nothing else", async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    render(
      <ProcessFilterBar
        intents={chainIntents}
        excludedByIntent={[12, 4, 30, 7]}
        totalCases={100}
        filteredCases={60}
        onRemove={onRemove}
        onClearAll={vi.fn()}
      />,
    );
    await user.click(
      screen.getByRole("button", { name: "Remove filter: Excludes Amend Order · excluded 4" }),
    );
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onRemove).toHaveBeenCalledWith(1);
  });

  it("Enter on a focused chip removes it, matching FilterChip's own keyboard contract", async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    render(
      <ProcessFilterBar
        intents={chainIntents}
        excludedByIntent={[12, 4, 30, 7]}
        totalCases={100}
        filteredCases={60}
        onRemove={onRemove}
        onClearAll={vi.fn()}
      />,
    );
    screen
      .getByRole("button", { name: "Remove filter: Contains Reject Order · excluded 12" })
      .focus();
    await user.keyboard("{Enter}");
    expect(onRemove).toHaveBeenCalledWith(0);
  });

  it("Clear all calls onClearAll exactly once regardless of intent count", async () => {
    const user = userEvent.setup();
    const onClearAll = vi.fn();
    render(
      <ProcessFilterBar
        intents={chainIntents}
        excludedByIntent={[12, 4, 30, 7]}
        totalCases={100}
        filteredCases={60}
        onRemove={vi.fn()}
        onClearAll={onClearAll}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Clear all" }));
    expect(onClearAll).toHaveBeenCalledTimes(1);
  });

  it("renders no chips and no group when there are no active intents", () => {
    render(
      <ProcessFilterBar
        intents={[]}
        excludedByIntent={[]}
        totalCases={100}
        filteredCases={100}
        onRemove={vi.fn()}
        onClearAll={vi.fn()}
      />,
    );
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText("Showing all 100 cases")).toBeInTheDocument();
  });

  it("states the filtered/total split exactly, with no abstraction clause when nothing is hidden", () => {
    render(
      <ProcessFilterBar
        intents={chainIntents}
        excludedByIntent={[12, 4, 30, 7]}
        totalCases={13087}
        filteredCases={3210}
        onRemove={vi.fn()}
        onClearAll={vi.fn()}
      />,
    );
    expect(screen.getByText("Showing 3,210 of 13,087 cases")).toBeInTheDocument();
  });

  it("appends the abstraction clause, matching hiddenCounts.activities exactly (no double counting)", () => {
    render(
      <ProcessFilterBar
        intents={chainIntents}
        excludedByIntent={[12, 4, 30, 7]}
        totalCases={13087}
        filteredCases={3210}
        hiddenCounts={{ activities: 12, paths: 40 }}
        onRemove={vi.fn()}
        onClearAll={vi.fn()}
      />,
    );
    expect(
      screen.getByText("Showing 3,210 of 13,087 cases · 12 activities hidden by abstraction"),
    ).toBeInTheDocument();
  });

  it("omits the abstraction clause when hiddenCounts.activities is zero", () => {
    render(
      <ProcessFilterBar
        intents={[]}
        excludedByIntent={[]}
        totalCases={100}
        filteredCases={100}
        hiddenCounts={{ activities: 0, paths: 0 }}
        onRemove={vi.fn()}
        onClearAll={vi.fn()}
      />,
    );
    expect(screen.getByText("Showing all 100 cases")).toBeInTheDocument();
  });

  it("labels startsWith/endsWith intents as sentence fragments", () => {
    render(
      <ProcessFilterBar
        intents={[
          { kind: "startsWith", activity: "Create Order" },
          { kind: "endsWith", activity: "Ship Order" },
        ]}
        excludedByIntent={[1, 2]}
        totalCases={10}
        filteredCases={5}
        onRemove={vi.fn()}
        onClearAll={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Remove filter: Starts with Create Order · excluded 1" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Remove filter: Ends with Ship Order · excluded 2" }),
    ).toBeInTheDocument();
  });

  it("merges a caller className onto the root", () => {
    const { container } = render(
      <ProcessFilterBar
        intents={[]}
        excludedByIntent={[]}
        totalCases={0}
        filteredCases={0}
        onRemove={vi.fn()}
        onClearAll={vi.fn()}
        className="extra"
      />,
    );
    expect(container.querySelector('[data-slot="process-filter-bar"]')).toHaveClass("extra");
  });
});
