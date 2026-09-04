import type { Meta, StoryObj } from "@storybook/react-vite";
import { feature } from "topojson-client";
import type { Topology } from "topojson-specification";
import type { FeatureCollection, Geometry } from "geojson";
import { ChoroplethChart } from "./choropleth-chart";
import { ChoroplethFeature as ChoroplethFeatureComponent } from "./choropleth-feature";
import { ChoroplethTooltip } from "./choropleth-tooltip";
import type { ChoroplethFeature, ChoroplethFeatureProperties } from "./choropleth-context";

// ---------------------------------------------------------------------------
// Sample data: load world-atlas countries-110m topology synchronously via
// a static import so the story works without network calls.
// ---------------------------------------------------------------------------
// Vite/Storybook resolve JSON imports natively — no import attribute needed
// (the deprecated `assert { type: "json" }` breaks Storybook's story indexer).
import worldAtlas from "world-atlas/countries-110m.json";

const topology = worldAtlas as unknown as Topology;

// Convert TopoJSON → GeoJSON FeatureCollection with value annotations
const VALUE_MAP: Record<string, number> = {
  "840": 334, // USA
  "124": 185, // Canada
  "826": 142, // UK
  "276": 210, // Germany
  "250": 196, // France
  "392": 220, // Japan
  "156": 412, // China
  "356": 310, // India
  "076": 155, // Brazil
  "036": 130, // Australia
  "724": 118, // Spain
  "380": 108, // Italy
};

const NAME_MAP: Record<string, string> = {
  "840": "United States",
  "124": "Canada",
  "826": "United Kingdom",
  "276": "Germany",
  "250": "France",
  "392": "Japan",
  "156": "China",
  "356": "India",
  "076": "Brazil",
  "036": "Australia",
  "724": "Spain",
  "380": "Italy",
};

// Build the annotated FeatureCollection once at module level
const countriesTopology = topology.objects["countries"];
const rawCollection = countriesTopology
  ? feature(topology, countriesTopology)
  : { type: "FeatureCollection" as const, features: [] };

const worldData: FeatureCollection<Geometry, ChoroplethFeatureProperties> = {
  type: "FeatureCollection",
  features: (rawCollection as FeatureCollection).features.map((f) => {
    const id = String(f.id ?? "");
    return {
      ...f,
      properties: {
        ...f.properties,
        id,
        name: NAME_MAP[id] ?? (f.properties as { name?: string } | null)?.name ?? id,
        value: VALUE_MAP[id],
      },
    };
  }),
};

// Value accessor for tooltip
function getFeatureValue(f: { properties: ChoroplethFeatureProperties }): number | undefined {
  return typeof f.properties.value === "number" ? f.properties.value : undefined;
}

// ---------------------------------------------------------------------------

const meta = {
  title: "Charts/ChoroplethChart",
  component: ChoroplethChart,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
  },
} satisfies Meta<typeof ChoroplethChart>;

export default meta;
type Story = StoryObj<typeof meta>;

/** World choropleth with default chart token colors and a value tooltip. */
export const Default: Story = {
  render: () => (
    <div className="h-72 w-[560px]">
      <ChoroplethChart data={worldData} aspectRatio="16 / 9">
        <ChoroplethFeatureComponent />
        <ChoroplethTooltip getFeatureValue={getFeatureValue} valueLabel="Score" />
      </ChoroplethChart>
    </div>
  ),
};

/** Zoom and pan enabled. */
export const ZoomEnabled: Story = {
  render: () => (
    <div className="h-72 w-[560px]">
      <ChoroplethChart data={worldData} aspectRatio="16 / 9" zoomEnabled>
        <ChoroplethFeatureComponent />
        <ChoroplethTooltip getFeatureValue={getFeatureValue} valueLabel="Score" />
      </ChoroplethChart>
    </div>
  ),
};

/**
 * Accessible name + keyboard navigation overlay.
 *
 * - The container gets `role="figure"` + `aria-label` + `aria-describedby`
 *   matching the pattern used by all other @elabs-ai/components-charts charts (issue #145).
 * - `keyboardNav` adds a visually-hidden listbox so keyboard users can
 *   arrow-navigate through geographic features. Each item announces its
 *   region name and score value. Focus syncs to the SVG highlight.
 * - Tab into the map → first feature is focused; ArrowRight / ArrowDown
 *   moves forward; ArrowLeft / ArrowUp moves back; Home / End jumps to
 *   first / last.
 */
