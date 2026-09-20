import { useEffect, useMemo, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { resolveTokenColor } from "@elabs-ai/components-tokens";
import { StatePanel } from "@elabs-ai/components-ui";

import { MapCanvas } from "../map-canvas";
import { MapControls } from "../map-controls";
import { MapGeoJSON } from "../map-geojson";
import { MapRoute } from "../map-route";
import { MapArc } from "../map-arc";
import { planRegionsFromGeoJSON, type MapPlanRegion } from "../lib/plan-regions";
import { PLAN_FILL_OPACITY, planStatusMatch, type PlanStatus } from "../lib/plan-status";
import { MapPlanLegend } from "./map-plan-legend";
import { MapPlanOverlay } from "./map-plan-overlay";
import { MapPlanStatus } from "./map-plan-status";
import { MapPlanTable } from "./map-plan-table";
import { usePlanSelection } from "./use-plan-selection";
import {
  TRAIN_CARRIAGE_EXTENT,
  TRAIN_SEAT_UNIT,
  trainCarriageAisles,
  trainCarriageSeats,
  trainCarriageShells,
  trainCarriageWalk,
  type SeatProperties,
} from "./fixtures/train-carriage";

/** WebGL cannot read CSS variables; Storybook stamps `data-theme` after first paint. */
function useThemedTokenColor(name: string): string {
  const [color, setColor] = useState("#000000");
  useEffect(() => {
    const update = () => setColor(resolveTokenColor(name));
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "class"],
    });
    return () => observer.disconnect();
  }, [name]);
  return color;
}

const STATUS_LABELS: Record<PlanStatus, string> = {
  free: "Free",
  occupied: "Booked",
  warning: "Held",
  down: "Out of service",
};

const meta = {
  title: "Maps/Train Carriage",
  component: MapPlanOverlay,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Three coaches, 64 seats each — 192 regions, past what a Tab-and-arrow walk can carry. The overlay runs in group mode: one button per coach, Enter to go in, Escape to come back out, PageUp and PageDown to change coach at either level.",
      },
    },
  },
} satisfies Meta<typeof MapPlanOverlay>;
export default meta;
type Story = StoryObj<typeof meta>;

function seatStatus(seats: GeoJSON.FeatureCollection<GeoJSON.Polygon, SeatProperties>) {
  const index = new Map<string, PlanStatus>();
  for (const feature of seats.features) index.set(feature.properties.id, feature.properties.status);
  return (region: MapPlanRegion) => index.get(region.id);
}

