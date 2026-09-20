/**
 * ChoroplethChart smoke test.
 *
 * The chart uses @visx/responsive ParentSize (ResizeObserver) and @visx/geo
 * Mercator (SVG measurement) — both unavailable in jsdom.  We mock
 * ParentSize to supply a fixed size so the inner rendering path runs, and
 * stub out the motion/react animation hooks so no timers bleed.
 *
 * Full render + a11y is covered by the Storybook story tests
 * (pnpm --filter @elabs-ai/components-docs test-storybook), following the
 * @elabs-ai/components-editor / @elabs-ai/components-flow precedent.
 */

import { geoArea, geoCentroid } from "d3-geo";
import { afterEach, describe, expect, it, vi } from "vitest";
import { squareStateFeature, US_STATE_SEEDS } from "./us-states-fixture";

// ---------------------------------------------------------------------------
// Mock @visx/responsive so ParentSize calls its child with a concrete size
// ---------------------------------------------------------------------------
vi.mock("@visx/responsive", () => ({
  ParentSize: ({
    children,
  }: {
    children: (size: { width: number; height: number }) => React.ReactNode;
    debounceTime?: number;
  }) => <>{children({ width: 560, height: 315 })}</>,
}));

// ---------------------------------------------------------------------------
// Stub SVG geometry APIs jsdom doesn't implement
// ---------------------------------------------------------------------------
if (typeof globalThis.SVGElement !== "undefined") {
  Object.defineProperty(SVGElement.prototype, "getBBox", {
    configurable: true,
    value: () => ({ x: 0, y: 0, width: 0, height: 0 }),
  });
}

// ---------------------------------------------------------------------------
// Provide a minimal ResizeObserver shim
// ---------------------------------------------------------------------------
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// ---------------------------------------------------------------------------
// Imports (after mocks are registered)
// ---------------------------------------------------------------------------
import { fireEvent, render } from "@testing-library/react";
import { ChoroplethChart, resolveLegendPlacement } from "./choropleth-chart";
import { ChoroplethFeature as ChoroplethFeatureComponent } from "./choropleth-feature";
import { seriesPatternFills, seriesPatterns, stubHighDecoration } from "../high-decoration-fixture";
import type { FeatureCollection, Geometry } from "geojson";
import type { ChoroplethFeatureProperties } from "./choropleth-context";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { screen } from "@testing-library/react";
import { geoMercator } from "d3-geo";
import { areaRadius } from "../../marks/area-radius";
import { ChartConfigProvider } from "../chart-config-context";
import { overlayCategories } from "./choropleth-feature";
import { fitProjectionToFeatures } from "./fit-to-data";
import { layoutPlaceLabels, MAX_PLACE_LABELS } from "./place-labels";
import { layoutSymbols, symbolShrink } from "./symbol-layer";
import { worldFeatureCollection } from "./world-fixture";

// Minimal valid GeoJSON — a single polygon country
const minimalData: FeatureCollection<Geometry, ChoroplethFeatureProperties> = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      id: "840",
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-100, 40],
            [-90, 40],
            [-90, 50],
            [-100, 50],
            [-100, 40],
          ],
        ],
      },
      properties: { id: "840", name: "United States", value: 120 },
    },
  ],
};

describe("ChoroplethChart data-shape guard (#288)", () => {
  it.each([
    ["a bare feature array", minimalData.features],
    ["an object without features", { type: "FeatureCollection" }],
    ["undefined", undefined],
  ])("renders without throwing and warns once for %s", (_label, bad) => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      expect(() =>
        render(
          <ChoroplethChart aspectRatio="16 / 9" data={bad as never}>
            <ChoroplethFeatureComponent />
          </ChoroplethChart>,
        ),
      ).not.toThrow();
      const messages = warn.mock.calls.map((call) => String(call[0]));
      expect(messages.filter((m) => m.startsWith("ChoroplethChart: `data`"))).toHaveLength(1);
    } finally {
      warn.mockRestore();
    }
  });

  it("still draws the happy path, so the guard cannot pass by refusing everything", () => {
    const { container } = render(
      <ChoroplethChart aspectRatio="16 / 9" data={minimalData}>
        <ChoroplethFeatureComponent />
      </ChoroplethChart>,
    );
    expect(container.querySelector("svg")).not.toBeNull();
  });
});

