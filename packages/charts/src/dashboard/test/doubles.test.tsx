import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DashboardSpecError } from "./contract";
import { DashboardSheet } from "./doubles";
import { salesOverviewSpec } from "../fixtures/sales-overview";
import type { DashboardSpec } from "../core/spec";

describe("DashboardSheet (test double)", () => {
  it("renders one [data-tile-id][data-tile-kind] per tile, 9 for sales-overview", () => {
    render(<DashboardSheet spec={salesOverviewSpec} />);
    const root = document.querySelector('[data-slot="dashboard-sheet"]')!;
    const rendered = root.querySelectorAll("[data-tile-id][data-tile-kind]");
    expect(rendered).toHaveLength(9);
    expect(root).toHaveAttribute("data-mode", "view");
  });

  it("renders tiles in reading order (top-to-bottom, then left-to-right)", () => {
    render(<DashboardSheet spec={salesOverviewSpec} />);
    const ids = Array.from(document.querySelectorAll("[data-tile-id]")).map((el) =>
      el.getAttribute("data-tile-id"),
    );
    expect(ids[0]).toBe("kpi-revenue");
  });

  it("throws before rendering when the spec is invalid", () => {
    const broken = { ...salesOverviewSpec, version: 2 } as unknown as DashboardSpec;
    expect(() => render(<DashboardSheet spec={broken} />)).toThrow(DashboardSpecError);
  });

  it("writes the mode prop to data-mode", () => {
    render(<DashboardSheet spec={salesOverviewSpec} mode="edit" />);
    expect(document.querySelector('[data-slot="dashboard-sheet"]')).toHaveAttribute(
      "data-mode",
      "edit",
    );
  });
});
