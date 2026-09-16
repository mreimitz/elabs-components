import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { liftHappyPath } from "../core/reference-model";
import { emptyDeviationCounts, tokenReplay } from "../core/token-replay";
import {
  CONFORMANCE_FIXTURE_LOG,
  CONFORMANCE_FIXTURE_PATH,
} from "../conformance-overlay/conformance-fixture";
import { ViolationList, violationRows } from "./violation-list";

afterEach(cleanup);

const conformance = tokenReplay(CONFORMANCE_FIXTURE_LOG, liftHappyPath(CONFORMANCE_FIXTURE_PATH));

describe("violationRows", () => {
  it("orders types by deviation count descending, then the conforming row", () => {
    expect(violationRows(conformance).map((row) => row.kind)).toEqual([
      "skipped",
      "undesired",
      "incomplete",
      "conforming",
    ]);
  });

  it("row case counts sum to the number of replayed cases (one type per case here)", () => {
    const sum = violationRows(conformance).reduce((total, row) => total + row.caseIds.length, 0);
    expect(sum).toBe(conformance.traces.length);
  });

  it("resolves exactly the case ids whose replay found that type", () => {
    const rows = violationRows(conformance);
    const expected = (type: string) =>
      conformance.traces
        .filter((trace) => trace.deviations.some((d) => d.type === type))
        .map((trace) => trace.caseId);
    for (const row of rows) {
      if (row.kind === "conforming") continue;
      expect(row.caseIds).toEqual(expected(row.kind));
    }
    expect(rows.find((row) => row.kind === "skipped")?.caseIds).toEqual(["c07", "c08"]);
    expect(rows.find((row) => row.kind === "skipped")?.share).toBeCloseTo(0.2);
  });
});

describe("ViolationList", () => {
  it("emits a cases filter intent with that row's ids, from pointer and keyboard", async () => {
    const onFilterIntent = vi.fn();
    const user = userEvent.setup();
    render(<ViolationList conformance={conformance} onFilterIntent={onFilterIntent} />);

    await user.click(screen.getByRole("button", { name: /Skipped step/ }));
    expect(onFilterIntent).toHaveBeenLastCalledWith({ kind: "cases", ids: ["c07", "c08"] });

    screen.getByRole("button", { name: /Undesired activity/ }).focus();
    await user.keyboard("{Enter}");
    expect(onFilterIntent).toHaveBeenLastCalledWith({ kind: "cases", ids: ["c09"] });
    expect(onFilterIntent).toHaveBeenCalledTimes(2);
  });

  it("prints share and case count per row, and the conforming total in the caption", () => {
    render(<ViolationList conformance={conformance} />);
    const row = screen.getByRole("row", { name: /Skipped step/ });
    expect(within(row).getByText("20%")).toBeInTheDocument();
    expect(within(row).getByText("2")).toBeInTheDocument();
    expect(screen.getByText(/6 of 10 cases conform/)).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("shows an empty panel for an empty replay and a loading panel while loading", () => {
    const empty = {
      overallFitness: 0,
      traces: [],
      deviationCounts: emptyDeviationCounts(),
      perActivity: {},
      perEdge: {},
    };
    const { unmount } = render(<ViolationList conformance={empty} />);
    expect(screen.getByText("No cases replayed")).toBeInTheDocument();
    unmount();
    render(<ViolationList conformance={conformance} loading />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});
