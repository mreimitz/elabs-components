/**
 * Area — nulls / curve / symbols / focusOnHover (RM-112).
 *
 * Mirrors `line-chart.test.tsx`'s identical RM-112 block, but for `Area`.
 * A dedicated file (not appended to `area-chart.test.tsx`) because that file
 * mocks `./area` and `./time-series-chart-shell` down to no-ops for its own
 * smoke tests — this file mounts the real `Area`/`AreaChart`/shell instead,
 * the same "polyfill `getTotalLength`, mock only `@visx/responsive`" pattern
 * `line-chart.test.tsx`'s RM-112 block and `chart-selection.test.tsx` use to
 * mount real path-measuring marks.
 *
 * Real render, animation, interaction and a11y are covered by the Storybook
 * story (Charts/AreaChart) in a real browser via
 * `pnpm --filter @elabs-ai/components-docs test-storybook`.
 */
import { fireEvent, render, waitFor } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

// @visx/responsive uses ResizeObserver + real DOM measurement which jsdom lacks.
// Mock ParentSize to supply a fixed 560×288 viewport so ChartInner renders.
vi.mock("./chart-parent-size", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- vi.mock factory is hoisted; lazy require avoids TDZ
  const React = require("react");
  return {
    ChartParentSize: ({
      children,
    }: {
      children: (size: { width: number; height: number }) => React.ReactNode;
    }) =>
      React.createElement(
        "div",
        { "data-testid": "parent-size" },
        children({ width: 560, height: 288 }),
      ),
  };
});

import { Area } from "./area";
import { AreaChart } from "./area-chart";
import { SELECTION_EXCLUDED_OPACITY } from "./chart-selection";

