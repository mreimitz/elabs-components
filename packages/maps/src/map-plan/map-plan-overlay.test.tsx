import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("maplibre-gl", async () => {
  const { createMaplibreMock } = await import("../test-utils/maplibre-mock");
  return createMaplibreMock();
});

import { resetMaplibreMock } from "../test-utils/maplibre-mock";
import { MapCanvas } from "../map-canvas";
import type { MapPlanRegion } from "../lib/plan-regions";
import { resetMapWarnings } from "../lib/warn-once";
import { MapPlanOverlay } from "./map-plan-overlay";

afterEach(() => {
  cleanup();
  resetMaplibreMock();
  resetMapWarnings();
});

const PLAN = { width: 1000, height: 500 };

/**
 *  studio ── lab
 *    │
 *  store
 */
const REGIONS: MapPlanRegion[] = [
  {
    id: "studio",
    label: "Studio",
    description: "8 seats",
    bounds: { x: 0, y: 0, width: 200, height: 100 },
  },
  { id: "lab", label: "Lab", bounds: { x: 400, y: 0, width: 200, height: 100 } },
  { id: "store", label: "Store", bounds: { x: 0, y: 300, width: 200, height: 100 } },
];

function renderOverlay(props: Partial<React.ComponentProps<typeof MapPlanOverlay>> = {}) {
  return render(
    <MapCanvas plan={PLAN}>
      <MapPlanOverlay regions={REGIONS} label="Rooms on level 3" {...props} />
    </MapCanvas>,
  );
}

describe("MapPlanOverlay", () => {
  it("gives every region a real button whose name starts with its visible label", async () => {
    renderOverlay();

    const studio = await screen.findByRole("button", { name: "Studio, 8 seats" });
    expect(studio).toHaveAccessibleName("Studio, 8 seats");
    expect(screen.getByRole("button", { name: "Lab" })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Rooms on level 3" })).toBeInTheDocument();
  });

  it("offers exactly one tab stop into the set", async () => {
    renderOverlay();

    const buttons = await screen.findAllByRole("button");
    expect(buttons.filter((button) => button.tabIndex === 0)).toHaveLength(1);
    expect(buttons[0]!.tabIndex).toBe(0);
  });

  it("places each region where the plan puts it", async () => {
    renderOverlay();

    const studio = await screen.findByRole("button", { name: "Studio, 8 seats" });
    const box = studio.parentElement as HTMLElement;
    // The mock projects lng/lat linearly, so a region 200 plan units wide is
    // half the width of one 400 units wide — the assertion that matters is that
    // the box has real geometry, written by the projection pass.
    expect(box.style.transform).toMatch(/^translate\(-?\d+px, -?\d+px\)$/);
    expect(Number.parseFloat(box.style.width)).toBeGreaterThan(0);
    expect(Number.parseFloat(box.style.height)).toBeGreaterThan(0);
  });

  it("walks the plan with the arrow keys, spatially", async () => {
    const user = userEvent.setup();
    renderOverlay();

    const studio = await screen.findByRole("button", { name: "Studio, 8 seats" });
    await act(async () => studio.focus());

    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("button", { name: "Lab" })).toHaveFocus();

    await user.keyboard("{ArrowLeft}");
    expect(studio).toHaveFocus();

    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("button", { name: "Store" })).toHaveFocus();

    await user.keyboard("{Home}");
    expect(studio).toHaveFocus();

    await user.keyboard("{End}");
    expect(screen.getByRole("button", { name: "Store" })).toHaveFocus();
  });

  it("selects with Enter and clears with Escape", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderOverlay({ onSelect });

    const studio = await screen.findByRole("button", { name: "Studio, 8 seats" });
    await act(async () => studio.focus());

    await user.keyboard("{Enter}");
    expect(onSelect).toHaveBeenLastCalledWith("studio", expect.objectContaining({ id: "studio" }));

    await user.keyboard("{Escape}");
    expect(onSelect).toHaveBeenLastCalledWith(null, null);
  });

  it("shows the selection as a pressed state", async () => {
    renderOverlay({ selectedId: ["lab"] });

    const lab = await screen.findByRole("button", { name: "Lab" });
    expect(lab).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Studio, 8 seats" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("reports the active region so the shape and the proxy light up together", async () => {
    const user = userEvent.setup();
    const onActiveChange = vi.fn();
    renderOverlay({ onActiveChange });

    const lab = await screen.findByRole("button", { name: "Lab" });
    await user.click(lab);

    expect(onActiveChange).toHaveBeenCalledWith("lab", expect.objectContaining({ id: "lab" }));
  });

  it("keeps the label out of the accessible name", async () => {
    renderOverlay();

    await screen.findByRole("button", { name: "Studio, 8 seats" });
    const labels = document.querySelectorAll("[data-slot='map-plan-overlay-label']");
    expect(labels).toHaveLength(3);
    for (const label of labels) {
      expect(label).toHaveAttribute("aria-hidden", "true");
    }
  });

  it("can hand the pointer back to the canvas and stay keyboard-only", async () => {
    renderOverlay({ capturePointer: false });

    const studio = await screen.findByRole("button", { name: "Studio, 8 seats" });
    expect(studio.className).toContain("pointer-events-none");
  });
});