describe("ChoroplethChart", () => {
  it("is exported as a function / forwardRef object", () => {
    // Guards the named export exists and is callable by React
    expect(typeof ChoroplethChart).toBe("object"); // forwardRef returns an object
    expect(ChoroplethChart.displayName).toBe("ChoroplethChart");
  });

  it("mounts and renders a container div", () => {
    const { container } = render(
      <ChoroplethChart data={minimalData} aspectRatio="16 / 9">
        <ChoroplethFeatureComponent />
      </ChoroplethChart>,
    );
    // The outermost element is a div (the forwarded-ref container)
    expect(container.firstChild).toBeInstanceOf(HTMLDivElement);
  });

  it("forwards a ref to the outer container div", () => {
    const ref = { current: null as HTMLDivElement | null };
    render(
      <ChoroplethChart ref={ref} data={minimalData} aspectRatio="16 / 9">
        <ChoroplethFeatureComponent />
      </ChoroplethChart>,
    );
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });

  it("merges className onto the container", () => {
    const { container } = render(
      <ChoroplethChart data={minimalData} aspectRatio="16 / 9" className="my-custom-class">
        <ChoroplethFeatureComponent />
      </ChoroplethChart>,
    );
    expect(container.firstChild).toHaveClass("my-custom-class");
  });

  it("adds role/aria-label/tabIndex when accessibleLabel is provided", () => {
    const { container } = render(
      <ChoroplethChart
        data={minimalData}
        aspectRatio="16 / 9"
        accessibleLabel="World market scores choropleth map"
        accessibleDescription="12 annotated countries. Score range: 108 to 412."
      >
        <ChoroplethFeatureComponent />
      </ChoroplethChart>,
    );
    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute("role")).toBe("figure");
    expect(root.getAttribute("aria-label")).toBe("World market scores choropleth map");
    expect(root.getAttribute("tabindex")).toBe("0");
    expect(root.getAttribute("aria-describedby")).toBeTruthy();
    // a-12: the figure is the chart's FIRST focus stop, ahead of the zoom
    // buttons — it drew Chrome's default ring ("1px auto rgb(0, 95, 204)")
    // while they drew the house one. Same indicator now.
    expect(root).toHaveClass("focus-ring");
  });

  it("does NOT add role/aria-label when accessibleLabel is absent", () => {
    const { container } = render(
      <ChoroplethChart data={minimalData} aspectRatio="16 / 9">
        <ChoroplethFeatureComponent />
      </ChoroplethChart>,
    );
    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute("role")).toBeNull();
    expect(root.getAttribute("aria-label")).toBeNull();
    expect(root.getAttribute("tabindex")).toBeNull();
    // A chart that is not focusable never paints a focus ring.
    expect(root).not.toHaveClass("focus-ring");
  });

  it("renders a keyboard-nav listbox when keyboardNav prop is provided", () => {
    const { getByRole } = render(
      <ChoroplethChart
        data={minimalData}
        aspectRatio="16 / 9"
        keyboardNav={{
          navLabel: "Map regions",
          getFeatureName: (f) => String(f.properties?.name ?? "Unknown"),
          getFeatureValue: (f) =>
            typeof f.properties?.value === "number" ? f.properties.value : undefined,
          valueLabel: "Score",
        }}
      >
        <ChoroplethFeatureComponent />
      </ChoroplethChart>,
    );
    // The listbox with navLabel should be present
    const listbox = getByRole("listbox", { name: "Map regions" });
    expect(listbox).toBeInTheDocument();
  });

  it("keyboard nav listbox contains one option per feature with accessible name", () => {
    const { getAllByRole } = render(
      <ChoroplethChart
        data={minimalData}
        aspectRatio="16 / 9"
        keyboardNav={{
          getFeatureName: (f) => String(f.properties?.name ?? "Unknown"),
          getFeatureValue: (f) =>
            typeof f.properties?.value === "number" ? f.properties.value : undefined,
          valueLabel: "Score",
        }}
      >
        <ChoroplethFeatureComponent />
      </ChoroplethChart>,
    );
    const options = getAllByRole("option");
    // minimalData has exactly 1 feature
    expect(options).toHaveLength(1);
    expect(options[0]?.getAttribute("aria-label")).toContain("United States");
    expect(options[0]?.getAttribute("aria-label")).toContain("120");
  });

  it("first keyboard nav option has tabIndex=0 (entry point for Tab)", () => {
    const { getAllByRole } = render(
      <ChoroplethChart
        data={minimalData}
        aspectRatio="16 / 9"
        keyboardNav={{ getFeatureName: (f) => String(f.properties?.name ?? "Unknown") }}
      >
        <ChoroplethFeatureComponent />
      </ChoroplethChart>,
    );
    const options = getAllByRole("option");
    expect(options[0]?.getAttribute("tabindex")).toBe("0");
  });

  it("ArrowDown key moves focus to the next feature (wraps at end)", () => {
    // Use a two-feature dataset to test wrap-around
    const twoFeatureData: FeatureCollection<Geometry, ChoroplethFeatureProperties> = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          id: "840",
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [-100, 40],
                [-90, 40],
                [-90, 50],
                [-100, 50],
                [-100, 40],
              ],
            ],
          },
          properties: { id: "840", name: "Country A", value: 100 },
        },
        {
          type: "Feature",
          id: "124",
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [-80, 40],
                [-70, 40],
                [-70, 50],
                [-80, 50],
                [-80, 40],
              ],
            ],
          },
          properties: { id: "124", name: "Country B", value: 200 },
        },
      ],
    };

    const { getAllByRole, getByRole } = render(
      <ChoroplethChart
        data={twoFeatureData}
        aspectRatio="16 / 9"
        keyboardNav={{ getFeatureName: (f) => String(f.properties?.name ?? "Unknown") }}
      >
        <ChoroplethFeatureComponent />
      </ChoroplethChart>,
    );

    const listbox = getByRole("listbox");
    const options = getAllByRole("option");
    expect(options).toHaveLength(2);

    // Fire ArrowDown on the listbox — should move focus to item 1
    fireEvent.keyDown(listbox, { key: "ArrowDown" });
    // After ArrowDown from index 0, item 1 should have tabIndex=0
    // (roving tabindex updates on focus, which jsdom handles synchronously via fireEvent)
    // The focused index state update is tested via aria-selected on the activated item.
    // Note: jsdom doesn't invoke focus() imperatively called inside handlers,
    // so we verify the state-driven aria-selected attribute instead.
    expect(options[1]?.getAttribute("aria-selected")).toBe("true");
  });
});

