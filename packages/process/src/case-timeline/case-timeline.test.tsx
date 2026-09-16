import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CaseTimeline } from "./case-timeline";
import type { EventRow } from "../core/types";

afterEach(cleanup);

const CASE_ID = "case-1";

const PARALLEL_EVENTS: EventRow[] = [
  { caseId: CASE_ID, activity: "Check Credit", startTimestamp: 0, timestamp: 3_600_000 },
  {
    caseId: CASE_ID,
    activity: "Check Inventory",
    startTimestamp: 1_800_000,
    timestamp: 5_400_000,
  },
  { caseId: CASE_ID, activity: "Approve Order", startTimestamp: 7_200_000, timestamp: 9_000_000 },
];

describe("CaseTimeline — rendering", () => {
  it("renders one row per activity instance", () => {
    render(<CaseTimeline caseId={CASE_ID} events={PARALLEL_EVENTS} />);
    const treeitems = screen.getAllByRole("treeitem");
    expect(treeitems).toHaveLength(3);
  });

  it("renders the empty state when the case has no events", () => {
    render(<CaseTimeline caseId={CASE_ID} events={[]} />);
    expect(screen.getByText(/no tasks to display/i)).toBeInTheDocument();
  });

  it("flags overlapping instances with a visible, non-colour 'Parallel' tag (WCAG 1.4.1)", () => {
    render(<CaseTimeline caseId={CASE_ID} events={PARALLEL_EVENTS} />);
    // Two overlapping instances ("Check Credit" and "Check Inventory") each carry the
    // text tag; "Approve Order" (no overlap) does not.
    const parallelTags = screen.getAllByText("Parallel");
    expect(parallelTags.length).toBeGreaterThanOrEqual(2);

    const treeitems = screen.getAllByRole("treeitem");
    const approveOrderRow = treeitems.find((el) => el.textContent?.includes("Approve Order"));
    expect(approveOrderRow?.textContent).not.toContain("Parallel");
  });

  it("respects a custom parallelismThreshold", () => {
    render(
      <CaseTimeline caseId={CASE_ID} events={PARALLEL_EVENTS} parallelismThreshold={10_000_000} />,
    );
    expect(screen.queryByText("Parallel")).not.toBeInTheDocument();
  });
});
