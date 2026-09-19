import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor } from "storybook/test";
import { feature } from "topojson-client";
import type { Topology } from "topojson-specification";
import type { FeatureCollection, Geometry, MultiPolygon } from "geojson";
import { ChoroplethChart } from "./choropleth-chart";
import { ChoroplethFeature as ChoroplethFeatureComponent } from "./choropleth-feature";
import { ChoroplethTooltip } from "./choropleth-tooltip";
import type { ChoroplethFeature, ChoroplethFeatureProperties } from "./choropleth-context";
import { usStatesData } from "./us-states-fixture";
import type { ChartAnnotation } from "../annotations";
import { worldFeatureCollection } from "./world-fixture";

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
// noDataFill + labelTop (RM-032) — a schematic US-states map. Fixture data
// (seeds + the clockwise-wound `squareStateFeature`, see #236) lives in
// `us-states-fixture.ts` so `choropleth-chart.test.tsx`'s winding-contract
// lock can import it as an ordinary module, without pulling this story file
// (excluded from `typecheck`) into the compiled graph.
// ---------------------------------------------------------------------------

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
      {/* scale/translate reframed so all 50 schematic states fit the
          640x360 plot with margin — #236 measured the collection's bounds
          at these parameters as [87.4, 46.6] -> [611.3, 356.6] inside this
          box (`center` is unchanged; only the zoom/offset needed to grow). */}
      <ChoroplethChart
        data={usStatesData}
        aspectRatio="16 / 9"
        center={[-98, 39]}
        scale={560}
        translate={[320, 180]}
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
      <ChoroplethChart
        data={usStatesData}
        aspectRatio="16 / 9"
        center={[-98, 39]}
        scale={560}
        translate={[320, 180]}
      >
        <ChoroplethFeatureComponent noDataFill="muted" />
        <ChoroplethTooltip getFeatureValue={getStateValue} valueLabel="Population (M)" />
      </ChoroplethChart>
    </div>
  ),
};

/** The series-pattern channel (ADR 0011) rendered: `bp-series-*` defs + marks filled from them. */
function expectSeriesPatterns(root: Element, markSelector: string, minPatterns: number) {
  expect(root.querySelectorAll('pattern[id^="bp-series-"]').length).toBeGreaterThanOrEqual(
    minPatterns,
  );
  const patterned = [...root.querySelectorAll(markSelector)].filter((mark) =>
    (mark.getAttribute("fill") ?? "").startsWith("url(#bp-series-"),
  );
  expect(patterned.length).toBeGreaterThan(0);
}

/**
 * High decoration (ADR 0011, #257) — each distinct palette fill gets its own
 * series pattern, so regions that differ by hue also differ by texture. The
 * no-data hatch stays its own, distinct texture.
 */
export const HighDecoration: Story = {
  tags: ["!dev"],
  name: "High decoration",
  globals: { decoration: "10" },
  render: () => (
    <div className="h-72 w-full max-w-[560px]" data-decoration="10">
      <ChoroplethChart data={worldData} aspectRatio="16 / 9">
        <ChoroplethFeatureComponent />
        <ChoroplethTooltip getFeatureValue={getFeatureValue} valueLabel="Score" />
      </ChoroplethChart>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(() => expectSeriesPatterns(canvasElement, ".choropleth-features path", 2));
  },
};
// ---------------------------------------------------------------------------
// Thematic layer — colour scale, legend, fit, symbols, zoom, overlays (RM-124)
// ---------------------------------------------------------------------------

/** The tier the chart measured for itself — plays branch on it, never on the viewport. */
function breakpointOf(root: HTMLElement): string {
  return root.querySelector("[data-chart-breakpoint]")?.getAttribute("data-chart-breakpoint") ?? "";
}