// ---------------------------------------------------------------------------
// noDataFill (RM-032) — one feature carries `value`, one does not.
// ---------------------------------------------------------------------------
const twoFeaturesOneNoData: FeatureCollection<Geometry, ChoroplethFeatureProperties> = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      id: "A",
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-100, 40],
            [-90, 40],
            [-90, 50],
            [-100, 50],
            [-100, 40],
          ],
        ],
      },
      properties: { id: "A", name: "Has Data", value: 100 },
    },
    {
      type: "Feature",
      id: "B",
      // No `value` — this is the no-data region.
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-80, 40],
            [-70, 40],
            [-70, 50],
            [-80, 50],
            [-80, 40],
          ],
        ],
      },
      properties: { id: "B", name: "No Data" },
    },
  ],
};

describe("ChoroplethFeature noDataFill (RM-032)", () => {
  it('"hatch" gives the no-data feature a pattern fill and defines the pattern', () => {
    const { container } = render(
      <ChoroplethChart data={twoFeaturesOneNoData} aspectRatio="16 / 9">
        <ChoroplethFeatureComponent noDataFill="hatch" />
      </ChoroplethChart>,
    );
    expect(container.querySelector('pattern[id^="choropleth-no-data-hatch-"]')).toBeInTheDocument();
    const paths = container.querySelectorAll(".choropleth-features path");
    const noDataPath = Array.from(paths).find((p) =>
      (p.getAttribute("fill") ?? "").startsWith("url(#choropleth-no-data-hatch-"),
    );
    expect(noDataPath).toBeTruthy();
    // The has-data feature keeps an ordinary (non-hatch) fill.
    const hasDataPaths = Array.from(paths).filter(
      (p) => !(p.getAttribute("fill") ?? "").startsWith("url(#choropleth-no-data-hatch-"),
    );
    expect(hasDataPaths.length).toBeGreaterThan(0);
  });

  it('"muted" gives the no-data feature a flat var(--muted) fill', () => {
    const { container } = render(
      <ChoroplethChart data={twoFeaturesOneNoData} aspectRatio="16 / 9">
        <ChoroplethFeatureComponent noDataFill="muted" />
      </ChoroplethChart>,
    );
    const paths = container.querySelectorAll(".choropleth-features path");
    const mutedPath = Array.from(paths).find((p) => p.getAttribute("fill") === "var(--muted)");
    expect(mutedPath).toBeTruthy();
  });

  it("leaves fills unaffected when noDataFill is unset (default)", () => {
    const { container } = render(
      <ChoroplethChart data={twoFeaturesOneNoData} aspectRatio="16 / 9">
        <ChoroplethFeatureComponent />
      </ChoroplethChart>,
    );
    const paths = container.querySelectorAll(".choropleth-features path");
    for (const p of paths) {
      const fill = p.getAttribute("fill") ?? "";
      expect(fill).not.toBe("var(--muted)");
      expect(fill.startsWith("url(#choropleth-no-data-hatch-")).toBe(false);
    }
    expect(container.querySelector('pattern[id^="choropleth-no-data-hatch-"]')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// labelTop (RM-032) — top-N regions by value, inline halo'd name label.
// ---------------------------------------------------------------------------
const threeFeaturesRankedByValue: FeatureCollection<Geometry, ChoroplethFeatureProperties> = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      id: "A",
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-100, 40],
            [-90, 40],
            [-90, 50],
            [-100, 50],
            [-100, 40],
          ],
        ],
      },
      properties: { id: "A", name: "Has Data", value: 100 },
    },
    {
      type: "Feature",
      id: "B",
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-80, 40],
            [-70, 40],
            [-70, 50],
            [-80, 50],
            [-80, 40],
          ],
        ],
      },
      properties: { id: "B", name: "No Data" },
    },
    {
      type: "Feature",
      id: "C",
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-60, 40],
            [-50, 40],
            [-50, 50],
            [-60, 50],
            [-60, 40],
          ],
        ],
      },
      properties: { id: "C", name: "Lower", value: 50 },
    },
  ],
};

