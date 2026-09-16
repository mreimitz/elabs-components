import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { DashboardSpec } from "../core/spec";
import { DashboardProvider } from "../dashboard-sheet";
import { salesOverviewSpec } from "../fixtures/sales-overview";
import { builtInTiles } from "../tiles";
import { DashboardInteractionsEditor, setInteractionPair } from "./dashboard-interactions-editor";

describe("DashboardInteractionsEditor", () => {
  it("renders a matrix with named selects for a small sheet", () => {
    render(
      <DashboardProvider spec={salesOverviewSpec} tiles={builtInTiles}>
        <DashboardInteractionsEditor />
      </DashboardProvider>,
    );
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", {
        name: "EMEA is 41 % of revenue → Three products carry half the revenue: Filter",
      }),
    ).toBeInTheDocument();
  });

  it("setInteractionPair replaces the explicit pair and keeps wildcards", () => {
    const spec = salesOverviewSpec as DashboardSpec;
    const next = setInteractionPair(spec, "region-share", "top-products", "none");
    expect(next.filter((i) => i.to === "top-products")).toEqual([
      { from: "region-share", to: "top-products", effect: "none" },
    ]);
    expect(next.filter((i) => i.to === "*")).toHaveLength(2);
  });
});
