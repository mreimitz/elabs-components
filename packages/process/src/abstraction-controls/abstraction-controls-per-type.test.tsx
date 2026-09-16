/** Per-object-type sliders — RM-066. */
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AbstractionOptions } from "../core/abstract-graph";
import { AbstractionControls, type ObjectTypeAbstraction } from "./abstraction-controls";

afterEach(cleanup);

const half: AbstractionOptions = { activities: 0.5, paths: 0.5 };

function renderPerType(perType: Record<string, ObjectTypeAbstraction>) {
  const onPerTypeChange = vi.fn();
  const onAbstractionChange = vi.fn();
  render(
    <AbstractionControls
      abstraction={half}
      onAbstractionChange={onAbstractionChange}
      graph={{ activities: [] }}
      hiddenCounts={{ activities: 0, paths: 0 }}
      perType={perType}
      onPerTypeChange={onPerTypeChange}
    />,
  );
  return { onPerTypeChange, onAbstractionChange };
}

describe("AbstractionControls — per object type", () => {
  it("renders nothing extra without perType", () => {
    render(
      <AbstractionControls
        abstraction={half}
        onAbstractionChange={vi.fn()}
        graph={{ activities: [] }}
        hiddenCounts={{ activities: 0, paths: 0 }}
      />,
    );
    expect(document.querySelector('[data-slot="abstraction-controls-per-type"]')).toBeNull();
  });

  it("scales linked types with the global slider and leaves unlinked ones alone", async () => {
    const { onPerTypeChange } = renderPerType({
      order: { activities: 0.4, paths: 0.5 },
      item: { activities: 0.8, paths: 0.5, linked: false },
    });
    // The global activities slider's 25% tick: 50% → 25% halves every linked type.
    const activities = document.querySelector('[data-slot="abstraction-controls-activities"]')!;
    await userEvent.click(
      [...activities.querySelectorAll("button")].find((b) => b.textContent === "25%")!,
    );
    expect(onPerTypeChange).toHaveBeenCalledWith({
      order: { activities: 0.2, paths: 0.5 },
      item: { activities: 0.8, paths: 0.5, linked: false },
    });
  });

  it("toggles a type's link with a named, pressed-state button", async () => {
    const { onPerTypeChange } = renderPerType({ item: { activities: 1, paths: 1 } });
    const link = screen.getByRole("button", { name: "Link item to the global sliders" });
    expect(link).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(link);
    expect(onPerTypeChange).toHaveBeenCalledWith({
      item: { activities: 1, paths: 1, linked: false },
    });
  });

  it("reveals the type's own named sliders when expanded", async () => {
    renderPerType({ item: { activities: 0.6, paths: 0.9 } });
    expect(screen.queryByRole("slider", { name: "item activities" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /item/, expanded: false }));
    expect(screen.getByRole("slider", { name: "item activities" })).toHaveAttribute(
      "aria-valuenow",
      "60",
    );
    expect(screen.getByRole("slider", { name: "item paths" })).toHaveAttribute(
      "aria-valuenow",
      "90",
    );
  });
});