describe("ChoroplethFeature labelTop (RM-032)", () => {
  it("renders no labels when labelTop is unset (default, unaffected)", () => {
    const { container } = render(
      <ChoroplethChart data={threeFeaturesRankedByValue} aspectRatio="16 / 9">
        <ChoroplethFeatureComponent />
      </ChoroplethChart>,
    );
    expect(container.querySelectorAll('[data-slot="halo-text"]')).toHaveLength(0);
  });

  it("labelTop=1 labels only the single highest-value region", () => {
    const { container } = render(
      <ChoroplethChart data={threeFeaturesRankedByValue} aspectRatio="16 / 9">
        <ChoroplethFeatureComponent labelTop={1} />
      </ChoroplethChart>,
    );
    const labels = container.querySelectorAll('[data-slot="halo-text"]');
    expect(labels).toHaveLength(1);
    expect(labels[0]?.textContent).toBe("Has Data");
  });

  it("labelTop=2 labels the two highest-value regions, excluding the no-data one", () => {
    const { container } = render(
      <ChoroplethChart data={threeFeaturesRankedByValue} aspectRatio="16 / 9">
        <ChoroplethFeatureComponent labelTop={2} />
      </ChoroplethChart>,
    );
    const labels = container.querySelectorAll('[data-slot="halo-text"]');
    expect(labels).toHaveLength(2);
    expect(new Set(Array.from(labels).map((el) => el.textContent))).toEqual(
      new Set(["Has Data", "Lower"]),
    );
  });

  it("labelTop bigger than the number of valued regions labels every valued region, never the no-data one", () => {
    const { container } = render(
      <ChoroplethChart data={threeFeaturesRankedByValue} aspectRatio="16 / 9">
        <ChoroplethFeatureComponent labelTop={10} />
      </ChoroplethChart>,
    );
    const labels = container.querySelectorAll('[data-slot="halo-text"]');
    expect(labels).toHaveLength(2);
    for (const label of labels) {
      expect(label.textContent).not.toBe("No Data");
    }
  });
});

// ---------------------------------------------------------------------------
// #236 — `squareStateFeature`'s ring winding. Pure, fast, no browser and no
// projection: `geoCentroid`/`geoArea` read a polygon SPHERICALLY, so a
// counter-clockwise exterior ring (RFC 7946 order) is read as the sphere
// MINUS the square — `geoCentroid` returns the ring's antipode and `geoArea`
// returns close to a full sphere (~4*pi). This is the exact assertion that
// would have caught the bug the existing `fill`/`<text>`-count jsdom suite
// above could not: it never looks at geometry.
// ---------------------------------------------------------------------------
describe("squareStateFeature winding (#236)", () => {
  it("every seed's centroid recovers its own [lon, lat] — never the antipode", () => {
    // A correctly-wound square's spherical centroid sits within a fraction of
    // a degree of its authored center (curvature grows with square size and
    // latitude — measured up to ~0.003° for this fixture's largest tier at
    // its highest latitude). An inverted ring returns the ANTIPODE — off by
    // roughly 180°, nowhere near this bound.
    for (const seed of US_STATE_SEEDS) {
      const [lon, lat] = geoCentroid(squareStateFeature(seed));
      expect(Math.abs(lon - seed.lon)).toBeLessThan(0.01);
      expect(Math.abs(lat - seed.lat)).toBeLessThan(0.01);
    }
  });

  it("every seed's spherical area is a small square, never ~4*pi (the antipodal complement)", () => {
    for (const seed of US_STATE_SEEDS) {
      expect(geoArea(squareStateFeature(seed))).toBeLessThan(0.01);
    }
  });
});

