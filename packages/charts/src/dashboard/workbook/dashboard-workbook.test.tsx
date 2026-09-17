import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { DashboardSpec, WorkbookSpec } from "../core/spec";
import { useDashboard, useDashboardActions } from "../dashboard-sheet";
import type { DashboardTileKind, DashboardTileProps } from "../dashboard-sheet/tile-registry";
import { DashboardWorkbook } from "./dashboard-workbook";

// `DashboardSheet` only mounts tile bodies once `react-use-measure` reports a non-zero
// size (`measured`, dashboard-sheet.tsx) — jsdom's `ResizeObserver` stub never fires, so
// every dashboard test that needs real tile content mocks this, same as dashboard-sheet.test.tsx.
vi.mock("react-use-measure", () => ({
  default: () => [
    () => {},
    { width: 800, height: 400, top: 0, left: 0, right: 800, bottom: 400, x: 0, y: 0 },
  ],
}));

function ProbeTile({ tile }: DashboardTileProps) {
  const dirty = useDashboard((s) => s.dirty);
  const actions = useDashboardActions();
  return (
    <div>
      <span data-testid={`probe-x-${tile.id}`}>{tile.layout.x}</span>
      <span data-testid={`probe-dirty-${tile.id}`}>{String(dirty)}</span>
      <button onClick={() => actions.moveTile(tile.id, { x: tile.layout.x + 1, y: tile.layout.y })}>
        Move {tile.id}
      </button>
    </div>
  );
}

const probeTileKind: DashboardTileKind = {
  kind: "probe",
  label: "Probe",
  component: ProbeTile,
  defaultSize: { w: 2, h: 2 },
  minSize: { w: 1, h: 1 },
  capabilities: {},
  configForm: { formName: "probe", fields: [] },
  defaultContent: {},
};

function sheet(id: string, extra: Partial<DashboardSpec> = {}): DashboardSpec {
  return {
    version: 1,
    id,
    title: extra.title,
    grid: { mode: "fit", columns: 12, rows: 6 },
    tiles: [
      {
        id: `probe-${id}`,
        kind: "probe",
        layout: { x: 0, y: 0, w: 2, h: 2 },
        content: {},
      },
    ],
    ...extra,
  };
}

const WORKBOOK: WorkbookSpec = {
  version: 1,
  id: "wb",
  sheets: [
    sheet("sheet-1", { title: "Overview" }),
    sheet("sheet-2", { title: "Detail" }),
    sheet("sheet-3", { title: "Hidden", showCondition: "false" }),
  ],
};

describe("DashboardWorkbook — RM-087", () => {
  it("the nav lists only visible sheets, by title", () => {
    render(<DashboardWorkbook workbook={WORKBOOK} tiles={[probeTileKind]} />);
    expect(screen.getByRole("tab", { name: "Overview" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Detail" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Hidden" })).toBeNull();
  });

  it("an edit on sheet 1 survives switching to sheet 2 and back, dirty included", async () => {
    const user = userEvent.setup();
    render(<DashboardWorkbook workbook={WORKBOOK} tiles={[probeTileKind]} />);

    expect(screen.getByTestId("probe-x-probe-sheet-1")).toHaveTextContent("0");
    await user.click(screen.getByRole("button", { name: "Move probe-sheet-1" }));
    expect(screen.getByTestId("probe-x-probe-sheet-1")).toHaveTextContent("1");
    expect(screen.getByTestId("probe-dirty-probe-sheet-1")).toHaveTextContent("true");

    await user.click(screen.getByRole("tab", { name: "Detail" }));
    expect(screen.getByTestId("probe-x-probe-sheet-2")).toHaveTextContent("0");

    await user.click(screen.getByRole("tab", { name: "Overview" }));
    expect(screen.getByTestId("probe-x-probe-sheet-1")).toHaveTextContent("1");
    expect(screen.getByTestId("probe-dirty-probe-sheet-1")).toHaveTextContent("true");
  });
});