function SeatMapDemo({ tick = 0 }: { tick?: number }) {
  const seats = useMemo(() => trainCarriageSeats(tick), [tick]);
  const regions = useMemo(
    () =>
      planRegionsFromGeoJSON(seats, {
        id: "id",
        label: "seat",
        description: (properties) =>
          `${properties.position}, ${STATUS_LABELS[properties.status as PlanStatus].toLowerCase()}`,
        group: "coach",
        groupLabel: "coachLabel",
      }),
    [seats],
  );

  const selection = usePlanSelection();
  const [activeId, setActiveId] = useState<string | null>(null);

  const body = useThemedTokenColor("--muted");
  const outline = useThemedTokenColor("--border-strong");
  const primary = useThemedTokenColor("--primary");
  const free = useThemedTokenColor("--success");
  const booked = useThemedTokenColor("--muted-foreground");
  const held = useThemedTokenColor("--warning");
  const out = useThemedTokenColor("--destructive");

  const toneByStatus: Record<PlanStatus, string> = {
    free,
    occupied: booked,
    warning: held,
    down: out,
  };

  const counts = useMemo(() => {
    const tally: Partial<Record<PlanStatus, number>> = {};
    for (const feature of seats.features) {
      const status = feature.properties.status;
      tally[status] = (tally[status] ?? 0) + 1;
    }
    return tally;
  }, [seats]);

  const selected = seats.features.find(
    (feature) => feature.properties.id === selection.selectedId,
  )?.properties;

  return (
    <div className="flex h-[680px] flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <MapPlanLegend
          labels={STATUS_LABELS}
          counts={counts}
          label="What each seat’s state means"
        />
        <p className="text-meta text-muted-foreground">{TRAIN_SEAT_UNIT}</p>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden rounded-md">
        <MapCanvas blank plan={TRAIN_CARRIAGE_EXTENT} className="h-full">
          <MapGeoJSON
            id="coaches"
            data={trainCarriageShells}
            interactive={false}
            fillPaint={{ "fill-color": body, "fill-opacity": 0.35 }}
            linePaint={{ "line-color": outline, "line-width": 2 }}
          />
          <MapGeoJSON
            id="aisles"
            data={trainCarriageAisles}
            interactive={false}
            fillPaint={false}
            linePaint={{
              "line-color": outline,
              "line-width": 1,
              "line-opacity": 0.5,
              "line-dasharray": [2, 2],
            }}
          />
          <MapGeoJSON<SeatProperties>
            id="seats"
            data={seats}
            promoteId="id"
            selectedId={selection.selectedIds}
            hoveredId={activeId}
            fillPaint={{
              "fill-color": planStatusMatch(
                "status",
                (_encoding, status) => toneByStatus[status],
              ) as never,
              "fill-opacity": PLAN_FILL_OPACITY.rest,
            }}
            fillHoverPaint={{ "fill-opacity": PLAN_FILL_OPACITY.hover }}
            fillSelectedPaint={{ "fill-opacity": PLAN_FILL_OPACITY.selected }}
            linePaint={{
              "line-color": planStatusMatch(
                "status",
                (_encoding, status) => toneByStatus[status],
              ) as never,
              "line-width": 1.5,
              "line-dasharray": planStatusMatch("status", (encoding) => [
                "literal",
                encoding.dashArray ?? [1, 0],
              ]) as never,
            }}
            lineSelectedPaint={{ "line-color": primary, "line-width": 3 }}
          />
          <MapPlanOverlay
            regions={regions}
            label="Seats on this train"
            mode="groups"
            describeGroup={(group) => `${group.members.length} seats`}
            selectedId={selection.selectedIds}
            onSelect={(id) => selection.select(id)}
            onActiveChange={setActiveId}
          />
          <MapControls position="top-right" />
        </MapCanvas>
      </div>

      <p className="text-caption text-muted-foreground">
        {selected
          ? `Seat ${selected.seat} in ${selected.coachLabel}: ${STATUS_LABELS[selected.status].toLowerCase()}, ${selected.position} seat.`
          : "Pick a coach — click it, or Tab into the plan and press Enter to go in. Escape comes back out."}
      </p>

      <MapPlanStatus
        message={
          selected
            ? `Seat ${selected.seat} in ${selected.coachLabel} selected.`
            : `${counts.free ?? 0} of ${seats.features.length} seats free.`
        }
      />

      <div className="max-h-48 min-h-0 overflow-auto">
        <MapPlanTable
          regions={regions}
          caption={`Every seat on the train, with its state (${TRAIN_SEAT_UNIT})`}
          nameHeader="Seat"
          status={seatStatus(seats)}
          statusLabels={STATUS_LABELS}
          statusHeader="State"
          selectedId={selection.selectedIds}
          onSelect={(id) => selection.select(id)}
          columns={[
            {
              key: "coach",
              header: "Coach",
              cell: (region) =>
                seats.features.find((feature) => feature.properties.id === region.id)?.properties
                  .coachLabel ?? "",
            },
            {
              key: "position",
              header: "Side",
              cell: (region) =>
                seats.features.find((feature) => feature.properties.id === region.id)?.properties
                  .position ?? "",
            },
          ]}
        />
      </div>
    </div>
  );
}

/**
 * The seat map as a passenger meets it: coaches first, seats once you are in one.
 * Statuses are seeded, so this is one deterministic train, not a different one
 * every run.
 */
export const SeatMap: Story = {
  render: () => <SeatMapDemo />,
  play: async ({ canvas, userEvent }) => {
    const coach = await canvas.findByRole("button", { name: "Coach A, 64 seats" });
    await expect(coach).toHaveAccessibleName("Coach A, 64 seats");
    // A coach's button is a way in, not a toggle.
    await expect(coach).not.toHaveAttribute("aria-pressed");

    coach.focus();
    await userEvent.keyboard("{Enter}");

    // Inside coach A: one button per seat, and the first one has focus.
    const seat = await canvas.findByRole("button", { name: /^1A, / });
    await expect(seat).toBeInTheDocument();
    await expect(canvas.queryByRole("button", { name: /^Coach B/ })).not.toBeInTheDocument();

    await userEvent.keyboard("{Escape}");
    await expect(await canvas.findByRole("button", { name: "Coach B, 64 seats" })).toBeVisible();
  },
};

/**
 * The same train with every seat on the overlay at once — 192 buttons, which the
 * component warns about, and which is exactly why group mode is the default here.
 */