describe("ChoroplethFeature decoration pattern channel (ADR 0011, #257)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("gives each distinct palette fill its own series pattern at high decoration", () => {
    stubHighDecoration();
    const { container } = render(
      <ChoroplethChart data={twoFeaturesOneNoData} aspectRatio="16 / 9">
        <ChoroplethFeatureComponent />
      </ChoroplethChart>,
    );
    const ids = seriesPatterns(container).map((pattern) => pattern.id);
    // Two regions on the default palette → --chart-1 and --chart-2 → two patterns.
    expect(ids).toHaveLength(2);
    const fills = seriesPatternFills(container, ".choropleth-features path").map((p) =>
      p.getAttribute("fill"),
    );
    expect(new Set(fills)).toEqual(new Set(ids.map((id) => `url(#${id})`)));
  });

  it("leaves the no-data hatch and low decoration untouched", () => {
    const low = render(
      <ChoroplethChart data={twoFeaturesOneNoData} aspectRatio="16 / 9">
        <ChoroplethFeatureComponent />
      </ChoroplethChart>,
    );
    expect(seriesPatterns(low.container)).toHaveLength(0);
    low.unmount();

    stubHighDecoration();
    const { container } = render(
      <ChoroplethChart data={twoFeaturesOneNoData} aspectRatio="16 / 9">
        <ChoroplethFeatureComponent noDataFill="hatch" />
      </ChoroplethChart>,
    );
    const paths = Array.from(container.querySelectorAll(".choropleth-features path"));
    expect(
      paths.some((p) =>
        (p.getAttribute("fill") ?? "").startsWith("url(#choropleth-no-data-hatch-"),
      ),
    ).toBe(true);
    expect(seriesPatterns(container)).toHaveLength(1);
  });
});
// ---------------------------------------------------------------------------
// Thematic layer — RM-124
// ---------------------------------------------------------------------------

/** The US-states fixture with a value on exactly `n` states (the rest: no data). */
function statesWithData(n: number): FeatureCollection<Geometry, ChoroplethFeatureProperties> {
  let given = 0;
  return {
    type: "FeatureCollection",
    features: US_STATE_SEEDS.map((seed) => {
      const feature = squareStateFeature(seed);
      const keep = seed.value !== undefined && given < n;
      if (keep) given += 1;
      return {
        ...feature,
        properties: {
          ...feature.properties,
          value: keep ? seed.value : undefined,
        },
      };
    }),
  };
}

describe("ChoroplethChart fitToData / hideNoData", () => {
  const twelve = statesWithData(12);
  const withData = twelve.features.filter((f) => typeof f.properties.value === "number");

  it("the fixture has 12 data-bearing states and more without data", () => {
    expect(withData).toHaveLength(12);
    expect(twelve.features.length).toBeGreaterThan(12);
  });

  it("frames the 12 data-bearing states inside the padded plot, touching the padding", () => {
    const fitted = fitProjectionToFeatures(withData, 560, 315, [0, 20], 16);
    expect(fitted).not.toBeNull();
    const projection = geoMercator()
      .center([0, 20])
      .scale(fitted!.scale)
      .translate(fitted!.translate);
    const xs: number[] = [];
    const ys: number[] = [];
    for (const feature of withData) {
      const ring = (feature.geometry as unknown as { coordinates: [number, number][][] })
        .coordinates[0]!;
      for (const coords of ring) {
        const [x, y] = projection(coords)!;
        xs.push(x);
        ys.push(y);
      }
    }
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    expect(minX).toBeGreaterThanOrEqual(15.5);
    expect(maxX).toBeLessThanOrEqual(560 - 15.5);
    expect(minY).toBeGreaterThanOrEqual(15.5);
    expect(maxY).toBeLessThanOrEqual(315 - 15.5);
    // One axis is tight: the frame is as large as it can be.
    const tightX = Math.abs(minX - 16) < 1 && Math.abs(maxX - (560 - 16)) < 1;
    const tightY = Math.abs(minY - 16) < 1 && Math.abs(maxY - (315 - 16)) < 1;
    expect(tightX || tightY).toBe(true);
  });

  it("hideNoData removes every region without data from the DOM", () => {
    const { container, rerender } = render(
      <ChoroplethChart data={twelve} fitToData>
        <ChoroplethFeatureComponent />
      </ChoroplethChart>,
    );
    expect(container.querySelectorAll(".choropleth-features path").length).toBe(
      twelve.features.length,
    );
    rerender(
      <ChoroplethChart data={twelve} fitToData hideNoData>
        <ChoroplethFeatureComponent />
      </ChoroplethChart>,
    );
    expect(container.querySelectorAll(".choropleth-features path").length).toBe(12);
  });

  it("hideNoData with no data at all renders the empty state, not a blank frame", () => {
    render(
      <ChoroplethChart data={statesWithData(0)} hideNoData>
        <ChoroplethFeatureComponent />
      </ChoroplethChart>,
    );
    expect(screen.getByRole("status")).toHaveTextContent("No data");
  });
});

