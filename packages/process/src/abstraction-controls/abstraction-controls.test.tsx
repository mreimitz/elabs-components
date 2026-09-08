import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { abstractGraph, type AbstractionOptions } from "../core/abstract-graph";
import type { ActivityStats } from "../core/types";
import { AbstractionControls } from "./abstraction-controls";
import { backboneGraph } from "./abstraction-controls-fixtures";
import { computeAutoAbstraction } from "./auto-abstraction";

afterEach(cleanup);

const identity: AbstractionOptions = {
  activities: 1,
  paths: 1,
  invert: false,
  keepConnected: true,
};

/** Only `.length` matters to `AbstractionControls` — minimal-but-valid `ActivityStats` stubs. */
function fakeActivities(count: number): ActivityStats[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `A${i}`,
    label: `A${i}`,
    instances: 1,
    cases: 1,
    isStart: i === 0,
    isEnd: i === count - 1,
    duration: { min: 0, max: 0, mean: 0, median: 0, p90: 0, sum: 0, trimmedMean: 0 },
  }));
}

function renderControls(overrides: Partial<Parameters<typeof AbstractionControls>[0]> = {}) {
  const onAbstractionChange = vi.fn();
  const utils = render(
    <AbstractionControls
      abstraction={identity}
      onAbstractionChange={onAbstractionChange}
      graph={{ activities: fakeActivities(25) }}
      hiddenCounts={{ activities: 0, paths: 0 }}
      {...overrides}
    />,
  );
  return { onAbstractionChange, ...utils };
}

describe("AbstractionControls — rendering", () => {
  it("renders both sliders, the invert switch and the Auto button", () => {
    renderControls();
    expect(screen.getByRole("slider", { name: "Activities" })).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: "Paths" })).toBeInTheDocument();
    expect(screen.getByRole("switch")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Auto" })).toBeInTheDocument();
  });

  it("shows the current abstraction percentages", () => {
    renderControls({ abstraction: { ...identity, activities: 0.5, paths: 0.25 } });
    expect(screen.getByRole("slider", { name: "Activities" })).toHaveAttribute(
      "aria-valuenow",
      "50",
    );
    expect(screen.getByRole("slider", { name: "Paths" })).toHaveAttribute("aria-valuenow", "25");
  });

  it("announces the hidden counts in a single live region", () => {
    renderControls({ hiddenCounts: { activities: 3, paths: 7 } });
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("3 activities hidden");
    expect(status).toHaveTextContent("7 paths hidden");
  });
});

describe("AbstractionControls — a percentage tick", () => {
  it("sets the activities slider directly, without a drag", async () => {
    const user = userEvent.setup();
    const { onAbstractionChange, container } = renderControls();
    // Both sliders render a "75%" tick — scope the query to the activities
    // section (its own `data-slot`) rather than assuming DOM order.
    const activitiesSection = container.querySelector(
      '[data-slot="abstraction-controls-activities"]',
    ) as HTMLElement;
    await user.click(within(activitiesSection).getByRole("button", { name: "75%" }));
    expect(onAbstractionChange).toHaveBeenCalledWith({ activities: 0.75 });
  });
});

describe("AbstractionControls — tick position (#355)", () => {
  it("positions every tick at its own percent, derived from the slider's min/max — not spread evenly by flexbox", () => {
    renderControls();
    const ticks = screen.getAllByRole("button", { name: /^\d+%$/ });
    expect(ticks).toHaveLength(8); // 4 ticks x 2 sliders
    for (const tick of ticks) {
      const percent = Number(tick.textContent?.replace("%", ""));
      // The slider's own range is 0..100, so a tick's rail offset must equal its percent
      // exactly — a `justify-between` flex row would instead land at 0/33.3/66.7/100 for
      // this 4-tick set, never at 25/50/75/100.
      expect(tick.style.left).toBe(`${percent}%`);
    }
  });

  it("keeps the 100% tick anchored to the rail's right edge rather than centred past it", () => {
    renderControls();
    const tick100 = screen.getAllByRole("button", { name: "100%" })[0]!;
    expect(tick100.style.left).toBe("100%");
    expect(tick100.className).toContain("-translate-x-full");
    expect(tick100.className).not.toContain("-translate-x-1/2");
  });
});

