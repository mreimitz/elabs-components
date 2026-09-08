import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { abstractGraph, type AbstractionOptions } from "../core/abstract-graph";
import { discoverGraph } from "../core/discover-graph";
import { generateSyntheticLog } from "../core/fixtures/synthetic-log";
import type { ProcessGraph } from "../core/types";
import { AbstractionControls } from "./abstraction-controls";
import { backboneGraph } from "./abstraction-controls-fixtures";

const log = generateSyntheticLog({ cases: 240, seed: 42 });
const fullGraph = discoverGraph(log);

/**
 * `busyGraph` is what makes the `Interaction` story below a REAL narrowing rather than a
 * round trip back to 100% — see {@link backboneGraph}'s own docblock for why its topology
 * (not merely its size) is what makes that true (#376).
 */
const busyGraph = backboneGraph();

function ControlledAbstractionControls({
  graph = fullGraph,
  initial,
  autoMaxActivities,
}: {
  graph?: ProcessGraph;
  initial: AbstractionOptions;
  autoMaxActivities?: number;
}) {
  const [abstraction, setAbstraction] = useState<AbstractionOptions>(initial);
  const abstracted = abstractGraph(graph, abstraction);
  return (
    <div className="max-w-sm">
      <AbstractionControls
        abstraction={abstraction}
        onAbstractionChange={(next) => setAbstraction((prev) => ({ ...prev, ...next }))}
        graph={abstracted}
        hiddenCounts={abstracted.hidden}
        autoMaxActivities={autoMaxActivities}
      />
    </div>
  );
}

const meta = {
  title: "Process/AbstractionControls",
  component: AbstractionControls,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "The two sliders every process-mining explorer opens with. Activities/paths " +
          "abstraction is a VIEW filter over `ProcessMap`, never a re-analysis — dragging a " +
          "slider hides nodes/edges, it never recomputes a statistic (`abstractGraph`'s own " +
          "contract). The 'Auto' button runs a bounded, deterministic search " +
          "(`computeAutoAbstraction`) for the largest activities fraction that still fits a " +
          "node budget, so a reader can open a busy graph and get a readable one in one click.",
      },
    },
  },
} satisfies Meta<typeof AbstractionControls>;
export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Identity abstraction — nothing hidden yet. Also the geometry lock for #355: each INTERIOR
 * tick's measured centre (`getBoundingClientRect`, a real layout, not a JSDOM stand-in) must
 * sit at its own value's fraction of the slider track — a `justify-between` flex row would
 * instead land the four ticks at 0/33.3/66.7/100, never at 25/50/75/100 — on BOTH sliders. The
 * `100%` tick is deliberately right-aligned instead of centred (so it is never clipped by the
 * rail's own right edge, per the issue's own "translate-x only for interior ticks" option), so
 * its RIGHT edge — not its centre — is what is asserted against the track's right edge.
 * Clicking the `50%` tick must move the thumb to that tick's own measured centre.
 */