/** Illustrative cooling degree days per year, by ISO 3166 numeric id (a demo series, not a statistic). */
const COOLING_DEGREE_DAYS: Record<string, number> = {
  "196": 1110, // Cyprus
  "300": 640, // Greece
  "008": 420, // Albania
  "724": 410, // Spain
  "380": 380, // Italy
  "620": 300, // Portugal
  "807": 280, // North Macedonia
  "499": 255, // Montenegro
  "100": 240, // Bulgaria
  "191": 230, // Croatia
  "688": 215, // Serbia
  "642": 200, // Romania
  "348": 170, // Hungary
  "070": 150, // Bosnia and Herzegovina
  "250": 110, // France
  "705": 105, // Slovenia
  "703": 90, // Slovakia
  "040": 70, // Austria
  "756": 50, // Switzerland
  "203": 45, // Czechia
  "276": 40, // Germany
  "616": 38, // Poland
  "442": 25, // Luxembourg
  "440": 22, // Lithuania
  "056": 20, // Belgium
  "428": 12, // Latvia
  "528": 11, // Netherlands
  "233": 8, // Estonia
  "246": 6, // Finland
  "208": 5, // Denmark
  "752": 4, // Sweden
  "826": 3, // United Kingdom
  "578": 2, // Norway
  "372": 1, // Ireland
  "352": 0, // Iceland
};

/**
 * The world fixture with cooling values on Europe. France's overseas
 * polygons (French Guiana) are trimmed so `fitToData` frames the continent.
 */
const europeCooling: FeatureCollection<Geometry, ChoroplethFeatureProperties> = {
  type: "FeatureCollection",
  features: worldFeatureCollection().features.map((f) => {
    const value = COOLING_DEGREE_DAYS[f.properties.id];
    const geometry: MultiPolygon =
      f.properties.id === "250"
        ? {
            type: "MultiPolygon",
            coordinates: f.geometry.coordinates.filter(
              (polygon) => (polygon[0]?.[0]?.[0] ?? 0) > -30,
            ),
          }
        : f.geometry;
    return { ...f, geometry, properties: { ...f.properties, value } };
  }),
};

/** Six notes, pinned by longitude / latitude. */
const COOLING_NOTES: ChartAnnotation[] = [
  { kind: "text", x: 33.2, y: 35, text: "Cyprus cools the most" },
  { kind: "text", x: -3.7, y: 40.2, text: "Spain" },
  { kind: "text", x: 12.5, y: 42.8, text: "Italy" },
  { kind: "text", x: 22, y: 39.3, text: "Greece" },
  { kind: "text", x: 16, y: 63, text: "The north barely cools" },
  { kind: "text", x: 10.4, y: 51.2, text: "Germany" },
];

/**
 * Datawrapper's “Europe cooling” recipe: an 11-class quantile scale, a titled
 * ramp with words instead of numbers, and six notes. At the narrow tier the
 * legend moves below the map, the notes become a numbered key, and the map
 * keeps its 16:9 aspect.
 */
export const EuropeCooling: Story = {
  name: "Stepped quantile scale with titled legend and notes",
  parameters: { layout: "padded" },
  render: () => (
    <div className="w-full max-w-[900px]">
      <ChoroplethChart
        accessibleLabel="Cooling degree days across Europe"
        annotations={COOLING_NOTES}
        data={europeCooling}
        fitToData
        legend={{
          title: "Cooling degree days",
          labels: "custom",
          custom: ["Less", "Cooling needed →"],
        }}
        scale={{ type: "stepped", method: "quantile", steps: 11 }}
      >
        <ChoroplethFeatureComponent noDataFill="muted" />
        <ChoroplethTooltip getFeatureValue={getFeatureValue} valueLabel="Cooling degree days" />
      </ChoroplethChart>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(breakpointOf(canvasElement)).not.toBe(""));
    const legend = canvasElement.querySelector('[data-slot="choropleth-legend"]');
    await expect(legend).not.toBeNull();
    await expect(canvasElement.querySelectorAll('[data-slot="ramp-legend-step"]')).toHaveLength(11);
    await expect(legend).toHaveTextContent("Cooling needed →");
    if (breakpointOf(canvasElement) === "narrow") {
      await expect(legend?.getAttribute("data-legend-position")).toBe("below");
      await expect(
        canvasElement.querySelectorAll('[data-slot="annotation-key-item"]'),
      ).toHaveLength(6);
    } else {
      await expect(legend?.getAttribute("data-legend-position")).toBe("bottom-left");
      await waitFor(() =>
        expect(canvasElement.querySelectorAll('[data-slot="chart-annotations-text"]')).toHaveLength(
          6,
        ),
      );
    }
    // The map keeps its 16:9 aspect at every tier.
    const plot = canvasElement.querySelector<HTMLElement>('[data-slot="choropleth-plot"]');
    const box = plot?.getBoundingClientRect();
    await expect(box && Math.abs(box.width / box.height - 16 / 9)).toBeLessThan(0.05);
  },
};