describe("AbstractionControls — tick + group accessible names (#356)", () => {
  it("names three groups — the outer control plus one per slider — reusing the slider's own localized label", () => {
    renderControls();
    const groups = screen.getAllByRole("group");
    expect(groups).toHaveLength(3);
    expect(screen.getByRole("group", { name: "Abstraction" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Activities" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Paths" })).toBeInTheDocument();
  });

  it("gives every tick button its own accessible name (toHaveAccessibleName, exact string, no regex)", () => {
    renderControls();
    for (const percent of [25, 50, 75, 100]) {
      const [activitiesTick, pathsTick] = screen.getAllByRole("button", {
        name: `${percent}%`,
      });
      expect(activitiesTick).toHaveAccessibleName(`${percent}%`);
      expect(pathsTick).toHaveAccessibleName(`${percent}%`);
    }
  });

  it("disambiguates all eight ticks via group name + own name — 8 distinct qualified entries", () => {
    renderControls();
    const activitiesGroup = screen.getByRole("group", { name: "Activities" });
    const pathsGroup = screen.getByRole("group", { name: "Paths" });
    const qualifiedNames = new Set<string>();
    for (const [groupName, group] of [
      ["Activities", activitiesGroup],
      ["Paths", pathsGroup],
    ] as const) {
      const ticks = within(group).getAllByRole("button", { name: /^\d+%$/ });
      expect(ticks).toHaveLength(4);
      for (const tick of ticks) {
        qualifiedNames.add(`${groupName} ${tick.textContent}`);
      }
    }
    expect(qualifiedNames.size).toBe(8);
  });
});

describe("AbstractionControls — invert", () => {
  it("toggles the invert switch", async () => {
    const user = userEvent.setup();
    const { onAbstractionChange } = renderControls();
    await user.click(screen.getByRole("switch"));
    expect(onAbstractionChange).toHaveBeenCalledWith({ invert: true });
  });
});

describe("AbstractionControls — Auto (the RM-052 acceptance criterion)", () => {
  it("derives the pre-abstraction total from graph.activities.length + hiddenCounts.activities and requests a fraction that fits the budget", async () => {
    const user = userEvent.setup();
    // 20 kept + 40 hidden = 60 activities pre-abstraction; a 25-activity budget cannot be
    // met at 100%, so Auto must request something less than the identity fraction.
    const { onAbstractionChange } = renderControls({
      graph: { activities: fakeActivities(20) },
      hiddenCounts: { activities: 40, paths: 0 },
      autoMaxActivities: 25,
    });
    await user.click(screen.getByRole("button", { name: "Auto" }));
    expect(onAbstractionChange).toHaveBeenCalledTimes(1);
    const [call] = onAbstractionChange.mock.calls;
    const requested = call![0] as { activities: number };
    expect(requested.activities).toBeLessThan(1);
    expect(Math.round(60 * requested.activities)).toBeLessThanOrEqual(25);
  });

  it("is a no-op fraction (1) when the graph is already within budget — and paths caps at 1 too", async () => {
    const user = userEvent.setup();
    const { onAbstractionChange } = renderControls({
      graph: { activities: fakeActivities(10) },
      hiddenCounts: { activities: 0, paths: 0 },
      autoMaxActivities: 25,
    });
    await user.click(screen.getByRole("button", { name: "Auto" }));
    // activities: 1 would put the offset ("0.2 above") at 1.2 — proves the cap actually
    // clamps rather than merely never being exercised.
    expect(onAbstractionChange).toHaveBeenCalledWith({ activities: 1, paths: 1 });
  });

  it("sets paths 0.2 above the requested activities fraction — the roadmap's spec (RM-052 round 2, #227, F2 third piece)", async () => {
    const user = userEvent.setup();
    // Same over-budget shape as the first Auto test: 20 kept + 40 hidden, budget 25, so the
    // heuristic requests an activities fraction well under 0.8 — the offset stays additive
    // here rather than immediately hitting the cap tested above.
    const { onAbstractionChange } = renderControls({
      graph: { activities: fakeActivities(20) },
      hiddenCounts: { activities: 40, paths: 0 },
      autoMaxActivities: 25,
    });
    await user.click(screen.getByRole("button", { name: "Auto" }));
    const [call] = onAbstractionChange.mock.calls;
    const requested = call![0] as { activities: number; paths: number };
    expect(requested.activities).toBeLessThan(0.8);
    expect(requested.paths).toBeCloseTo(requested.activities + 0.2, 10);
  });
});

describe("AbstractionControls — Interaction story fixture suitability (#376)", () => {
  it("actually narrows under Auto's fraction, unlike the strict-chain topology auto-abstraction.test.ts locks as a known limitation", () => {
    const graph = backboneGraph();
    const totalActivities = graph.activities.length;
    const { activities: autoFraction } = computeAutoAbstraction(totalActivities, {
      maxActivities: 25,
    });
    const abstracted = abstractGraph(graph, {
      activities: autoFraction,
      paths: Math.min(1, autoFraction + 0.2),
      keepConnected: true,
    });
    // The mirror image of auto-abstraction.test.ts:154-173's "known limitation" block: that
    // test locks that a strict chain CANNOT narrow under keepConnected repair; this locks
    // that this story's backbone-plus-detours fixture CAN — so a future fixture swap cannot
    // silently reintroduce a non-narrowing graph without this test going red.
    expect(abstracted.hidden.activities).toBeGreaterThan(0);
    expect(abstracted.activities.length).toBeLessThanOrEqual(25);
  });
});
