import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// react-use-measure uses ResizeObserver for layout measurement, which jsdom
// does not implement. Mock it to return a fixed size so the chart's inner
// render gate (width > 0 && height > 0) is satisfied — the same technique
// `dumbbell-chart.test.tsx` uses.
vi.mock("react-use-measure", () => ({
  default: () => [() => undefined, { width: 640, height: 320 }],
}));

import type { ChartDatapoint } from "../chart-datapoint";
import {
  buildParallelAxes,
  buildParallelRows,
  computeRowPoints,
  nonHeroLineOpacity,
  orderRowsForRender,
  PARALLEL_COORDINATES_MAX_DIMENSIONS,
  PARALLEL_COORDINATES_MIN_DIMENSIONS,
  ParallelCoordinatesChart,
  resolveEntityLineStyle,
  resolveHeroEntity,
  resolveParallelDimensions,
  type ParallelCoordinatesDimension,
  type ParallelCoordinatesRow,
} from "./parallel-coordinates-chart";

afterEach(cleanup);

// L20 "Twelve products, four dimensions" — the roadmap's own acceptance recreation.
const dims: ParallelCoordinatesDimension[] = [
  { key: "price", label: "Price" },
  { key: "latency", label: "Latency" },
  { key: "nps", label: "NPS" },
  { key: "uptime", label: "Uptime" },
];

const products = Array.from({ length: 12 }, (_, i) => ({
  product: `Product ${i + 1}`,
  price: 10 + i * 7,
  latency: 200 - i * 5,
  nps: 30 + i * 3,
  uptime: 99 + i * 0.05,
}));

const TARGET = '[data-slot="chart-datapoint-layer-target"]';

describe("resolveParallelDimensions (axis-count guard)", () => {
  it("passes 3–6 dimensions through unchanged", () => {
    const three = dims.slice(0, 3);
    expect(resolveParallelDimensions(three)).toBe(three);
    expect(resolveParallelDimensions(dims)).toBe(dims);
  });

  it(`clamps to the first ${PARALLEL_COORDINATES_MAX_DIMENSIONS} past the maximum`, () => {
    const seven: ParallelCoordinatesDimension[] = [
      ...dims,
      { key: "a" },
      { key: "b" },
      { key: "c" },
    ];
    const resolved = resolveParallelDimensions(seven);
    expect(resolved).toHaveLength(PARALLEL_COORDINATES_MAX_DIMENSIONS);
    expect(resolved.map((d) => d.key)).toEqual(seven.slice(0, 6).map((d) => d.key));
  });

  it(`leaves a below-minimum array untouched (there is nothing to add)`, () => {
    const two = dims.slice(0, 2);
    expect(resolveParallelDimensions(two)).toBe(two);
    expect(two.length).toBeLessThan(PARALLEL_COORDINATES_MIN_DIMENSIONS);
  });
});

describe("buildParallelRows", () => {
  it("shapes one row per entity, carrying every dimension's numeric value", () => {
    const rows = buildParallelRows(products, "product", dims);
    expect(rows).toHaveLength(12);
    expect(rows[0]).toMatchObject({
      entity: "Product 1",
      values: { price: 10, latency: 200, nps: 30, uptime: 99 },
    });
    expect(rows[0]?.datum).toBe(products[0]);
  });

  it("drops a row missing a finite value on ANY dimension", () => {
    const rows = buildParallelRows(
      [
        { product: "OK", price: 1, latency: 2, nps: 3, uptime: 4 },
        { product: "Bad", price: "n/a", latency: 2, nps: 3, uptime: 4 },
      ],
      "product",
      dims,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.entity).toBe("OK");
  });
});