/** The US-states fixture with a value on its first 12 valued states only. */
const twelveStates: FeatureCollection<Geometry, ChoroplethFeatureProperties> = (() => {
  let given = 0;
  return {
    type: "FeatureCollection",
    features: usStatesData.features.map((f) => {
      const keep = typeof f.properties.value === "number" && given < 12;
      if (keep) given += 1;
      return {
        ...f,
        properties: {
          ...f.properties,
          value: keep ? f.properties.value : undefined,
        },
      };
    }),
  };
})();

/**
 * `fitToData` frames the 12 states that carry data and `hideNoData` removes
 * the rest from the DOM, so the map is about the data, not the country.
 */
export const FitToDataHideNoData: Story = {
  name: "Fit to data, regions without data hidden",
  parameters: { layout: "padded" },
  render: () => (
    <div className="w-full max-w-[640px]">
      <ChoroplethChart
        accessibleLabel="Population of 12 states"
        data={twelveStates}
        fitToData
        hideNoData
        legend={{ title: "Population (M)" }}
        scale={{ type: "continuous" }}
      >
        <ChoroplethFeatureComponent />
        <ChoroplethTooltip getFeatureValue={getStateValue} valueLabel="Population (M)" />
      </ChoroplethChart>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(() =>
      expect(canvasElement.querySelectorAll(".choropleth-features path")).toHaveLength(12),
    );
  },
};

/**
 * Proportional symbols at region centroids: the AREA encodes the value, so a
 * 4× value draws a 2× radius. On a plot narrower than 700 px every symbol
 * shrinks by `sqrt(width / 700)`.
 */
export const ProportionalSymbols: Story = {
  name: "Proportional symbols with a size key",
  parameters: { layout: "padded" },
  render: () => (
    <div className="w-full max-w-[900px]">
      <ChoroplethChart
        accessibleLabel="Market scores as proportional symbols"
        data={worldData}
        legend={{ title: "Score" }}
        symbols={{ sizeKey: "value" }}
      >
        <ChoroplethFeatureComponent fill="var(--muted)" />
      </ChoroplethChart>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(() =>
      expect(canvasElement.querySelectorAll('[data-slot="choropleth-symbol"]')).toHaveLength(12),
    );
    const symbols = [...canvasElement.querySelectorAll('[data-slot="choropleth-symbol"]')].map(
      (g) => ({
        radius: Number(g.getAttribute("data-radius")),
        value: Number(g.getAttribute("data-value")),
      }),
    );
    const [largest, smallest] = [symbols[0]!, symbols[symbols.length - 1]!];
    // Radius ratio = sqrt(value ratio), to the 0.01 px the attribute keeps.
    await expect(largest.radius / smallest.radius).toBeCloseTo(
      Math.sqrt(largest.value / smallest.value),
      1,
    );
    if (breakpointOf(canvasElement) === "wide") {
      await expect(largest.radius).toBeCloseTo(20, 1);
    } else {
      await expect(largest.radius).toBeLessThan(20);
    }
    await expect(canvasElement.querySelector('[data-slot="size-legend"]')).not.toBeNull();
  },
};

/**
 * Zoom buttons: real `<button>`s outside the map's `<svg>`, so every zoom the
 * wheel or a drag can do is reachable from the keyboard. Reset returns to the
 * fitted view.
 */
export const ZoomButtons: Story = {
  name: "Zoom buttons with keyboard reset",
  parameters: { layout: "padded" },
  render: () => (
    <div className="w-full max-w-[900px]">
      <ChoroplethChart
        accessibleLabel="Cooling degree days across Europe, zoomable"
        data={europeCooling}
        fitToData
        scale={{ type: "continuous" }}
        zoomControls
      >
        <ChoroplethFeatureComponent noDataFill="muted" />
      </ChoroplethChart>
    </div>
  ),
  play: async ({ canvasElement, canvas }) => {
    const transform = () =>
      canvasElement
        .querySelector(".choropleth-features")
        ?.closest("g[transform]")
        ?.getAttribute("transform");
    await waitFor(() => expect(transform()).toBeTruthy());
    const fitted = transform();
    const zoomIn = canvas.getByRole("button", { name: "Zoom in" });
    zoomIn.focus();
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(transform()).not.toBe(fitted));
    canvas.getByRole("button", { name: "Zoom out" }).focus();
    await userEvent.keyboard(" ");
    canvas.getByRole("button", { name: "Reset zoom" }).focus();
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(transform()).toBe(fitted));
  },
};