export const AccessibleName: Story = {
  render: () => (
    <div className="h-72 w-[560px]">
      <ChoroplethChart
        data={worldData}
        aspectRatio="16 / 9"
        accessibleLabel="World market scores choropleth map"
        accessibleDescription="12 annotated countries. Score range: 108 (Italy) to 412 (China)."
        keyboardNav={{
          navLabel: "Map regions — use arrow keys to navigate",
          getFeatureName: (f: ChoroplethFeature) =>
            (f.properties?.name as string | undefined) ?? "Unknown region",
          getFeatureValue: (f: ChoroplethFeature) =>
            typeof f.properties?.value === "number" ? f.properties.value : undefined,
          valueLabel: "Score",
        }}
      >
        <ChoroplethFeatureComponent />
        <ChoroplethTooltip getFeatureValue={getFeatureValue} valueLabel="Score" />
      </ChoroplethChart>
    </div>
  ),
};

// ---------------------------------------------------------------------------
// Data-table fallback
// ---------------------------------------------------------------------------

/** Rows derived from the annotated features (countries with a VALUE_MAP entry). */
const tableRows = worldData.features
  .filter((f) => typeof f.properties?.value === "number")
  .map((f) => ({
    id: String(f.properties?.id ?? ""),
    name: String(f.properties?.name ?? ""),
    value: f.properties?.value as number,
  }))
  .sort((a, b) => b.value - a.value);

/**
 * Data-table fallback — the tabular equivalent of the map data.
 *
 * The chart renders normally; below it (visually) sits an accessible `<table>`
 * that exposes every annotated data point to screen-reader + keyboard users.
 * This is the standard non-visual fallback for SVG data visualisation (WCAG
 * 1.1.1 text alternative) and gives keyboard users a structured way to scan
 * all values without relying on the keyboard-nav overlay.
 *
 * In production, conditionally render the table (e.g. via a visually-hidden
 * `sr-only` wrapper) or use ChartFrame's flip-to-table button (issue #116).
 */
