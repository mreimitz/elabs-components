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