/**
 * Two coaches of two seats — small enough to assert on, shaped like the train
 * fixture group mode exists for.
 */
const GROUPED: MapPlanRegion[] = [
  {
    id: "a-1",
    label: "1",
    description: "window",
    group: "coach-a",
    groupLabel: "Coach A",
    bounds: { x: 0, y: 0, width: 50, height: 50 },
  },
  {
    id: "a-2",
    label: "2",
    group: "coach-a",
    groupLabel: "Coach A",
    bounds: { x: 60, y: 0, width: 50, height: 50 },
  },
  {
    id: "b-1",
    label: "1",
    group: "coach-b",
    groupLabel: "Coach B",
    bounds: { x: 500, y: 0, width: 50, height: 50 },
  },
  {
    id: "b-2",
    label: "2",
    group: "coach-b",
    groupLabel: "Coach B",
    bounds: { x: 560, y: 0, width: 50, height: 50 },
  },
];

function renderGrouped(props: Partial<React.ComponentProps<typeof MapPlanOverlay>> = {}) {
  return render(
    <MapCanvas plan={PLAN}>
      <MapPlanOverlay
        regions={GROUPED}
        label="Seats"
        mode="groups"
        describeGroup={(group) => `${group.members.length} seats`}
        {...props}
      />
    </MapCanvas>,
  );
}

describe("MapPlanOverlay in group mode", () => {
  it("starts with one button per group, not one per seat", async () => {
    renderGrouped();

    expect(await screen.findByRole("button", { name: "Coach A, 2 seats" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Coach B, 2 seats" })).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(2);
  });

  it("covers the whole group with the group's box", async () => {
    const width = async (name: string) => {
      const button = await screen.findByRole("button", { name });
      return Number.parseInt((button.parentElement as HTMLElement).style.width, 10);
    };

    renderGrouped();
    const groupWidth = await width("Coach A, 2 seats");
    cleanup();

    // The same two seats, each on its own: the group's box spans both of them.
    render(
      <MapCanvas plan={PLAN}>
        <MapPlanOverlay regions={GROUPED} label="Seats" />
      </MapCanvas>,
    );
    const seatWidth = await width("1, window");

    expect(groupWidth).toBeGreaterThan(seatWidth);
  });

  it("descends into a group on Enter and comes back out on Escape", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderGrouped({ onSelect });

    const coach = await screen.findByRole("button", { name: "Coach A, 2 seats" });
    await act(async () => coach.focus());
    await user.keyboard("{Enter}");

    // Inside: the two seats, and going in selected nothing.
    expect(await screen.findByRole("button", { name: "1, window" })).toBeInTheDocument();
    expect(screen.getAllByRole("button")).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Coach B, 2 seats" })).not.toBeInTheDocument();
    expect(onSelect).not.toHaveBeenCalled();

    // Focus lands on the group's first seat in the same commit, so the next key
    // press has somewhere to go.
    expect(document.activeElement).toHaveAccessibleName("1, window");

    await user.keyboard("{Escape}");
    expect(document.activeElement).toHaveAccessibleName("Coach A, 2 seats");

    expect(await screen.findByRole("button", { name: "Coach A, 2 seats" })).toBeInTheDocument();
    // Escape left the group instead of clearing the selection.
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("selects a member once inside", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderGrouped({ onSelect });

    const coach = await screen.findByRole("button", { name: "Coach A, 2 seats" });
    await act(async () => coach.focus());
    await user.keyboard("{Enter}");
    await user.click(await screen.findByRole("button", { name: "1, window" }));

    expect(onSelect).toHaveBeenCalledWith("a-1", expect.objectContaining({ id: "a-1" }));
  });

  it("changes group with PageDown, at either level", async () => {
    const user = userEvent.setup();
    renderGrouped();

    const coachA = await screen.findByRole("button", { name: "Coach A, 2 seats" });
    await act(async () => coachA.focus());
    await user.keyboard("{PageDown}");
    expect(document.activeElement).toHaveAccessibleName("Coach B, 2 seats");

    await user.keyboard("{Enter}");
    expect(await screen.findByRole("button", { name: "1" })).toBeInTheDocument();
    await user.keyboard("{PageUp}");

    // Inside coach A now, on its first seat.
    expect(await screen.findByRole("button", { name: "1, window" })).toBeInTheDocument();
  });

  it("gives a group's button no pressed state, since it is not a toggle", async () => {
    renderGrouped({ selectedId: "a-1" });

    const coach = await screen.findByRole("button", { name: "Coach A, 2 seats" });
    expect(coach).not.toHaveAttribute("aria-pressed");
    expect(coach).toHaveAttribute("data-group", "true");
  });
});