export const DataTableFallback: Story = {
  render: () => (
    <div className="w-[560px] space-y-4">
      <ChoroplethChart
        data={worldData}
        aspectRatio="16 / 9"
        accessibleLabel="World market scores choropleth map"
        accessibleDescription="See the data table below for all values."
      >
        <ChoroplethFeatureComponent />
        <ChoroplethTooltip getFeatureValue={getFeatureValue} valueLabel="Score" />
      </ChoroplethChart>

      {/* Visually-hidden data table — provides the WCAG 1.1.1 text alternative. */}
      {/* Remove sr-only to make it always-visible (e.g. for print/export). */}
      <div className="sr-only">
        <table>
          <caption>World market scores by country</caption>
          <thead>
            <tr>
              <th scope="col">Country</th>
              <th scope="col">Score</th>
            </tr>
          </thead>
          <tbody>
            {tableRows.map((row) => (
              <tr key={row.id}>
                <td>{row.name}</td>
                <td>{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Always-visible version (visible in this story for demonstration). */}
      <div aria-hidden="true" className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-body">
          <caption className="sr-only">World market scores by country (visible demo copy)</caption>
          <thead>
            <tr className="border-b border-border bg-surface-muted text-left text-muted-foreground">
              <th className="px-3 py-2 font-medium" scope="col">
                Country
              </th>
              <th className="px-3 py-2 font-medium tabular-nums" scope="col">
                Score
              </th>
            </tr>
          </thead>
          <tbody>
            {tableRows.map((row, i) => (
              <tr
                className={
                  i % 2 === 0
                    ? "bg-background text-foreground"
                    : "bg-surface-muted/50 text-foreground"
                }
                key={row.id}
              >
                <td className="px-3 py-1.5">{row.name}</td>
                <td className="px-3 py-1.5 tabular-nums">{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  ),
};

// ---------------------------------------------------------------------------
// noDataFill + labelTop (RM-032) — a schematic US-states map.
//
// world-atlas (this package's only geo-data dependency) ships country-level
// topology only; there is no state-level TopoJSON in the dependency tree and
// adding one (e.g. `us-atlas`) is outside this item's touched-file set. Each
// "state" below is instead a small square Polygon centered on that state's
// real approximate lon/lat, sized by a rough small/medium/large land-area
// tier — schematic, not survey-accurate, but positioned in real geographic
// space so the cluster reads as a US map. Alaska and Hawaii are placed at the
// common cartographic "inset" position (bottom-left of the frame) rather than
// their real remote coordinates, matching how every mainstream US choropleth
// (e.g. d3's albersUsa) insets them, and carry no `value` — the no-data case
// this story exists to demonstrate.
// ---------------------------------------------------------------------------

type StateTier = "S" | "M" | "L";

const TIER_HALF_WIDTH: Record<StateTier, number> = { S: 0.35, M: 0.8, L: 1.3 };

interface StateSeed {
  id: string;
  name: string;
  lon: number;
  lat: number;
  tier: StateTier;
  /** Population in millions (approx., for a recognizable "5 largest" story). `undefined` = no data. */
  value?: number;
}

const US_STATE_SEEDS: StateSeed[] = [
  { id: "CA", name: "California", lon: -119.7, lat: 37.2, tier: "L", value: 39.24 },
  { id: "TX", name: "Texas", lon: -99.3, lat: 31.0, tier: "L", value: 30.5 },
  { id: "FL", name: "Florida", lon: -82.4, lat: 28.6, tier: "M", value: 22.24 },
  { id: "NY", name: "New York", lon: -75.5, lat: 42.9, tier: "M", value: 19.34 },
  { id: "PA", name: "Pennsylvania", lon: -77.8, lat: 40.9, tier: "M", value: 13.0 },
  { id: "IL", name: "Illinois", lon: -89.2, lat: 40.0, tier: "M", value: 12.81 },
  { id: "OH", name: "Ohio", lon: -82.9, lat: 40.4, tier: "M", value: 11.8 },
  { id: "GA", name: "Georgia", lon: -83.4, lat: 32.6, tier: "M", value: 10.91 },
  { id: "NC", name: "North Carolina", lon: -79.4, lat: 35.5, tier: "M", value: 10.7 },
  { id: "MI", name: "Michigan", lon: -85.4, lat: 44.3, tier: "M", value: 10.05 },
  { id: "NJ", name: "New Jersey", lon: -74.7, lat: 40.1, tier: "S", value: 9.29 },
  { id: "VA", name: "Virginia", lon: -78.7, lat: 37.5, tier: "M", value: 8.68 },
  { id: "WA", name: "Washington", lon: -120.5, lat: 47.4, tier: "L", value: 7.79 },
  { id: "AZ", name: "Arizona", lon: -111.9, lat: 34.2, tier: "L", value: 7.28 },
  { id: "TN", name: "Tennessee", lon: -86.3, lat: 35.8, tier: "M", value: 7.05 },
  { id: "MA", name: "Massachusetts", lon: -71.8, lat: 42.3, tier: "S", value: 7.03 },
  { id: "IN", name: "Indiana", lon: -86.3, lat: 39.9, tier: "M", value: 6.81 },
  { id: "MO", name: "Missouri", lon: -92.6, lat: 38.5, tier: "M", value: 6.17 },
  { id: "MD", name: "Maryland", lon: -76.7, lat: 39.0, tier: "S", value: 6.16 },
  { id: "WI", name: "Wisconsin", lon: -89.9, lat: 44.6, tier: "M", value: 5.89 },
  { id: "CO", name: "Colorado", lon: -105.5, lat: 39.0, tier: "L", value: 5.84 },
  { id: "MN", name: "Minnesota", lon: -94.6, lat: 46.4, tier: "L", value: 5.71 },
  { id: "SC", name: "South Carolina", lon: -80.9, lat: 33.9, tier: "M", value: 5.28 },
  { id: "AL", name: "Alabama", lon: -86.8, lat: 32.8, tier: "M", value: 5.07 },
  { id: "LA", name: "Louisiana", lon: -92.0, lat: 31.0, tier: "M", value: 4.62 },
  { id: "KY", name: "Kentucky", lon: -85.3, lat: 37.5, tier: "M", value: 4.51 },
  { id: "OR", name: "Oregon", lon: -120.5, lat: 44.0, tier: "L", value: 4.24 },
  { id: "OK", name: "Oklahoma", lon: -97.5, lat: 35.5, tier: "M", value: 4.02 },
  { id: "CT", name: "Connecticut", lon: -72.7, lat: 41.6, tier: "S", value: 3.63 },
  { id: "UT", name: "Utah", lon: -111.7, lat: 39.3, tier: "L", value: 3.38 },
  { id: "IA", name: "Iowa", lon: -93.5, lat: 42.0, tier: "M", value: 3.19 },
  { id: "NV", name: "Nevada", lon: -117.0, lat: 39.5, tier: "L", value: 3.19 },
  { id: "AR", name: "Arkansas", lon: -92.4, lat: 34.9, tier: "M", value: 3.01 },
  { id: "MS", name: "Mississippi", lon: -89.6, lat: 32.7, tier: "M", value: 2.96 },
  { id: "KS", name: "Kansas", lon: -98.4, lat: 38.5, tier: "L", value: 2.94 },
  { id: "NM", name: "New Mexico", lon: -106.0, lat: 34.5, tier: "L", value: 2.11 },
  { id: "NE", name: "Nebraska", lon: -99.8, lat: 41.5, tier: "L", value: 1.96 },
  { id: "ID", name: "Idaho", lon: -114.6, lat: 44.4, tier: "L", value: 1.94 },
  { id: "WV", name: "West Virginia", lon: -80.6, lat: 38.9, tier: "M", value: 1.79 },
  { id: "NH", name: "New Hampshire", lon: -71.6, lat: 43.7, tier: "S", value: 1.39 },
  { id: "ME", name: "Maine", lon: -69.0, lat: 45.3, tier: "M", value: 1.36 },
  { id: "RI", name: "Rhode Island", lon: -71.5, lat: 41.7, tier: "S", value: 1.1 },
  { id: "MT", name: "Montana", lon: -109.6, lat: 47.0, tier: "L", value: 1.1 },
  { id: "DE", name: "Delaware", lon: -75.5, lat: 39.0, tier: "S", value: 1.02 },
  { id: "SD", name: "South Dakota", lon: -100.2, lat: 44.4, tier: "L", value: 0.89 },
  { id: "ND", name: "North Dakota", lon: -100.5, lat: 47.5, tier: "L", value: 0.78 },
  { id: "VT", name: "Vermont", lon: -72.7, lat: 44.0, tier: "S", value: 0.65 },
  { id: "WY", name: "Wyoming", lon: -107.5, lat: 43.0, tier: "L", value: 0.58 },
  // Inset (not their real remote coordinates) — no `value`, so `noDataFill` applies.
  { id: "AK", name: "Alaska", lon: -114, lat: 27, tier: "L" },
  { id: "HI", name: "Hawaii", lon: -101, lat: 24, tier: "S" },
];

function squareStateFeature(seed: StateSeed): ChoroplethFeature {
  const half = TIER_HALF_WIDTH[seed.tier];
  const { lon, lat } = seed;
  return {
    type: "Feature",
    id: seed.id,
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [lon - half, lat - half],
          [lon + half, lat - half],
          [lon + half, lat + half],
          [lon - half, lat + half],
          [lon - half, lat - half],
        ],
      ],
    },
    properties: { id: seed.id, name: seed.name, value: seed.value },
  };
}

const usStatesData: FeatureCollection<Geometry, ChoroplethFeatureProperties> = {
  type: "FeatureCollection",
  features: US_STATE_SEEDS.map(squareStateFeature),
};

function getStateValue(f: { properties: ChoroplethFeatureProperties }): number | undefined {
  return typeof f.properties.value === "number" ? f.properties.value : undefined;
}

/**
 * `noDataFill="hatch"` + `labelTop={5}` (M1/M2) — Alaska and Hawaii carry no
 * `value` and render with a diagonal `--chart-grid` hatch instead of a flat
 * palette fill; the five largest states by population (California, Texas,
 * Florida, New York, Pennsylvania) get an inline halo'd name label at their
 * centroid.
 */
export const NoDataHatchAndTopLabels: Story = {
  name: "No-data hatch + top-5 labels (M1/M2)",
  render: () => (
    <div className="h-80 w-[640px]">
      <ChoroplethChart
        data={usStatesData}
        aspectRatio="16 / 9"
        center={[-98, 39]}
        scale={700}
        accessibleLabel="US state population choropleth map"
        accessibleDescription="48 states plus Alaska and Hawaii, which have no data and render hatched. The five largest states by population — California, Texas, Florida, New York, Pennsylvania — are labeled inline."
      >
        <ChoroplethFeatureComponent noDataFill="hatch" labelTop={5} />
        <ChoroplethTooltip getFeatureValue={getStateValue} valueLabel="Population (M)" />
      </ChoroplethChart>
    </div>
  ),
};

/** `noDataFill="muted"` — the flat `var(--muted)` alternative to the hatch pattern. */
export const NoDataMuted: Story = {
  render: () => (
    <div className="h-80 w-[640px]">
      <ChoroplethChart data={usStatesData} aspectRatio="16 / 9" center={[-98, 39]} scale={700}>
        <ChoroplethFeatureComponent noDataFill="muted" />
        <ChoroplethTooltip getFeatureValue={getStateValue} valueLabel="Population (M)" />
      </ChoroplethChart>
    </div>
  ),
};
