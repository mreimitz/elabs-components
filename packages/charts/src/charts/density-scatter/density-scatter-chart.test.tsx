/**
 * `DensityScatterChart` in jsdom: no WebGL, a stubbed 2D context (the
 * package's own `installCanvasContextStub`), a stubbed ResizeObserver. What
 * this file can check is the DOM contract — the figure semantics, the parallel
 * summary, the keyboard range sliders, the zone tags, the legend toggle, the
 * intents — not the pixels; the stories carry the picture.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import { resetWarnOnce } from "@elabs-ai/components-ui/definition";
import { DensityScatterChart as DensityScatterChartDouble } from "../../test";
import { DENSITY_SCATTER_CHART } from "../../definitions/density-scatter-chart.definition";
import { installCanvasContextStub } from "../../test/primitives";
import { DensityScatterChart } from "./density-scatter-chart";
import { buildLateralTraffic, LATERAL_ZONES } from "./fixtures";
import type { DensityScatterSelection } from "./types";
import type { ChartSelectionIntent } from "../selection/types";

beforeAll(() => {
  if (typeof window !== "undefined" && !window.ResizeObserver) {
    window.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
});

let canvasStub: ReturnType<typeof installCanvasContextStub>;
beforeEach(() => {
  canvasStub = installCanvasContextStub();
});
afterEach(() => {
  canvasStub.restore();
  vi.restoreAllMocks();
});

const DATA = buildLateralTraffic(2_000);

describe("DensityScatterChart", () => {
  it("renders a figure with a parallel summary naming the zone shares", () => {
    render(
      <DensityScatterChart accessibleLabel="Lateral deviation" data={DATA} zones={LATERAL_ZONES} />,
    );
    const figure = screen.getByRole("figure", { name: "Lateral deviation" });
    expect(figure).toHaveAttribute("data-slot", "density-scatter-chart");
    expect(figure).toHaveAccessibleDescription(
      /2,000 points; x from .*; zones: Core \d+%, Expanded EIS \d+%, Outside \d+%/,
    );
    // No gestures → no sliders, no gutters.
    expect(screen.queryByRole("slider")).toBeNull();
    // Canvas surfaces are hidden from AT.
    expect(figure.querySelectorAll("canvas[aria-hidden='true']")).toHaveLength(2);
  });

  it("mounts keyboard range sliders with gestures and emits range intents", () => {
    const intents: ChartSelectionIntent[] = [];
    const changes: unknown[] = [];
    render(
      <DensityScatterChart
        accessibleLabel="Lateral deviation"
        data={DATA}
        onSelectionChange={(s) => changes.push(s)}
        onSelectionIntent={(i) => intents.push(i)}
        selectionGestures={["range", "lasso"]}
        xKey="along"
        zones={LATERAL_ZONES}
      />,
    );
    const sliders = screen.getAllByRole("slider");
    expect(sliders).toHaveLength(4);
    const xFrom = screen.getByRole("slider", { name: "Range start, x" });
    fireEvent.keyDown(xFrom, { key: "ArrowRight" });
    expect(intents).toHaveLength(1);
    expect(intents[0]).toMatchObject({
      field: "along",
      mode: "replace",
      source: "keyboard",
      gesture: { kind: "range", axis: "x" },
    });
    expect(changes[0]).toMatchObject({ x: expect.any(Array) });
    fireEvent.keyDown(xFrom, { key: "Escape" });
    expect(changes[1]).toEqual({});
  });

  it("Escape on one axis' thumb clears only that axis, not the other (RM-185 review fix3)", () => {
    const changes: DensityScatterSelection[] = [];
    render(
      <DensityScatterChart
        accessibleLabel="Lateral deviation"
        data={DATA}
        onSelectionChange={(s) => changes.push(s)}
        selectionGestures={["range"]}
        xKey="along"
        zones={LATERAL_ZONES}
      />,
    );
    const xFrom = screen.getByRole("slider", { name: "Range start, x" });
    const yFrom = screen.getByRole("slider", { name: "Range start, y" });
    fireEvent.keyDown(xFrom, { key: "ArrowRight" });
    fireEvent.keyDown(yFrom, { key: "ArrowRight" });
    expect(changes.at(-1)).toMatchObject({ x: expect.any(Array), y: expect.any(Array) });
    // A thumb's own Escape must stop there (`RangeThumbs`' `mode="immediate"`
    // now calls `stopPropagation`) — before this fix it bubbled to the chart
    // root's Esc-clears-everything handler and wiped the y range too.
    fireEvent.keyDown(xFrom, { key: "Escape" });
    const last = changes.at(-1)!;
    expect(last).toHaveProperty("y");
    expect(last).not.toHaveProperty("x");
  });

  it("a custom messages.xRange/from/to still composes the range thumb's name (deprecated)", () => {
    render(
      <DensityScatterChart
        accessibleLabel="Lateral deviation"
        data={DATA}
        messages={{ xRange: "distance", from: "start", to: "end" }}
        selectionGestures={["range"]}
        zones={LATERAL_ZONES}
      />,
    );
    expect(screen.getByRole("slider", { name: "distance start" })).toBeTruthy();
    expect(screen.getByRole("slider", { name: "distance end" })).toBeTruthy();
  });

  it("legend toggles hide a class; a modifier-click selects it", () => {
    const intents: ChartSelectionIntent[] = [];
    const hidden: ReadonlySet<string>[] = [];
    const selections: unknown[] = [];
    render(
      <DensityScatterChart
        accessibleLabel="Lateral deviation"
        data={DATA}
        legend
        onHiddenKeysChange={(k) => hidden.push(k)}
        onSelectionChange={(s) => selections.push(s)}
        onSelectionIntent={(i) => intents.push(i)}
        zones={LATERAL_ZONES}
      />,
    );
    const core = screen.getByRole("button", { name: /Core/, pressed: true });
    fireEvent.click(core);
    expect([...hidden[0]!]).toEqual(["core"]);
    expect(selections).toHaveLength(0);
    fireEvent.click(core, { shiftKey: true });
    expect(selections[0]).toEqual({ zones: ["core"] });
    expect(intents[0]).toMatchObject({
      field: "zone",
      values: ["core"],
      mode: "add",
      gesture: { kind: "click", category: "core" },
    });
    expect(hidden).toHaveLength(1);
  });

  it("checkbox legend: the checkbox hides a class, an entry click goes to the host", () => {
    const hidden: ReadonlySet<string>[] = [];
    const clicked: string[] = [];
    const { rerender } = render(
      <DensityScatterChart
        accessibleLabel="Lateral deviation"
        data={DATA}
        legend={{ toggleControl: "checkbox", title: "Zone" }}
        onHiddenKeysChange={(k) => hidden.push(k)}
        onLegendItemClick={(key) => clicked.push(key)}
        zones={LATERAL_ZONES}
      />,
    );
    expect(screen.getByRole("heading", { name: "Zone" })).toBeInTheDocument();
    const entry = screen.getByRole("button", { name: /Core/ });
    expect(entry).not.toHaveAttribute("aria-pressed");
    fireEvent.click(entry);
    expect(clicked).toEqual(["core"]);
    expect(hidden).toHaveLength(0);
    fireEvent.click(screen.getByRole("checkbox", { name: /Show Core/ }));
    expect([...hidden[0]!]).toEqual(["core"]);
    rerender(
      <DensityScatterChart
        accessibleLabel="Lateral deviation"
        data={DATA}
        hiddenKeys={new Set(["core"])}
        legend={{ toggleControl: "checkbox" }}
        zones={LATERAL_ZONES}
      />,
    );
    expect(screen.getByRole("checkbox", { name: /Show Core/ })).not.toBeChecked();
  });

  it("sizes its surfaces from the layout box, not a transformed rect", () => {
    // Mounted under an ancestor that is mid `zoom-in-95` (ChartFrame's entrance, a
    // dialog's): the viewport rect is 95 % of the layout box, and the transform
    // ending fires no ResizeObserver. The canvases stretch to the layout box, so
    // a backing store sized from the rect paints the dots off the axes and zones.
    vi.spyOn(window, "ResizeObserver").mockImplementation(function (
      this: ResizeObserver,
      callback: ResizeObserverCallback,
    ) {
      return {
        observe: () => callback([], this),
        unobserve() {},
        disconnect() {},
      } as unknown as ResizeObserver;
    });
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(
      new DOMRect(0, 0, 608, 380),
    );
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(640);
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(400);
    // Pinned gutters: the auto gutters (tested below) would move the box.
    const { container } = render(
      <DensityScatterChart data={DATA} margin={{ left: 56, right: 12 }} />,
    );
    const points = container.querySelector<HTMLCanvasElement>(
      "[data-slot='density-scatter-chart-points']",
    )!;
    expect([points.width, points.height]).toEqual([640, 400]);
    // The overlay's plot box: 640 − 56 left − 12 right margin.
    expect(container.querySelector("clipPath rect")).toHaveAttribute("width", "572");
  });

  it("draws per-zone and overall stat lines, tags them and restates them", () => {
    vi.spyOn(window, "ResizeObserver").mockImplementation(function (
      this: ResizeObserver,
      callback: ResizeObserverCallback,
    ) {
      return {
        observe: () => callback([], this),
        unobserve() {},
        disconnect() {},
      } as unknown as ResizeObserver;
    });
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(900);
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(500);
    const { container } = render(
      <DensityScatterChart
        accessibleLabel="Lateral deviation"
        data={DATA}
        statLines={[{ value: "mean" }, { value: "median", by: "all" }]}
        zones={LATERAL_ZONES}
      />,
    );
    const lines = container.querySelectorAll("[data-slot='density-scatter-chart-stat-line']");
    // One mean per non-empty class (2 zones + outside) + one overall median.
    expect(lines.length).toBeGreaterThanOrEqual(2);
    const overall = [...lines].find((l) => l.getAttribute("stroke") === "var(--chart-foreground)");
    expect(overall).toBeDefined();
    expect(overall).toHaveAttribute("stroke-dasharray", "2 3");
    const tags = container.querySelectorAll("[data-slot='density-scatter-chart-stat-tag']");
    expect(tags.length).toBeGreaterThan(0);
    tags.forEach((t) => expect(t).toHaveAttribute("aria-hidden", "true"));
    expect(screen.getByRole("figure", { name: "Lateral deviation" })).toHaveAccessibleDescription(
      /reference lines: Core · Average y .*Median y /,
    );
  });

  it("widens the left gutter to fit long y tick labels", () => {
    vi.spyOn(window, "ResizeObserver").mockImplementation(function (
      this: ResizeObserver,
      callback: ResizeObserverCallback,
    ) {
      return {
        observe: () => callback([], this),
        unobserve() {},
        disconnect() {},
      } as unknown as ResizeObserver;
    });
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(640);
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(400);
    const width = (formatY: (v: number) => string) => {
      const { container, unmount } = render(
        <DensityScatterChart data={DATA} formatY={formatY} yLabel="Y" />,
      );
      const w = Number(container.querySelector("clipPath rect")!.getAttribute("width"));
      unmount();
      return w;
    };
    const short = width((v) => String(Math.round(v)));
    const long = width((v) => `${Math.round(v)} 000 000 000 units`);
    expect(long).toBeLessThan(short);
  });

  it("reports the renderer it could get", () => {
    const { container } = render(<DensityScatterChart data={DATA} />);
    // jsdom + the 2D stub → the Canvas-2D fallback, never WebGL.
    expect(container.querySelector("[data-slot='density-scatter-chart']")).toHaveAttribute(
      "data-renderer",
      "canvas2d",
    );
  });

  describe("canvas-only defaults (RM-185 review)", () => {
    // `cellSize`, `underlay`, `pointRadius` and `renderer` only ever reach a
    // <canvas> — jsdom's 2D stub always reports the SAME fallback kind
    // regardless of what was requested (the test above), so no rendered DOM
    // can tell an unset prop from its explicit default. Asserted directly
    // against the definition's `defaults` — what `useResolvedChartProps`
    // fills in and the component destructures and draws with (also pinned as
    // a whole by `DEFAULTS_GOLDEN.DensityScatterChart` in `definitions.test.ts`).
    it("resolves the same canvas defaults the component destructures", () => {
      expect(DENSITY_SCATTER_CHART.defaults).toMatchObject({
        cellSize: 5,
        underlay: 4,
        pointRadius: 1.35,
        renderer: "webgl",
      });
    });
  });
});

// ── RM-191 renames (ADR 0042 A.1) ────────────────────────────────────────────
//
// Each renamed prop: the old name renders the same DOM as the new one, warns once in
// development and never in production, the `./test` double stays silent under its default
// `deprecatedProps: "ignore"`, and when both names are set the new one wins (`new-wins`).

/** `container.innerHTML` with React's per-root `useId` values made comparable. */
const rm191Html = (container: HTMLElement) =>
  container.innerHTML.replace(/«r[0-9a-z]+»|:r[0-9a-z]+:|_r_[0-9a-z]+_/g, "«id»");

