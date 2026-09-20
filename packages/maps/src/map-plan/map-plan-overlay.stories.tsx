import { useMemo, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { StatePanel } from "@elabs-ai/components-ui";

import { MapCanvas } from "../map-canvas";
import { MapGeoJSON } from "../map-geojson";
import { useTokenColor } from "../lib/use-token-color";
import { planRegionsFromGeoJSON, type MapPlanRegion } from "../lib/plan-regions";
import { PLAN_FILL_OPACITY, planStatusMatch, type PlanStatus } from "../lib/plan-status";
import { MapPlanLegend } from "./map-plan-legend";
import { MapPlanOverlay } from "./map-plan-overlay";
import { MapPlanStatus } from "./map-plan-status";
import { MapPlanTable } from "./map-plan-table";
import { usePlanSelection } from "./use-plan-selection";

const PLAN = { width: 1200, height: 600, unit: "cm" } as const;

interface BayProperties {
  id: string;
  name: string;
  /** Which half of the hall the bay sits in — the group, in group mode. */
  side: string;
  sideLabel: string;
  status: PlanStatus;
  [key: string]: unknown;
}

const STATE_WORD: Partial<Record<PlanStatus, string>> = {
  free: "Free",
  occupied: "In use",
  warning: "Needs attention",
  down: "Out of service",
};

/** Four bays, two a side: small enough to read in a story, big enough for group mode. */
const BAYS: GeoJSON.FeatureCollection<GeoJSON.Polygon, BayProperties> = {
  type: "FeatureCollection",
  features: (
    [
      ["west-1", "Bay 1", "west", "West side", "free", 60, 60],
      ["west-2", "Bay 2", "west", "West side", "occupied", 60, 330],
      ["east-1", "Bay 3", "east", "East side", "warning", 640, 60],
      ["east-2", "Bay 4", "east", "East side", "down", 640, 330],
    ] as [string, string, string, string, PlanStatus, number, number][]
  ).map(([id, name, side, sideLabel, status, x, y]) => ({
    type: "Feature",
    id,
    properties: { id, name, side, sideLabel, status },
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [x, y],
          [x + 500, y],
          [x + 500, y + 210],
          [x, y + 210],
          [x, y],
        ],
      ],
    },
  })),
};

const meta = {
  title: "Maps/MapPlanOverlay",
  component: MapPlanOverlay,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          'A shape drawn in WebGL is not a DOM element, so it cannot be focused, named or pressed. `MapPlanOverlay` puts one real `<button aria-pressed>` over each region of a plan — roving tabindex, arrow keys that travel the way the plan looks, `Enter` to select, `Escape` to clear — and projects the boxes in a single coalesced pass per frame.\n\nPast what a keyboard can reasonably walk (a train with 192 seats), `mode="groups"` puts one button on each group instead and `Enter` descends into its members. The parts beside it carry the same facts in other channels: `MapPlanLegend` says what the appearances mean, `MapPlanTable` is the plan as words, and `MapPlanStatus` is one polite live region per plan.',
      },
    },
  },
} satisfies Meta<typeof MapPlanOverlay>;
export default meta;
type Story = StoryObj<typeof meta>;

function bayState(region: MapPlanRegion) {
  return BAYS.features.find((feature) => feature.properties.id === region.id)?.properties.status;
}

function BayLayers({
  selectedId,
  hoveredId,
}: {
  selectedId: readonly string[];
  hoveredId: string | null;
}) {
  const primary = useTokenColor("--primary");
  const free = useTokenColor("--success");
  const busy = useTokenColor("--muted-foreground");
  const warning = useTokenColor("--warning");
  const down = useTokenColor("--destructive");
  const tone: Record<PlanStatus, string> = { free, occupied: busy, warning, down };

  return (
    <MapGeoJSON<BayProperties>
      id="bays"
      data={BAYS}
      promoteId="id"
      selectedId={selectedId}
      hoveredId={hoveredId}
      fillPaint={{
        "fill-color": planStatusMatch("status", (_encoding, status) => tone[status]) as never,
        "fill-opacity": PLAN_FILL_OPACITY.rest,
      }}
      fillHoverPaint={{ "fill-opacity": PLAN_FILL_OPACITY.hover }}
      fillSelectedPaint={{ "fill-opacity": PLAN_FILL_OPACITY.selected }}
      // The dash is the STATE channel and reads feature properties; selection rides
      // feature-state instead, so the two can never overwrite each other.
      linePaint={{
        "line-color": planStatusMatch("status", (_encoding, status) => tone[status]) as never,
        "line-width": 1.75,
        "line-dasharray": planStatusMatch("status", (encoding) => [
          "literal",
          encoding.dashArray ?? [1, 0],
        ]) as never,
      }}
      lineSelectedPaint={{ "line-color": primary, "line-width": 3.5 }}
    />
  );
}

