import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { MapPlanRegion } from "../lib/plan-regions";
import type { PlanStatus } from "../lib/plan-status";
import { MapPlanTable } from "./map-plan-table";

const REGIONS: MapPlanRegion[] = [
  { id: "a1", label: "Cell A1", bounds: { x: 0, y: 0, width: 10, height: 10 } },
  { id: "a2", label: "Cell A2", bounds: { x: 10, y: 0, width: 10, height: 10 } },
];

const STATUS: Record<string, PlanStatus> = { a1: "down", a2: "free" };

afterEach(cleanup);

describe("MapPlanTable", () => {
  it("repeats the plan as words, one row per region", () => {
    render(
      <MapPlanTable
        regions={REGIONS}
        caption="Every cell on the line, with its state"
        status={(region) => STATUS[region.id]}
        statusLabels={{ down: "stopped", free: "free" }}
        statusHeader="State"
        columns={[{ key: "throughput", header: "Units/h", numeric: true, cell: () => 120 }]}
      />,
    );

    const table = screen.getByRole("table", { name: "Every cell on the line, with its state" });
    expect(table).toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(REGIONS.length + 1);
    // The status word is the point: a status that exists only as a colour on the
    // canvas is invisible both to a screen reader and in greyscale.
    expect(screen.getByText("stopped")).toBeInTheDocument();
    expect(screen.getByText("free")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "State" })).toBeInTheDocument();
  });

  it("keeps a print-only table out of the screen layout but in the DOM", () => {
    render(<MapPlanTable regions={REGIONS} caption="Cells" printOnly />);

    const root = document.querySelector('[data-slot="map-plan-table"]')!;
    expect(root.className).toContain("hidden");
    expect(root.className).toContain("print:block");
    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  it("makes each row a second way to reach a region", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<MapPlanTable regions={REGIONS} caption="Cells" onSelect={onSelect} />);

    await user.click(screen.getByRole("button", { name: "Cell A2" }));

    expect(onSelect).toHaveBeenCalledWith("a2", REGIONS[1]);
  });

  it("mirrors the selection, single id or many", () => {
    const { rerender } = render(
      <MapPlanTable regions={REGIONS} caption="Cells" onSelect={() => {}} selectedId="a1" />,
    );
    const rows = () => screen.getAllByRole("row").slice(1);
    expect(rows().map((row) => row.getAttribute("aria-selected"))).toEqual(["true", "false"]);

    rerender(
      <MapPlanTable
        regions={REGIONS}
        caption="Cells"
        onSelect={() => {}}
        selectedId={["a1", "a2"]}
      />,
    );
    expect(rows().map((row) => row.getAttribute("aria-selected"))).toEqual(["true", "true"]);
  });

  it("does not claim selectability when there is nothing to select", () => {
    render(<MapPlanTable regions={REGIONS} caption="Cells" selectedId="a1" />);

    for (const row of screen.getAllByRole("row").slice(1)) {
      expect(row).not.toHaveAttribute("aria-selected");
    }
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
