import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import type { DashboardSpec } from "../core/spec";
import type { DashboardStore } from "../core/store";
import { DashboardProvider } from "../dashboard-sheet";
import { useDashboardContext } from "../dashboard-sheet/use-dashboard";
import { EDIT_FIT_SPEC } from "../edit/edit-specs";
import { chartTileKind, textTileKind } from "../tiles";
import {
  DEFAULT_DASHBOARD_PANEL_LABELS as L,
  commonTileForm,
  tileFormValues,
  tilePatchFromValues,
  withConfigForm,
} from "./common-tile-form";
import { DashboardPropertiesPanel } from "./dashboard-properties-panel";
import { sheetFormValues, sheetSpecFromValues } from "./sheet-form";

// jsdom has no matchMedia; SideDock asks it whether to render the overlay presentation.
window.matchMedia ??= ((query: string) => ({
  matches: false,
  media: query,
  addEventListener: () => {},
  removeEventListener: () => {},
})) as unknown as typeof window.matchMedia;

describe("panel forms", () => {
  it("round-trips a tile through the common form and the chart configForm", () => {
    const tile = EDIT_FIT_SPEC.tiles[0]!;
    const form = withConfigForm(commonTileForm(L, []), chartTileKind.configForm, "Chart");
    const values = tileFormValues(
      { ...tile, content: { x: "month", series: [{ key: "a" }] } },
      form,
      [],
    );
    expect(values["content.series"]).toEqual(["a"]);
    const patch = tilePatchFromValues(
      { ...values, title: "New", "content.fields.category": "region" },
      tile,
      true,
    );
    expect(patch.title).toBe("New");
    expect(patch.content).toMatchObject({ x: "month", fields: { category: "region" } });
  });

  it("maps the sheet form back onto the spec, dropping emptied fields", () => {
    const values = sheetFormValues(EDIT_FIT_SPEC, L);
    const next = sheetSpecFromValues(
      { ...values, title: "", showCondition: "true" },
      EDIT_FIT_SPEC,
    );
    expect(next.title).toBeUndefined();
    expect(next.showCondition).toBe("true");
    expect(next.grid).toEqual(EDIT_FIT_SPEC.grid);
  });
});

let store: DashboardStore;
function Probe() {
  store = useDashboardContext().store;
  return null;
}

describe("DashboardPropertiesPanel", () => {
  const spec: DashboardSpec = EDIT_FIT_SPEC;

  it("commits a sheet title on blur as one history step", async () => {
    render(
      <DashboardProvider spec={spec} tiles={[chartTileKind, textTileKind]} mode="edit">
        <DashboardPropertiesPanel defaultOpen />
        <Probe />
      </DashboardProvider>,
    );
    const title = screen.getByLabelText("Title");
    await userEvent.clear(title);
    await userEvent.type(title, "Q3 review");
    expect(store.getState().spec.title).toBe(spec.title);
    await userEvent.tab();
    expect(store.getState().spec.title).toBe("Q3 review");
    expect(store.getState().history.past).toBe(1);
  });

  it("does not commit a visibleWhen that fails to compile", async () => {
    render(
      <DashboardProvider spec={spec} tiles={[chartTileKind, textTileKind]} mode="edit">
        <DashboardPropertiesPanel defaultOpen />
        <Probe />
      </DashboardProvider>,
    );
    store.getState().actions.setFocus(["chart-1"]);
    const field = await screen.findByLabelText("Show when");
    await userEvent.type(field, "variables.x &&");
    await userEvent.tab();
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(store.getState().spec.tiles[0]!.visibleWhen).toBeUndefined();
    expect(store.getState().history.past).toBe(0);
  });
});