describe("Area — nulls/curve/symbols/focusOnHover (RM-112)", () => {
  beforeAll(() => {
    if (typeof globalThis.ResizeObserver === "undefined") {
      globalThis.ResizeObserver = class {
        observe() {}
        unobserve() {}
        disconnect() {}
      } as unknown as typeof ResizeObserver;
    }
    globalThis.IntersectionObserver ??= class {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    } as unknown as typeof IntersectionObserver;
    // jsdom has no SVG geometry; `<Area>` measures its crest path length.
    Object.defineProperty(SVGElement.prototype, "getTotalLength", {
      configurable: true,
      value: () => 100,
    });
  });

  // A null at index 2 (not an edge) — the same RM-112 Acceptance fixture as `Line`'s.
  const rmData: Record<string, unknown>[] = [
    { date: new Date(2024, 0, 1), value: 10 },
    { date: new Date(2024, 0, 2), value: 20 },
    { date: new Date(2024, 0, 3), value: null },
    { date: new Date(2024, 0, 4), value: 15 },
    { date: new Date(2024, 0, 5), value: 25 },
  ];

  function renderArea(areaProps: Partial<React.ComponentProps<typeof Area>> = {}) {
    return render(
      <AreaChart animationDuration={0} data={rmData} xDataKey="date">
        <Area animate={false} dataKey="value" fadeEdges={false} {...areaProps} />
      </AreaChart>,
    );
  }

  function crestPathD(container: HTMLElement): string {
    const path = container.querySelector("path.visx-linepath");
    expect(path).not.toBeNull();
    return path?.getAttribute("d") ?? "";
  }

  describe("nulls", () => {
    it('"gap" (the new default) breaks the crest at the null sample', () => {
      const { container } = renderArea();
      const d = crestPathD(container);
      expect((d.match(/M/g) ?? []).length).toBe(2);
    });

    it('"connect" draws one continuous crest straight across the null', () => {
      const { container } = renderArea({ nulls: "connect" });
      const d = crestPathD(container);
      expect((d.match(/M/g) ?? []).length).toBe(1);
    });

    it('"zero" (the pre-RM-112 default) draws one continuous crest through pixel 0', () => {
      const { container } = renderArea({ nulls: "zero" });
      const d = crestPathD(container);
      expect((d.match(/M/g) ?? []).length).toBe(1);
    });
  });

  describe("curve", () => {
    it('"step-after" and "natural" render distinct crests', () => {
      const a = renderArea({ curve: "step-after" });
      const dA = crestPathD(a.container);
      a.unmount();
      const b = renderArea({ curve: "natural" });
      const dB = crestPathD(b.container);
      b.unmount();
      expect(dA).not.toBe(dB);
    });
  });

  describe("symbols — the Line-shared resolveSeriesSymbols rule", () => {
    it("renders no markers when unset (today's behaviour)", () => {
      const { container } = renderArea();
      expect(container.querySelectorAll("circle").length).toBe(0);
    });

    it("a ≤12-point series with no explicit placement defaults to hollow markers at the ends", () => {
      const { container } = renderArea({ symbols: { style: "hollow" } });
      // rmData has 5 points, ≤ 12 — symbols with no placement default to
      // "ends" (2 markers). Each `StaticSeriesPointMarker` at the default
      // `strokeWidth=2` renders 2 circles (inner fill + ring stroke).
      expect(container.querySelectorAll("circle").length).toBe(4);
    });

    it("a >12-point series with no explicit placement stays off (avoid dense-interval symbols)", () => {
      const denseData = Array.from({ length: 20 }, (_, i) => ({
        date: new Date(2024, 0, i + 1),
        value: i,
      }));
      const { container } = render(
        <AreaChart animationDuration={0} data={denseData} xDataKey="date">
          <Area animate={false} dataKey="value" fadeEdges={false} symbols={{ style: "hollow" }} />
        </AreaChart>,
      );
      expect(container.querySelectorAll("circle").length).toBe(0);
    });
  });

  describe("focusOnHover", () => {
    const twoSeriesData = [
      { date: new Date(2024, 0, 1), a: 10, b: 30 },
      { date: new Date(2024, 0, 2), a: 20, b: 25 },
      { date: new Date(2024, 0, 3), a: 15, b: 28 },
    ];

    it("hovering series 2 leaves it at opacity 1 and dims series 1 to SELECTION_EXCLUDED_OPACITY", async () => {
      const { container } = render(
        <AreaChart animationDuration={0} data={twoSeriesData} focusOnHover xDataKey="date">
          <Area animate={false} dataKey="a" fadeEdges={false} stroke="var(--chart-1)" />
          <Area animate={false} dataKey="b" fadeEdges={false} stroke="var(--chart-2)" />
        </AreaChart>,
      );

      // `focusOnHover` also renders a wide, invisible `aria-hidden` hit-stroke
      // crest per series (same "visx-linepath" class) — exclude it here so
      // only the two real, coloured crests are counted/selected.
      await waitFor(() => {
        expect(container.querySelectorAll("path.visx-linepath:not([aria-hidden])")).toHaveLength(2);
      });
      const paths = Array.from(container.querySelectorAll("path.visx-linepath:not([aria-hidden])"));
      const seriesAGroup = paths[0]?.closest("g");
      const seriesBGroup = paths[1]?.closest("g");
      expect(seriesAGroup).toBeTruthy();
      expect(seriesBGroup).toBeTruthy();

      // Direct pointer hover on series 2's own rendered shape.
      fireEvent.mouseOver(seriesBGroup as Element);

      await waitFor(() => {
        expect(seriesBGroup?.getAttribute("opacity")).toBe("1");
        expect(seriesAGroup?.getAttribute("opacity")).toBe(String(SELECTION_EXCLUDED_OPACITY));
      });

      fireEvent.mouseOut(seriesBGroup as Element);

      await waitFor(() => {
        expect(seriesAGroup?.getAttribute("opacity")).toBe("1");
        expect(seriesBGroup?.getAttribute("opacity")).toBe("1");
      });
    });

    it("focusOnHover off (default) never sets the excluded opacity from a plain hover", async () => {
      const { container } = render(
        <AreaChart animationDuration={0} data={twoSeriesData} xDataKey="date">
          <Area animate={false} dataKey="a" fadeEdges={false} stroke="var(--chart-1)" />
          <Area animate={false} dataKey="b" fadeEdges={false} stroke="var(--chart-2)" />
        </AreaChart>,
      );
      await waitFor(() => {
        expect(container.querySelectorAll("path.visx-linepath")).toHaveLength(2);
      });
      const paths = Array.from(container.querySelectorAll("path.visx-linepath"));
      const seriesAGroup = paths[0]?.closest("g");
      fireEvent.mouseOver(seriesAGroup as Element);
      // No focusOnHover handler is attached at all — opacity stays at 1.
      expect(seriesAGroup?.getAttribute("opacity")).toBe("1");
    });
  });
});