export const EverySeatAtOnce: Story = {
  render: () => {
    function Demo() {
      const seats = useMemo(() => trainCarriageSeats(), []);
      const regions = useMemo(
        () => planRegionsFromGeoJSON(seats, { id: "id", label: "seat" }),
        [seats],
      );
      const outline = useThemedTokenColor("--border-strong");

      return (
        <div className="h-[520px] p-4">
          <MapCanvas blank plan={TRAIN_CARRIAGE_EXTENT} className="h-full">
            <MapGeoJSON
              id="coaches"
              data={trainCarriageShells}
              interactive={false}
              fillPaint={false}
              linePaint={{ "line-color": outline, "line-width": 2 }}
            />
            <MapGeoJSON
              id="seats"
              data={seats}
              promoteId="id"
              fillPaint={false}
              linePaint={{ "line-color": outline, "line-width": 1 }}
            />
            <MapPlanOverlay regions={regions} label="Every seat on this train" showLabels={false} />
            <MapControls position="top-right" />
          </MapCanvas>
        </div>
      );
    }
    return <Demo />;
  },
};

/**
 * Which way the train runs, and the walk from the door of coach A to a seat in
 * coach C: chevrons along the aisle, and a curve built in PLAN units — a curve
 * sampled in lng/lat would bow the wrong way once Mercator has had its say.
 */
export const DirectionOfTravel: Story = {
  render: () => {
    function Demo() {
      const outline = useThemedTokenColor("--border-strong");
      const accent = useThemedTokenColor("--primary");
      const seats = useMemo(() => trainCarriageSeats(), []);

      return (
        <div className="space-y-2 p-4">
          <p className="text-caption text-muted-foreground">
            Chevrons show the direction of travel; the curve is the walk from the door of coach A to
            seat 14C in coach C.
          </p>
          <div className="h-[460px]">
            <MapCanvas blank plan={TRAIN_CARRIAGE_EXTENT} className="h-full">
              <MapGeoJSON
                id="coaches"
                data={trainCarriageShells}
                interactive={false}
                fillPaint={false}
                linePaint={{ "line-color": outline, "line-width": 2 }}
              />
              <MapGeoJSON
                id="seats"
                data={seats}
                promoteId="id"
                interactive={false}
                fillPaint={false}
                linePaint={{ "line-color": outline, "line-width": 1, "line-opacity": 0.6 }}
              />
              <MapRoute
                id="walk"
                coordinates={trainCarriageWalk}
                color={accent}
                width={2.5}
                direction="forward"
                directionSpacing={70}
              />
              <MapArc
                id="transfer"
                data={[{ id: "a-to-c", from: [220, 240], to: [2400, 1130] }]}
                curvature={0.25}
                paint={{ "line-color": accent, "line-width": 2, "line-dasharray": [2, 2] }}
              />
              <MapControls position="top-right" />
            </MapCanvas>
          </div>
        </div>
      );
    }
    return <Demo />;
  },
};

/** The train as words — the channel that survives a printer and a screen reader. */
export const WholeTrainTable: Story = {
  render: () => {
    function Demo() {
      const seats = trainCarriageSeats();
      const regions = planRegionsFromGeoJSON(seats, { id: "id", label: "seat" });
      return (
        <div className="space-y-3 p-4">
          <p className="text-caption text-muted-foreground">
            A WebGL canvas prints blank, so the seat map carries its own table ({TRAIN_SEAT_UNIT}).
          </p>
          <MapPlanTable
            regions={regions.slice(0, 32)}
            caption="The first two rows of every coach, with each seat’s state"
            nameHeader="Seat"
            status={seatStatus(seats)}
            statusLabels={STATUS_LABELS}
            statusHeader="State"
          />
        </div>
      );
    }
    return <Demo />;
  },
};

/** Nothing to show yet: the canvas holds its shape and says so once. */
export const Loading: Story = {
  render: () => (
    <div className="h-[420px] p-4">
      <MapCanvas blank plan={TRAIN_CARRIAGE_EXTENT} loading className="h-full" />
    </div>
  ),
};

/** No seat data at all — a panel, not an empty plan. */
export const NoSeatData: Story = {
  render: () => (
    <div className="h-[420px] p-4">
      <StatePanel
        kind="empty"
        title="No seat map for this service"
        description="This train has no seat reservations, so there is nothing to lay out."
      />
    </div>
  ),
};