export const Default: Story = {
  render: () => (
    <ControlledAbstractionControls
      initial={{ activities: 1, paths: 1, invert: false, keepConnected: true }}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const tolerancePx = 2;

    for (const group of ["Activities", "Paths"]) {
      const slider = canvas.getByRole("slider", { name: group });
      const trackRect = (slider.closest(".relative") as HTMLElement).getBoundingClientRect();
      const ticks = within(canvas.getByRole("group", { name: group })).getAllByRole("button", {
        name: /^\d+%$/,
      });
      expect(ticks).toHaveLength(4);
      for (const tick of ticks) {
        const percent = Number(tick.textContent?.replace("%", ""));
        const tickRect = tick.getBoundingClientRect();
        const expectedX = trackRect.left + (percent / 100) * trackRect.width;
        if (percent >= 100) {
          // Right-aligned, not centred — its right edge (not its centre) marks the value.
          expect(Math.abs(tickRect.right - expectedX)).toBeLessThanOrEqual(tolerancePx);
          expect(tickRect.right).toBeLessThanOrEqual(trackRect.right + tolerancePx);
        } else {
          const tickCentre = tickRect.left + tickRect.width / 2;
          expect(Math.abs(tickCentre - expectedX)).toBeLessThanOrEqual(tolerancePx);
        }
      }
    }

    // Clicking the 50% tick moves the thumb to that tick's own measured centre.
    const activitiesSlider = canvas.getByRole("slider", { name: "Activities" });
    const activitiesTick50 = within(canvas.getByRole("group", { name: "Activities" })).getByRole(
      "button",
      { name: "50%" },
    );
    const tick50Centre = (() => {
      const r = activitiesTick50.getBoundingClientRect();
      return r.left + r.width / 2;
    })();
    await userEvent.click(activitiesTick50);
    await waitFor(() => expect(activitiesSlider).toHaveAttribute("aria-valuenow", "50"));
    // The attribute and the thumb's own layout both come from the same `value` prop update,
    // but give layout one more macrotask to settle before measuring it (real-browser paint,
    // not a JSDOM stand-in).
    await waitFor(() => {
      const thumbRect = activitiesSlider.getBoundingClientRect();
      const thumbCentre = thumbRect.left + thumbRect.width / 2;
      expect(Math.abs(thumbCentre - tick50Centre)).toBeLessThanOrEqual(tolerancePx);
    });
  },
};

/** Half the activities kept — the hidden-count status line reflects the real hidden count. */
export const PartiallyAbstracted: Story = {
  render: () => (
    <ControlledAbstractionControls
      initial={{ activities: 0.5, paths: 0.5, invert: false, keepConnected: true }}
    />
  ),
};

/** The "what is rare here" reading — `invert` hides the MOST frequent instead of the least. */
export const Inverted: Story = {
  render: () => (
    <ControlledAbstractionControls
      initial={{ activities: 0.5, paths: 1, invert: true, keepConnected: true }}
    />
  ),
};

/**
 * Dragging a percentage tick sets the corresponding slider directly, and clicking "Auto"
 * runs the bounded heuristic and narrows `busyGraph` (its backbone-plus-detours topology,
 * see {@link backboneGraph}) down to fit its default 25-activity budget — the RM-052
 * acceptance criterion for the control, exercised against a real, oversized graph rather
 * than a stub. This holds for THIS fixture's topology; it is not a general guarantee of
 * "Auto" — on a strict activity chain the same heuristic's prediction and the abstracted
 * result can diverge (`keepConnected`'s reachability repair re-adds the whole chain; see
 * #343, which owns that runtime behaviour and is out of scope here).
 */
export const Interaction: Story = {
  render: () => (
    <ControlledAbstractionControls
      graph={busyGraph}
      initial={{ activities: 1, paths: 1, invert: false, keepConnected: true }}
      autoMaxActivities={25}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const activitiesSlider = canvas.getByRole("slider", { name: "Activities" });
    const status = canvasElement.querySelector('[role="status"]');
    expect(activitiesSlider).toHaveAttribute("aria-valuenow", "100");
    expect(status).toHaveTextContent("0 activities hidden");

    // A percentage tick sets its slider directly, without requiring a drag.
    const tick50 = canvas.getAllByRole("button", { name: "50%" })[0]!;
    await userEvent.click(tick50);
    await waitFor(() => expect(activitiesSlider).toHaveAttribute("aria-valuenow", "50"));

    // "Auto" narrows toward the 25-activity budget. The slider value is a secondary check —
    // the assertion that actually catches a non-narrowing run is the live region's own text,
    // since that is what a reader of the control sees (#376).
    const autoButton = canvas.getByRole("button", { name: "Auto" });
    await userEvent.click(autoButton);
    await waitFor(() => expect(status).toHaveTextContent(/[1-9]\d* activit(?:y|ies) hidden/));
    const afterAuto = Number(activitiesSlider.getAttribute("aria-valuenow"));
    expect(Math.round(60 * (afterAuto / 100))).toBeLessThanOrEqual(25);
  },
};