describe("ChoroplethChart colour scale + legend", () => {
  it("fills regions from the scale with token refs only, no-data regions muted", () => {
    const data = statesWithData(12);
    const { container } = render(
      <ChoroplethChart data={data} scale={{ type: "stepped", method: "quantile", steps: 4 }}>
        <ChoroplethFeatureComponent />
      </ChoroplethChart>,
    );
    const fills = [...container.querySelectorAll(".choropleth-features path")].map((p) =>
      p.getAttribute("fill"),
    );
    expect(fills.filter((f) => f === "var(--muted)")).toHaveLength(data.features.length - 12);
    for (const fill of fills.filter((f) => f !== "var(--muted)")) {
      expect(fill).toMatch(/^var\(--chart-seq-[1-7]\)$/);
    }
  });

  it("drops an in-plot key below the map on any plot narrower than the wide tier", () => {
    // The plate is 256px wide: a corner ornament on a wide map, a panel parked
    // on the data on anything smaller.
    expect(resolveLegendPlacement("bottom-right", "wide")).toBe("bottom-right");
    expect(resolveLegendPlacement("bottom-right", "medium")).toBe("below");
    expect(resolveLegendPlacement("bottom-right", "narrow")).toBe("below");
    expect(resolveLegendPlacement("top-left", "medium")).toBe("below");
    // The explicit out-of-plot placements pass through at every tier.
    expect(resolveLegendPlacement("below", "wide")).toBe("below");
    expect(resolveLegendPlacement("above", "narrow")).toBe("above");
  });

  it("draws the RampLegend over the map at wide and below it at narrow", () => {
    const legend = {
      title: "Cooling degree days",
      labels: "custom" as const,
      custom: ["Cooling needed →"],
    };
    const view = (breakpoint: "wide" | "narrow") => (
      <ChartConfigProvider value={{ breakpoint }}>
        <ChoroplethChart
          data={statesWithData(12)}
          legend={legend}
          // Asks for more classes than the ramp can tell apart: the scale
          // clamps, so the key never shows two swatches painted the same.
          scale={{ type: "stepped", method: "quantile", steps: 11 }}
        >
          <ChoroplethFeatureComponent />
        </ChoroplethChart>
      </ChartConfigProvider>
    );
    const { container, rerender } = render(view("wide"));
    const wide = container.querySelector('[data-slot="choropleth-legend"]')!;
    expect(wide.getAttribute("data-legend-position")).toBe("bottom-left");
    expect(wide.closest('[data-slot="choropleth-plot"]')).not.toBeNull();
    expect(container.querySelectorAll('[data-slot="ramp-legend-step"]')).toHaveLength(7);
    expect(wide).toHaveTextContent("Cooling needed →");
    expect(wide).toHaveTextContent("Cooling degree days");
    rerender(view("narrow"));
    const narrow = container.querySelector('[data-slot="choropleth-legend"]')!;
    expect(narrow.getAttribute("data-legend-position")).toBe("below");
    expect(narrow.closest('[data-slot="choropleth-plot"]')).toBeNull();
  });

  it("an implicit legend hides at narrow", () => {
    const { container } = render(
      <ChartConfigProvider value={{ breakpoint: "narrow" }}>
        <ChoroplethChart data={statesWithData(12)} scale={{ type: "continuous" }}>
          <ChoroplethFeatureComponent />
        </ChoroplethChart>
      </ChartConfigProvider>,
    );
    expect(container.querySelector('[data-slot="choropleth-legend"]')).toBeNull();
  });

  it("moves the ramp marker to the hovered region", () => {
    const { container } = render(
      <ChoroplethChart
        data={statesWithData(12)}
        legend
        scale={{ type: "stepped", method: "quantile", steps: 4 }}
      >
        <ChoroplethFeatureComponent />
      </ChoroplethChart>,
    );
    expect(container.querySelector('[data-slot="ramp-legend-marker"]')).toBeNull();
    const valued = [...container.querySelectorAll(".choropleth-features path")].find(
      (p) => p.getAttribute("fill") !== "var(--muted)",
    )!;
    fireEvent.mouseEnter(valued);
    fireEvent.mouseMove(valued);
    expect(container.querySelector('[data-slot="ramp-legend-marker"]')).not.toBeNull();
  });

  it("a categorical palette draws a swatch list, not a ramp", () => {
    const data = statesWithData(12);
    data.features = data.features.map((f, i) => ({
      ...f,
      properties: { ...f.properties, party: i % 2 === 0 ? "North" : "South" },
    }));
    const { container } = render(
      <ChoroplethChart
        data={data}
        legend
        scale={{ type: "stepped", palette: "categorical", key: "party" }}
      >
        <ChoroplethFeatureComponent />
      </ChoroplethChart>,
    );
    expect(container.querySelector('[data-slot="choropleth-legend-categories"]')).not.toBeNull();
    expect(container.querySelector('[data-slot="ramp-legend"]')).toBeNull();
  });

  // a-8: a categorical scale carried MEANING in hue alone — two of the brand
  // categorical tokens sit 0.018 apart in luminance, so in greyscale they are
  // one shade (WCAG 1.4.1).
  it("a categorical map textures its classes and the key paints the same shape", () => {
    const regions = ["East", "Central", "West"];
    const data = statesWithData(12);
    data.features = data.features.map((f, i) => ({
      ...f,
      properties: { ...f.properties, region: regions[i % 3] },
    }));
    const { container } = render(
      <ChoroplethChart
        data={data}
        legend
        scale={{ type: "stepped", palette: "categorical", key: "region" }}
      >
        <ChoroplethFeatureComponent />
      </ChoroplethChart>,
    );

    // The map: every class after the first paints one texture of its own.
    const textures = [
      ...container.querySelectorAll('[data-slot="choropleth-category-texture"] path'),
    ];
    expect(textures.length).toBeGreaterThan(0);
    const fillByClass = new Map<string, string>();
    for (const path of textures) {
      const index = path.getAttribute("data-category-index")!;
      const fill = path.getAttribute("fill")!;
      const seen = fillByClass.get(index);
      if (seen === undefined) fillByClass.set(index, fill);
      else expect(fill).toBe(seen);
    }
    expect([...fillByClass.keys()].sort()).toEqual(["1", "2"]);
    expect(new Set(fillByClass.values()).size).toBe(2);

    /** The tag names inside the referenced `<pattern>`, and its tile size. */
    const patternOf = (fill: string) => {
      const id = fill.slice("url(#".length, -1);
      const pattern = container.querySelector(`pattern[id="${id}"]`);
      expect(pattern).not.toBeNull();
      const mark = pattern!.firstElementChild!;
      return {
        shape: [...pattern!.children].map((child) => child.tagName.toLowerCase()).join(","),
        size: Number(pattern!.getAttribute("width")),
        ink: mark.getAttribute("stroke") ?? mark.getAttribute("fill"),
      };
    };
    const mapShapes = new Map(
      [...fillByClass].map(([index, fill]) => [index, patternOf(fill).shape]),
    );
    // A texture is INK ONLY — no colour ground — so the class colour underneath
    // is untouched and the texture is purely the second channel.
    for (const shape of mapShapes.values()) expect(shape).not.toContain("rect");
    // The ink is a token the on-mark seam resolved from the class's own fill,
    // never a literal.
    for (const fill of fillByClass.values()) {
      expect(patternOf(fill).ink).toMatch(/^var\(--/);
    }
    // …and the two textured classes differ from each other in SHAPE, which is
    // what survives greyscale.
    expect(new Set(mapShapes.values()).size).toBe(2);

    // The key: same class, same shape, on a smaller tile so a 10px swatch shows it.
    const swatches = [
      ...container.querySelectorAll('[data-slot="choropleth-legend-categories"] svg'),
    ];
    expect(swatches).toHaveLength(3);
    for (const swatch of swatches) {
      const index = swatch.getAttribute("data-category-index")!;
      const textureCircle = [...swatch.querySelectorAll("circle")].find((circle) =>
        circle.getAttribute("fill")?.startsWith("url(#"),
      );
      if (index === "0") {
        expect(textureCircle).toBeUndefined();
        continue;
      }
      const legend = patternOf(textureCircle!.getAttribute("fill")!);
      expect(legend.shape).toBe(mapShapes.get(index));
      expect(legend.size).toBeLessThan(patternOf(fillByClass.get(index)!).size);
    }
  });
});

describe("ChoroplethChart place labels", () => {
  const candidates = Array.from({ length: 40 }, (_, i) => ({
    id: `p${String(i).padStart(2, "0")}`,
    text: `Place ${i}`,
    x: 40 + (i % 8) * 70,
    y: 20 + Math.floor(i / 8) * 60,
    priority: 40 - i,
  }));

  it("never paints more than 30 and drops every label at narrow", () => {
    const wide = layoutPlaceLabels(candidates, {}, { width: 600, height: 320, breakpoint: "wide" });
    expect(wide.painted.length).toBeGreaterThan(0);
    expect(wide.painted.length).toBeLessThanOrEqual(MAX_PLACE_LABELS);
    expect(wide.painted.length + wide.dropped.length).toBe(40);
    const narrow = layoutPlaceLabels(
      candidates,
      {},
      { width: 348, height: 200, breakpoint: "narrow" },
    );
    expect(narrow.painted).toHaveLength(0);
    expect(narrow.dropped).toHaveLength(40);
  });

  it("drops the lower-priority label of a colliding pair", () => {
    const pair = [
      { id: "a", text: "Alpha", x: 100, y: 100, priority: 1 },
      { id: "b", text: "Bravo", x: 104, y: 100, priority: 2 },
    ];
    const result = layoutPlaceLabels(pair, {}, { width: 300, height: 200, breakpoint: "wide" });
    expect(result.painted.map((p) => p.id)).toEqual(["b"]);
    expect(result.dropped).toEqual(["Alpha"]);
  });

  it("paints labels in the chart and restates the dropped ones as text", () => {
    const { container } = render(
      <ChoroplethChart data={statesWithData(12)} labels={{ max: 5 }}>
        <ChoroplethFeatureComponent />
      </ChoroplethChart>,
    );
    const layer = container.querySelector('[data-slot="choropleth-place-labels"]')!;
    const painted = Number(layer.getAttribute("data-painted-count"));
    expect(painted).toBeGreaterThan(0);
    expect(painted).toBeLessThanOrEqual(5);
    expect(container.querySelectorAll('[data-slot="choropleth-place-label"]')).toHaveLength(
      painted,
    );
  });
});

describe("ChoroplethChart symbols", () => {
  const points = [
    { lon: -100, lat: 40, name: "Small", value: 10 },
    { lon: -80, lat: 35, name: "Large", value: 40 },
  ];
  const project = (c: [number, number]): [number, number] => [c[0] + 200, 100 - c[1]];

  it("sizeKey: a 4× value draws a 2× radius (the area encodes the value)", () => {
    const [large, small] = layoutSymbols({ points, sizeKey: "value" }, [], project, 900);
    expect(large!.value).toBe(40);
    expect(large!.radius / small!.radius).toBeCloseTo(2, 6);
    expect(areaRadius(40, 40, 20) / areaRadius(10, 40, 20)).toBeCloseTo(2, 6);
  });

  it("symbols shrink by sqrt(width / 700) on a narrow plot", () => {
    const wide = layoutSymbols({ points }, [], project, 868);
    const narrow = layoutSymbols({ points }, [], project, 348);
    expect(symbolShrink(868)).toBe(1);
    expect(symbolShrink(0)).toBe(0);
    expect(narrow[0]!.radius / wide[0]!.radius).toBeCloseTo(Math.sqrt(348 / 700), 6);
  });

  it("paints one symbol per valued region and a size key", () => {
    const { container } = render(
      <ChoroplethChart data={statesWithData(12)} symbols={{ sizeKey: "value" }}>
        <ChoroplethFeatureComponent />
      </ChoroplethChart>,
    );
    expect(container.querySelectorAll('[data-slot="choropleth-symbol"]')).toHaveLength(12);
    expect(container.querySelector('[data-slot="size-legend"]')).not.toBeNull();
  });
});

describe("ChoroplethChart zoom controls", () => {
  it("zooms with real buttons and reset returns to the fitted view", () => {
    const { container } = render(
      <ChoroplethChart data={statesWithData(12)} fitToData zoomControls>
        <ChoroplethFeatureComponent />
      </ChoroplethChart>,
    );
    const transform = () =>
      container
        .querySelector(".choropleth-features")!
        .closest("g[transform]")!
        .getAttribute("transform");
    const fitted = transform();
    const zoomIn = screen.getByRole("button", { name: "Zoom in" });
    expect(zoomIn.tagName).toBe("BUTTON");
    expect(zoomIn).toHaveAttribute("type", "button");
    zoomIn.focus();
    expect(document.activeElement).toBe(zoomIn);
    // A native <button> turns Enter / Space into a click; jsdom does not, so
    // the click stands in for the key press here (the story play presses keys).
    fireEvent.click(zoomIn);
    expect(transform()).not.toBe(fitted);
    fireEvent.click(screen.getByRole("button", { name: "Zoom out" }));
    fireEvent.click(zoomIn);
    fireEvent.click(screen.getByRole("button", { name: "Reset zoom" }));
    expect(transform()).toBe(fitted);
  });
});

describe("ChoroplethChart overlay", () => {
  it("adds a stripes pattern per overlay category", () => {
    const data = statesWithData(12);
    data.features = data.features.map((f, i) => ({
      ...f,
      properties: { ...f.properties, flagged: i % 3 === 0 ? "Estimated" : "" },
    }));
    expect(overlayCategories(data.features, "flagged")).toEqual(["Estimated"]);
    const { container } = render(
      <ChoroplethChart data={data} overlayBy={{ key: "flagged" }}>
        <ChoroplethFeatureComponent />
      </ChoroplethChart>,
    );
    const overlay = container.querySelector('[data-slot="choropleth-overlay"]')!;
    expect(overlay.querySelectorAll('[data-overlay-category="Estimated"]').length).toBe(
      data.features.filter((_, i) => i % 3 === 0).length,
    );
  });
});

describe("world fixture", () => {
  it("is at most 150 kB on disk", () => {
    const bytes = readFileSync(join(__dirname, "world-fixture.ts")).byteLength;
    expect(bytes).toBeLessThanOrEqual(150 * 1024);
  });

  it("keeps d3-geo winding: every country is smaller than a hemisphere", () => {
    const world = worldFeatureCollection();
    expect(world.features.length).toBeGreaterThan(170);
    for (const feature of world.features) {
      expect(geoArea(feature)).toBeLessThan(2 * Math.PI);
    }
  });
});