/**
 * A locator inset (the visible extent on a globe) and region names laid out
 * by the label solver — at most 30, colliding ones dropped, none at narrow
 * (the dropped names stay in the text for assistive technology).
 */
export const InsetAndPlaceLabels: Story = {
  name: "Locator inset and place labels",
  parameters: { layout: "padded" },
  render: () => (
    <div className="w-full max-w-[900px]">
      <ChoroplethChart
        accessibleLabel="Cooling degree days across Europe with a locator globe"
        data={europeCooling}
        fitToData
        inset={{ kind: "globe", position: "top-left" }}
        labels={{ max: 12 }}
        legend={{ title: "Cooling degree days", position: "bottom-right" }}
        scale={{ type: "stepped", method: "jenks", steps: 5 }}
      >
        <ChoroplethFeatureComponent noDataFill="muted" />
      </ChoroplethChart>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(breakpointOf(canvasElement)).not.toBe(""));
    const painted = () =>
      Number(
        canvasElement
          .querySelector('[data-slot="choropleth-place-labels"]')
          ?.getAttribute("data-painted-count") ?? 0,
      );
    if (breakpointOf(canvasElement) === "narrow") {
      await expect(painted()).toBe(0);
    } else {
      await waitFor(() => expect(painted()).toBeGreaterThan(0));
      await expect(painted()).toBeLessThanOrEqual(12);
    }
    await expect(canvasElement.querySelector('[data-slot="choropleth-inset"]')).not.toBeNull();
  },
};

/** Two regions per class plus a hatched overlay for estimated values. */
const regionsWithFlags: FeatureCollection<Geometry, ChoroplethFeatureProperties> = {
  type: "FeatureCollection",
  features: usStatesData.features.map((f, index) => ({
    ...f,
    properties: {
      ...f.properties,
      region: index % 3 === 0 ? "East" : index % 3 === 1 ? "Central" : "West",
      estimated: index % 4 === 0 ? "Estimated" : "",
    },
  })),
};

/**
 * `palette: "categorical"` colours by a text field and keys it with swatches;
 * `overlayBy` stripes the regions whose `estimated` field is set, so the
 * flag reads in greyscale too.
 */
export const CategoriesWithPatternOverlay: Story = {
  name: "Categories with a pattern overlay",
  parameters: { layout: "padded" },
  render: () => (
    <div className="w-full max-w-[640px]">
      <ChoroplethChart
        accessibleLabel="States by region; estimated values striped"
        data={regionsWithFlags}
        fitToData
        legend={{ title: "Region" }}
        overlayBy={{ key: "estimated", pattern: "stripes", direction: "up" }}
        scale={{ type: "stepped", palette: "categorical", key: "region" }}
      >
        <ChoroplethFeatureComponent />
      </ChoroplethChart>
    </div>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(() =>
      expect(
        canvasElement.querySelectorAll('[data-slot="choropleth-overlay"] path').length,
      ).toBeGreaterThan(0),
    );
    await expect(
      canvasElement.querySelector('[data-slot="choropleth-legend-overlay"]'),
    ).toHaveTextContent("Estimated");
  },
};

const statesWithoutData: FeatureCollection<Geometry, ChoroplethFeatureProperties> = {
  type: "FeatureCollection",
  features: usStatesData.features.map((f) => ({
    ...f,
    properties: { ...f.properties, value: undefined },
  })),
};

/** No region carries data and `hideNoData` is on: an empty state, never a blank frame. */
export const Empty: Story = {
  parameters: { layout: "padded" },
  render: () => (
    <div className="w-full max-w-[640px]">
      <ChoroplethChart data={statesWithoutData} hideNoData scale={{ type: "continuous" }}>
        <ChoroplethFeatureComponent />
      </ChoroplethChart>
    </div>
  ),
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole("status")).toHaveTextContent("No data");
  },
};
