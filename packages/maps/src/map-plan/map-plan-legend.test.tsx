import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { PLAN_STATUSES } from "../lib/plan-status";
import { MapPlanLegend } from "./map-plan-legend";

const LABELS = {
  free: "free",
  occupied: "in use",
  warning: "attention",
  down: "stopped",
};

afterEach(cleanup);

describe("MapPlanLegend", () => {
  it("names every status in words, which is the channel greyscale keeps", () => {
    render(<MapPlanLegend labels={LABELS} label="Status key" />);

    const list = screen.getByRole("list", { name: "Status key" });
    expect(screen.getAllByRole("listitem")).toHaveLength(PLAN_STATUSES.length);
    for (const word of Object.values(LABELS)) {
      expect(list).toHaveTextContent(word);
    }
  });

  it("gives each swatch its own border style, so the key matches the outlines on the map", () => {
    render(<MapPlanLegend labels={LABELS} />);

    const swatches = document.querySelectorAll('[data-slot="map-plan-legend-swatch"]');
    expect(swatches).toHaveLength(PLAN_STATUSES.length);
    const styles = new Set(
      [...swatches].map((swatch) =>
        [...swatch.classList].filter((name) => name.startsWith("border")).join(" "),
      ),
    );
    expect(styles.size).toBe(PLAN_STATUSES.length);
  });

  it("leaves out a status with no word, and renders nothing when none has one", () => {
    const { rerender } = render(<MapPlanLegend labels={{ free: "free", down: "stopped" }} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);

    rerender(<MapPlanLegend labels={{}} />);
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("shows a count beside the word when one is given", () => {
    render(<MapPlanLegend labels={LABELS} counts={{ free: 4, down: 0 }} />);

    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("orders the statuses as asked", () => {
    render(<MapPlanLegend labels={LABELS} statuses={["down", "free"]} />);

    const items = screen.getAllByRole("listitem").map((item) => item.getAttribute("data-status"));
    expect(items).toEqual(["down", "free"]);
  });
});