const rm191WarnSpy = () => vi.spyOn(console, "warn").mockImplementation(() => {});

describe("DensityScatterChart `labels` → `messages` (RM-191, row 4)", () => {
  afterEach(() => {
    cleanup();
    resetWarnOnce();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  const base = {
    accessibleLabel: "Lateral deviation",
    data: DATA,
    zones: LATERAL_ZONES,
    legend: true,
    renderer: "canvas2d" as const,
  };
  const WORDS = { outside: "Elsewhere", resetView: "Back to full view" };

  it("the old name renders the same DOM as the new one", () => {
    rm191WarnSpy();
    const renamed = render(<DensityScatterChart {...base} messages={WORDS} />).container;
    const old = render(<DensityScatterChart {...base} labels={WORDS} />).container;
    expect(rm191Html(old)).toBe(rm191Html(renamed));
    expect(old.textContent).toContain("Elsewhere");
  });

  it("warns once in development, however often it renders", () => {
    const warn = rm191WarnSpy();
    const { rerender } = render(<DensityScatterChart {...base} labels={WORDS} />);
    rerender(<DensityScatterChart {...base} labels={{ outside: "Beyond" }} />);
    render(<DensityScatterChart {...base} labels={WORDS} />);
    const renameWarnings = warn.mock.calls.filter(([m]) => String(m).includes('"labels"'));
    expect(renameWarnings).toEqual([
      [
        '[DensityScatterChart] "labels" is deprecated and will be removed in 7.0.0. Use "messages".',
      ],
    ]);
  });

  it("never warns in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    const warn = rm191WarnSpy();
    render(<DensityScatterChart {...base} labels={WORDS} />);
    expect(warn).not.toHaveBeenCalled();
  });

  it("the ./test double stays silent under its default", () => {
    const warn = rm191WarnSpy();
    render(<DensityScatterChartDouble {...base} labels={WORDS} />);
    expect(warn).not.toHaveBeenCalled();
  });

  it("`messages` also takes the `charts.*` words of the shared parts it renders", () => {
    const { container } = render(
      <DensityScatterChart
        {...base}
        messages={{ "charts.chart.loading": "Diagramm lädt…" }}
        status="loading"
      />,
    );
    expect(container.textContent).toContain("Diagramm lädt…");
  });

  it("both names set: `messages` wins", () => {
    rm191WarnSpy();
    const { container } = render(
      <DensityScatterChart {...base} labels={{ outside: "Old" }} messages={{ outside: "New" }} />,
    );
    expect(container.textContent).toContain("New");
    expect(container.textContent).not.toContain("Old");
  });
});

// ── RM-196: `xKey`/`yKey` → `xDataKey`/`yDataKey` (ADR 0042 A.6 rows 34–35) ──
//
// `xDataKey`/`yDataKey` keep `xKey`/`yKey`'s second role: the field name a
// range gesture's `ChartSelectionIntent` carries when `selectionField` /
// `selectionFieldY` are unset (`density-scatter-chart.tsx:1031`). That field
// is a real, observable DOM-adjacent effect (unlike the row-key-lookup role,
// invisible here since `DATA` is columns-shaped, not rows) — a non-default
// value proves the alias resolved, and the default ("x"/"y") gives the
// unset-render baseline to differ from.

describe("DensityScatterChart `xKey`/`yKey` → `xDataKey`/`yDataKey` (RM-196, rows 34–35)", () => {
  afterEach(() => {
    cleanup();
    resetWarnOnce();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  /** The field name the first range intent on one axis carries. */
  function intentField(axis: "x" | "y", props: Record<string, unknown>): string | undefined {
    const intents: ChartSelectionIntent[] = [];
    render(
      <DensityScatterChart
        accessibleLabel="Lateral deviation"
        data={DATA}
        onSelectionIntent={(i) => intents.push(i)}
        selectionGestures={["range"]}
        zones={LATERAL_ZONES}
        {...props}
      />,
    );
    const thumb = screen.getByRole("slider", { name: `Range start, ${axis}` });
    fireEvent.keyDown(thumb, { key: "ArrowRight" });
    return intents[0]?.field;
  }

  const rows = [
    { from: "xKey", to: "xDataKey", axis: "x" as const, value: "along" },
    { from: "yKey", to: "yDataKey", axis: "y" as const, value: "across" },
  ];

  it.each(rows)(
    "$from and $to both drive the range intent's field, and differ from the unset default",
    ({ axis, value }) => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const fromKey = axis === "x" ? "xKey" : "yKey";
      const fromDataKey = axis === "x" ? "xDataKey" : "yDataKey";
      const viaOld = intentField(axis, { [fromKey]: value });
      cleanup();
      const viaNew = intentField(axis, { [fromDataKey]: value });
      cleanup();
      const viaUnset = intentField(axis, {});
      expect(viaOld).toBe(value);
      expect(viaOld).toBe(viaNew);
      expect(viaOld).not.toBe(viaUnset);
    },
  );

  it.each(rows)("$from warns once in development, naming $to", ({ from, to, axis, value }) => {
    const warn = rm191WarnSpy();
    const fromKey = from as "xKey" | "yKey";
    intentField(axis, { [fromKey]: value });
    cleanup();
    intentField(axis, { [fromKey]: value });
    const renameWarnings = warn.mock.calls.filter(([m]) => String(m).includes(`"${from}"`));
    expect(renameWarnings).toEqual([
      [`[DensityScatterChart] "${from}" is deprecated and will be removed in 7.0.0. Use "${to}".`],
    ]);
  });

  it.each(rows)("$from never warns in production", ({ from, axis, value }) => {
    vi.stubEnv("NODE_ENV", "production");
    const warn = rm191WarnSpy();
    const fromKey = from as "xKey" | "yKey";
    intentField(axis, { [fromKey]: value });
    expect(warn).not.toHaveBeenCalled();
  });

  it.each(rows)(
    "$from keeps the ./test double silent under the default deprecatedProps",
    ({ from, value }) => {
      const warn = rm191WarnSpy();
      const fromKey = from as "xKey" | "yKey";
      render(<DensityScatterChartDouble data={DATA} {...{ [fromKey]: value }} />);
      expect(warn).not.toHaveBeenCalled();
    },
  );

  it("new-wins: xDataKey/yDataKey beat xKey/yKey when both are given", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(intentField("x", { xKey: "wrong", xDataKey: "along" })).toBe("along");
  });
});