describe("buildParallelAxes (per-axis normalisation)", () => {
  it("normalizes each dimension independently — 0 at the min, 1 at the max", () => {
    const rows = buildParallelRows(products, "product", dims);
    const axes = buildParallelAxes(dims, rows);
    const priceAxis = axes.find((a) => a.key === "price");
    expect(priceAxis?.min).toBe(10);
    expect(priceAxis?.max).toBe(10 + 11 * 7);
    expect(priceAxis?.normalize(priceAxis.min)).toBeCloseTo(0);
    expect(priceAxis?.normalize(priceAxis.max)).toBeCloseTo(1);
    expect(priceAxis?.normalize((priceAxis.min + priceAxis.max) / 2)).toBeCloseTo(0.5);
  });

  // #230 sent-back — the test above only ever reads the FIRST dimension
  // (`price` is `dims[0]`), so a mutation that derives every axis's domain
  // from `dimensions[0]` instead of its own `dim.key` (collapsing per-axis
  // independence) left it green. This case pins a NON-first dimension
  // (`latency`, mismatched unit and range from `price` — a descending
  // ms column, not a rising currency one) against LITERAL expected numbers
  // computed by hand from the fixture formula (`200 - i * 5`, i = 0..11),
  // never derived from `dimensionDomain` itself, so it cannot pass by
  // agreeing with the implementation under test.
  it("derives a NON-first axis's domain from its OWN column, not the first dimension's", () => {
    const rows = buildParallelRows(products, "product", dims);
    const axes = buildParallelAxes(dims, rows);
    const latencyAxis = axes.find((a) => a.key === "latency");
    // latency = 200 - i * 5 for i = 0..11 → min 145 (i=11), max 200 (i=0).
    // Deliberately NOT price's domain ([10, 87]) — if it were, the axis
    // collapsed onto the wrong column.
    expect(latencyAxis?.min).toBe(145);
    expect(latencyAxis?.max).toBe(200);
    expect(latencyAxis?.normalize(145)).toBeCloseTo(0);
    expect(latencyAxis?.normalize(200)).toBeCloseTo(1);
    expect(latencyAxis?.normalize(172.5)).toBeCloseTo(0.5);

    // A third, independently mismatched-unit axis (a 0-100 score band, not a
    // currency or a millisecond count) for the same property.
    const npsAxis = axes.find((a) => a.key === "nps");
    // nps = 30 + i * 3 for i = 0..11 → min 30 (i=0), max 63 (i=11).
    expect(npsAxis?.min).toBe(30);
    expect(npsAxis?.max).toBe(63);
    expect(npsAxis?.normalize(30)).toBeCloseTo(0);
    expect(npsAxis?.normalize(63)).toBeCloseTo(1);
    expect(npsAxis?.normalize(46.5)).toBeCloseTo(0.5);
  });

  it("honours an explicit domain over the data's own min/max", () => {
    const rows = buildParallelRows(products, "product", dims);
    const axes = buildParallelAxes([{ key: "price", domain: [0, 100] }], rows);
    expect(axes[0]).toMatchObject({ min: 0, max: 100 });
    expect(axes[0]?.normalize(50)).toBeCloseTo(0.5);
  });

  it("invert flips which end reads 0 vs 1", () => {
    const rows = buildParallelRows(products, "product", [dims[0] as ParallelCoordinatesDimension]);
    const [plain] = buildParallelAxes([{ key: "price", domain: [0, 100] }], rows);
    const [inverted] = buildParallelAxes([{ key: "price", domain: [0, 100], invert: true }], rows);
    expect(plain?.normalize(0)).toBeCloseTo(0);
    expect(inverted?.normalize(0)).toBeCloseTo(1);
    expect(plain?.normalize(100)).toBeCloseTo(1);
    expect(inverted?.normalize(100)).toBeCloseTo(0);
  });

  it("pads a degenerate domain (every row ties) so normalize never divides by zero", () => {
    const rows = buildParallelRows(
      [
        { product: "A", flat: 5 },
        { product: "B", flat: 5 },
      ],
      "product",
      [{ key: "flat" }],
    );
    const [axis] = buildParallelAxes([{ key: "flat" }], rows);
    expect(axis?.min).toBe(4);
    expect(axis?.max).toBe(6);
    expect(Number.isFinite(axis?.normalize(5))).toBe(true);
  });
});

describe("computeRowPoints", () => {
  it("spaces axes evenly and maps the normalized fraction to inner-height pixels", () => {
    const rows = buildParallelRows([{ e: "A", x: 0, y: 50, z: 100 }], "e", [
      { key: "x" },
      { key: "y" },
      { key: "z" },
    ]);
    const axes = buildParallelAxes(
      [
        { key: "x", domain: [0, 100] },
        { key: "y", domain: [0, 100] },
        { key: "z", domain: [0, 100] },
      ],
      rows,
    );
    const points = computeRowPoints((rows[0] as ParallelCoordinatesRow).values, axes, 200, 100);
    expect(points).toEqual([
      [0, 100],
      [100, 50],
      [200, 0],
    ]);
  });
});

describe("resolveHeroEntity + orderRowsForRender (hero promotion)", () => {
  const rows = buildParallelRows(products, "product", dims);

  it("resolves a literal entity id only when it actually names a row", () => {
    expect(resolveHeroEntity(rows, "Product 3")).toBe("Product 3");
    expect(resolveHeroEntity(rows, "Nonexistent")).toBeUndefined();
    expect(resolveHeroEntity(rows, undefined)).toBeUndefined();
  });

  it("resolves a predicate to the first matching row's entity", () => {
    expect(resolveHeroEntity(rows, (d) => (d.nps as number) > 60)).toBe("Product 12");
  });

  it("draws the hero LAST — every other row keeps its relative order", () => {
    const ordered = orderRowsForRender(rows, "Product 3");
    expect(ordered.at(-1)?.entity).toBe("Product 3");
    expect(ordered.slice(0, -1).map((r) => r.entity)).toEqual(
      rows.filter((r) => r.entity !== "Product 3").map((r) => r.entity),
    );
  });

  it("is a no-op with no hero", () => {
    expect(orderRowsForRender(rows, undefined)).toBe(rows);
  });
});