/** One button per region: the default, for a plan a keyboard can walk. */
export const Default: Story = {
  render: () => <PlanDemo />,
  play: async ({ canvas }) => {
    // The exact accessible name: the visible label comes first (WCAG 2.5.3), and if the
    // browser ever fails to hand MapLibre a WebGL context this fails instead of passing
    // on an error panel.
    await expect(await canvas.findByRole("button", { name: "Bay 1, Free" })).toBeInTheDocument();
    await expect(canvas.getByRole("list", { name: "Bays in this hall" })).toBeInTheDocument();
  },
};

function PlanDemo({ mode = "regions" as const }: { mode?: "regions" | "groups" }) {
  const regions = useMemo(
    () =>
      planRegionsFromGeoJSON(BAYS, {
        id: "id",
        label: "name",
        description: (properties) => STATE_WORD[properties.status] ?? "",
        group: "side",
        groupLabel: "sideLabel",
      }),
    [],
  );
  const selection = usePlanSelection();
  const [activeId, setActiveId] = useState<string | null>(null);

  const selected = BAYS.features.find(
    (feature) => feature.properties.id === selection.selectedId,
  )?.properties;

  return (
    <div className="flex h-[620px] flex-col gap-3 p-4">
      <MapPlanLegend labels={STATE_WORD} label="What each bay’s appearance means" />

      <div className="relative min-h-0 flex-1 overflow-hidden rounded-md">
        <MapCanvas blank plan={PLAN} className="h-full">
          <BayLayers selectedId={selection.selectedIds} hoveredId={activeId} />
          <MapPlanOverlay
            regions={regions}
            label="Bays in this hall"
            mode={mode}
            describeGroup={(group) => `${group.members.length} bays`}
            selectedId={selection.selectedIds}
            onSelect={(id) => selection.select(id)}
            onActiveChange={setActiveId}
          />
        </MapCanvas>
      </div>

      <MapPlanStatus
        message={selected ? `${selected.name} selected.` : "Nothing selected in this hall."}
      />

      <MapPlanTable
        regions={regions}
        caption="Every bay in the hall, with its state"
        nameHeader="Bay"
        status={bayState}
        statusLabels={STATE_WORD}
        statusHeader="State"
        selectedId={selection.selectedIds}
        onSelect={(id) => selection.select(id)}
      />
    </div>
  );
}

/**
 * Group mode: one button per group, `Enter` to go in, `Escape` to come back out,
 * `PageUp`/`PageDown` to change group at either level.
 */
export const Groups: Story = {
  render: () => <PlanDemo mode="groups" />,
  play: async ({ canvas, userEvent }) => {
    const side = await canvas.findByRole("button", { name: "West side, 2 bays" });
    // A group's button is a way in, not a toggle.
    await expect(side).not.toHaveAttribute("aria-pressed");
    side.focus();
    await userEvent.keyboard("{Enter}");
    await expect(await canvas.findByRole("button", { name: "Bay 1, Free" })).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    await expect(await canvas.findByRole("button", { name: "East side, 2 bays" })).toBeVisible();
  },
};

/** The plan as words only — what a printer gets, since a WebGL canvas prints blank. */
export const AsWords: Story = {
  render: () => {
    const regions = planRegionsFromGeoJSON(BAYS, { id: "id", label: "name" });
    return (
      <div className="space-y-3 p-4">
        <p className="text-caption text-muted-foreground">
          The same facts as the plan, in the channel that survives a printer and a screen reader. In
          a plan meant for paper this table carries <code>printOnly</code>.
        </p>
        <MapPlanTable
          regions={regions}
          caption="Every bay in the hall, with its state"
          nameHeader="Bay"
          status={bayState}
          statusLabels={STATE_WORD}
          statusHeader="State"
        />
      </div>
    );
  },
};

/** Nothing on the plan yet: the canvas keeps its shape and says so once. */
export const Loading: Story = {
  render: () => (
    <div className="h-[420px] p-4">
      <MapCanvas blank plan={PLAN} loading className="h-full" />
    </div>
  ),
};

/** A plan with no regions on it — a panel, not an empty grid. */
export const NoRegions: Story = {
  render: () => (
    <div className="relative h-[420px] p-4">
      <MapCanvas blank plan={PLAN} className="h-full" />
      <div className="absolute inset-0 grid place-items-center p-8">
        <StatePanel
          kind="empty"
          title="No bays in this hall"
          description="Import the hall’s bays to see them laid out here."
        />
      </div>
    </div>
  ),
};