describe("resolveEntityLineStyle", () => {
  const rows = buildParallelRows(products, "product", dims);
  const row = rows[0] as ParallelCoordinatesRow;

  it("draws the hero at full ink (2px, opacity 1) when nothing is hovered", () => {
    expect(resolveEntityLineStyle(row, true, null)).toEqual({ strokeWidth: 2, opacity: 1 });
  });

  it("draws a non-hero at the seeded hairline band (0.65px, 0.5–0.8 opacity)", () => {
    const style = resolveEntityLineStyle(row, false, null);
    expect(style.strokeWidth).toBe(0.65);
    expect(style.opacity).toBeGreaterThanOrEqual(0.5);
    expect(style.opacity).toBeLessThanOrEqual(0.8);
  });

  it("promotes the hovered row to full ink, even when it is not the hero", () => {
    expect(resolveEntityLineStyle(row, false, row.entity)).toEqual({ strokeWidth: 2, opacity: 1 });
  });

  it("dims every OTHER row further while something is hovered", () => {
    const other = rows[1] as ParallelCoordinatesRow;
    const style = resolveEntityLineStyle(other, false, row.entity);
    expect(style.opacity).toBe(0.15);
  });

  it("nonHeroLineOpacity is deterministic and stays inside [0.5, 0.8]", () => {
    const a = nonHeroLineOpacity(3);
    const b = nonHeroLineOpacity(3);
    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(0.5);
    expect(a).toBeLessThan(0.8);
  });
});

describe("<ParallelCoordinatesChart /> render", () => {
  it("renders the a11y label and one path per entity", () => {
    const { container } = render(
      <div style={{ width: 640, height: 320 }}>
        <ParallelCoordinatesChart
          accessibleLabel="Twelve products across four dimensions"
          data={products}
          dimensions={dims}
          entity="product"
        />
      </div>,
    );
    expect(screen.getByRole("figure", { name: /twelve products/i })).toBeInTheDocument();
    expect(container.querySelectorAll('[data-slot="parallel-coordinates-path"]')).toHaveLength(12);
  });

  it("promotes the highlightKey entity to a hero label and 2px stroke", () => {
    const { container } = render(
      <div style={{ width: 640, height: 320 }}>
        <ParallelCoordinatesChart
          data={products}
          dimensions={dims}
          entity="product"
          highlightKey="Product 3"
        />
      </div>,
    );
    const heroPath = container.querySelector('[data-entity="Product 3"]');
    expect(heroPath).toHaveAttribute("stroke-width", "2");
    expect(
      container.querySelector('[data-slot="parallel-coordinates-hero-label"]'),
    ).toHaveTextContent("Product 3");
  });

  it("keyboard cycles through entities — one tab stop, ArrowRight moves it, Enter activates", () => {
    const onDatapointClick = vi.fn();
    const { container } = render(
      <div style={{ width: 640, height: 320 }}>
        <ParallelCoordinatesChart
          data={products}
          dimensions={dims}
          entity="product"
          onDatapointClick={onDatapointClick}
        />
      </div>,
    );
    const targets = [...container.querySelectorAll<HTMLButtonElement>(TARGET)];
    expect(targets).toHaveLength(12);
    expect(targets.filter((t) => t.getAttribute("tabindex") === "0")).toHaveLength(1);

    (targets[0] as HTMLButtonElement).focus();
    fireEvent.keyDown(targets[0] as HTMLButtonElement, { key: "ArrowRight" });
    expect(targets[1]?.getAttribute("tabindex")).toBe("0");
    expect(targets[0]?.getAttribute("tabindex")).toBe("-1");

    fireEvent.click(targets[1] as HTMLButtonElement, { detail: 0 });
    expect(onDatapointClick).toHaveBeenCalledTimes(1);
    const [point] = onDatapointClick.mock.calls[0] as [ChartDatapoint];
    expect(point.category).toBe("Product 2");
    expect(point.source).toBe("keyboard");
  });

  it("renders no interactive layer with no interaction props (opt-out stays inert)", () => {
    const { container } = render(
      <div style={{ width: 640, height: 320 }}>
        <ParallelCoordinatesChart data={products} dimensions={dims} entity="product" />
      </div>,
    );
    expect(container.querySelectorAll(TARGET)).toHaveLength(0);
  });
});
