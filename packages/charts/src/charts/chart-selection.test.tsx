/**
 * Selection input contract (RM-073, #437): the pure resolver, the paint flags,
 * and the BarChart mark rendering — including the byte-identical opt-out.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@visx/responsive", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- vi.mock factory is hoisted; lazy require avoids TDZ
  const React = require("react");
  return {
    ParentSize: ({
      children,
    }: {
      children: (size: { width: number; height: number }) => React.ReactNode;
    }) => React.createElement(React.Fragment, null, children({ width: 560, height: 288 })),
  };
});

vi.mock("react-use-measure", () => ({
  default: () => [() => undefined, { width: 560, height: 288 }],
}));

import { Bar } from "./bar";
import { BarChart } from "./bar-chart";
import { SELECTION_FIXTURES } from "./__baselines__/selection-opt-out/fixtures";
import {
  EXCLUDED_FRAME_COLOR,
  SELECTED_OUTLINE_COLOR,
  SELECTED_OUTLINE_CORE_COLOR,
  SELECTION_EXCLUDED_OPACITY,
  markSelectionPaint,
  resolveMarkState,
  type SelectionState,
} from "./chart-selection";
import { seriesPatternFills, stubHighDecoration } from "./high-decoration-fixture";
import { compositeOver, contrastOf, resolveCssColor, type Rgba } from "./on-mark-ink";

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
  // jsdom has no SVG geometry; `<Line>`/`<Area>` measure their path length.
  Object.defineProperty(SVGElement.prototype, "getTotalLength", {
    configurable: true,
    value: () => 100,
  });
});

afterEach(cleanup);

const data = [
  { region: "EMEA", sales: 12 },
  { region: "APAC", sales: 24 },
  { region: "AMER", sales: 8 },
];

const STATES: Record<string, SelectionState> = {
  EMEA: "selected",
  APAC: "associated",
  AMER: "excluded",
};
const byRegion = (category: string | number | Date) => STATES[String(category)] ?? "associated";

describe("resolveMarkState", () => {
  it("is undefined without a resolver or a category", () => {
    expect(resolveMarkState(undefined, { category: "EMEA" })).toBeUndefined();
    expect(
      resolveMarkState({ selectionStates: byRegion }, { category: undefined }),
    ).toBeUndefined();
  });

  it("passes category, series key and datum to the resolver", () => {
    const resolver = vi.fn(() => "excluded" as const);
    const datum = { region: "EMEA" };
    expect(
      resolveMarkState(
        { selectionStates: resolver },
        { category: "EMEA", datum, seriesKey: "sales" },
      ),
    ).toBe("excluded");
    expect(resolver).toHaveBeenCalledWith("EMEA", "sales", datum);
  });
});

describe("markSelectionPaint", () => {
  it("dims excluded only while dimExcluded is on, outlines selected", () => {
    expect(markSelectionPaint("excluded")).toMatchObject({ dimmed: true, outlined: false });
    expect(markSelectionPaint("excluded", false)).toMatchObject({
      "data-selection": "excluded",
      dimmed: false,
    });
    expect(markSelectionPaint("selected")).toMatchObject({ dimmed: false, outlined: true });
    expect(markSelectionPaint("associated")).toMatchObject({ dimmed: false, outlined: false });
    expect(markSelectionPaint(undefined)["data-selection"]).toBeUndefined();
  });
});

function renderBars(props: Partial<React.ComponentProps<typeof BarChart>> = {}) {
  return render(
    <BarChart animationDuration={0} data={data} xDataKey="region" {...props}>
      <Bar animate={false} dataKey="sales" />
    </BarChart>,
  );
}

describe("BarChart selectionStates", () => {
  it("paints each state with a non-hue channel", () => {
    const { container } = renderBars({ selectionStates: byRegion });
    const selected = container.querySelector('[data-selection="selected"]');
    const associated = container.querySelector('[data-selection="associated"]');
    const excluded = container.querySelector('[data-selection="excluded"]');

    const outline = selected?.querySelector('[data-slot="chart-selection-mark-outline"]');
    const core = selected?.querySelector('[data-slot="chart-selection-mark-outline-core"]');
    expect(outline?.getAttribute("stroke")).toBe(SELECTED_OUTLINE_COLOR);
    expect(core?.getAttribute("stroke")).toBe(SELECTED_OUTLINE_CORE_COLOR);
    expect(selected?.querySelector('[data-slot="chart-selection-mark-dim"]')).toBeNull();
    expect(associated?.querySelector('[data-slot^="chart-selection-mark-"]')).toBeNull();
    const dim = excluded?.querySelector('[data-slot="chart-selection-mark-dim"]');
    expect(dim?.getAttribute("opacity")).toBe(String(SELECTION_EXCLUDED_OPACITY));
    const frame = excluded?.querySelector('[data-slot="chart-selection-mark-frame"]');
    expect(frame?.getAttribute("stroke")).toBe(EXCLUDED_FRAME_COLOR);
    expect(frame?.getAttribute("stroke-dasharray")).toBeTruthy();
  });

  // #446 — the channel must not inherit the dim of the mark it rescues.
  it("paints the excluded frame outside the dimmed group, at full opacity", () => {
    const { container } = renderBars({ selectionStates: byRegion });
    const frame = container.querySelector('[data-slot="chart-selection-mark-frame"]');
    expect(frame).not.toBeNull();
    for (let el: Element | null = frame; el && el !== container; el = el.parentElement) {
      expect(el.getAttribute("opacity") ?? "1").toBe("1");
    }
  });

  it("keeps the attribute but paints nothing with dimExcluded={false}", () => {
    const { container } = renderBars({ dimExcluded: false, selectionStates: byRegion });
    const excluded = container.querySelector('[data-selection="excluded"]');
    expect(excluded).not.toBeNull();
    expect(excluded?.querySelector('[data-slot="chart-selection-mark-dim"]')).toBeNull();
    expect(excluded?.querySelector('[data-slot="chart-selection-mark-frame"]')).toBeNull();
  });

  // #443 — at high decoration every bar carries a series pattern, so the
  // excluded channel must be one the decoration never paints.
  it("keeps the excluded channel apart from the decoration pattern at decoration 10", () => {
    stubHighDecoration("10");
    try {
      const { container } = renderBars({ selectionStates: byRegion });
      const associated = container.querySelector('[data-selection="associated"]');
      const excluded = container.querySelector('[data-selection="excluded"]');
      expect(seriesPatternFills(associated as Element).length).toBeGreaterThan(0);
      expect(seriesPatternFills(excluded as Element).length).toBeGreaterThan(0);
      expect(excluded?.querySelector('[data-slot="chart-selection-mark-frame"]')).not.toBeNull();
      expect(associated?.querySelector("[stroke-dasharray]")).toBeNull();
    } finally {
      vi.restoreAllMocks();
    }
  });
});

// ── Contrast in every shipped theme (#442, #446) ─────────────────────────────

const TOKENS_SRC = join(__dirname, "../../../tokens/src");
const COMMUNITY = join(__dirname, "../../../../themes");

/** `--token: value;` declarations of a CSS text, comments blanked. */
function declarations(css: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
    if (m[1] && m[2]) out[m[1]] = m[2].trim();
  }
  return out;
}

/** Every shipped theme's token map, layered over the `:root` engine block. */
function shippedThemes(): [string, Record<string, string>][] {
  const engine = readFileSync(join(TOKENS_SRC, "themes.css"), "utf8");
  const root = declarations(/:root\s*\{([\s\S]*?)\n\}/.exec(engine)?.[1] ?? "");
  const files = ["light", "dark"].map((t) => join(TOKENS_SRC, "themes", `${t}.css`));
  for (const family of readdirSync(COMMUNITY, { withFileTypes: true })) {
    if (!family.isDirectory()) continue;
    for (const file of readdirSync(join(COMMUNITY, family.name))) {
      if (new RegExp(`^${family.name}-[a-z]+\\.css$`).test(file) && !file.endsWith("-fonts.css")) {
        files.push(join(COMMUNITY, family.name, file));
      }
    }
  }
  return files.map((file) => {
    const css = readFileSync(file, "utf8");
    const name = /\[data-theme="([^"]+)"\]/.exec(css)?.[1] ?? file;
    return [name, { ...root, ...declarations(css) }];
  });
}

const THEMES = shippedThemes();

describe.each(THEMES)("selection contrast in %s", (_theme, tokens) => {
  const color = (value: string): Rgba => {
    const rgba = resolveCssColor(value, (name) => tokens[name] ?? "");
    if (!rgba) throw new Error(`unresolvable ${value}`);
    return rgba;
  };
  const surface = color("var(--chart-background)");
  const fills = Object.keys(tokens)
    .filter((name) => /^--chart-\d+$/.test(name))
    .map((name) => [name, color(`var(${name})`)] as const);

  it("covers the series palette", () => {
    expect(fills.length).toBeGreaterThanOrEqual(8);
  });

  it("selected outline clears 3:1 against the surface and against every series fill", () => {
    const outer = color(SELECTED_OUTLINE_COLOR);
    const core = color(SELECTED_OUTLINE_CORE_COLOR);
    expect(contrastOf(outer, surface)).toBeGreaterThanOrEqual(3);
    for (const [, fill] of fills) {
      expect(Math.max(contrastOf(outer, fill), contrastOf(core, fill))).toBeGreaterThanOrEqual(3);
    }
  });

  it("excluded frame clears 3:1 against the surface and every dimmed series fill", () => {
    const frame = color(EXCLUDED_FRAME_COLOR);
    expect(contrastOf(frame, surface)).toBeGreaterThanOrEqual(3);
    for (const [, fill] of fills) {
      const ghost = compositeOver(fill, surface, SELECTION_EXCLUDED_OPACITY);
      expect(contrastOf(frame, ghost)).toBeGreaterThanOrEqual(3);
    }
  });
});

// ── Every family (RM-073) ────────────────────────────────────────────────────

/**
 * Resolves by category, falling back to the datum's region — Scatter's category
 * is its continuous x (`step`), so it keys on the datum instead.
 */
const byLabel = (
  category: string | number | Date,
  _seriesKey?: string,
  datum?: Record<string, unknown>,
): SelectionState =>
  STATES[String(category)] ??
  (datum?.region === undefined ? undefined : STATES[String(datum.region)]) ??
  "associated";

/** Where a family paints its selection overlays: the shared mark or the series layer. */
const SLOT_PREFIX: Record<string, string> = {
  "area-chart": "chart-selection-series-layer",
  "composed-chart": "chart-selection-series-layer",
  "line-chart": "chart-selection-series-layer",
};
const slotPrefix = (name: string) => SLOT_PREFIX[name] ?? "chart-selection-mark";

/** Families whose datapoint layer is exercised for the ", selected" suffix. */
const ANNOUNCED = new Set(["line-chart", "area-chart", "pie-chart", "ring-chart"]);

/**
 * `useId` output (`_r_4_`, React 19) depends on how many components mounted
 * before in the process, so it is the ONE thing normalised; every other byte
 * must match the baseline.
 */
const normaliseIds = (html: string) => html.replace(/_r_[a-z0-9]+_/g, "_r_");

const baseline = (name: string) =>
  readFileSync(join(__dirname, "__baselines__/selection-opt-out", `${name}.baseline.txt`), "utf8");

describe.each(SELECTION_FIXTURES)(
  "$name selectionStates",
  ({ measured, name, render: element }) => {
    beforeEach(() => {
      if (!measured) return;
      vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
        bottom: 300,
        height: 300,
        left: 0,
        right: 600,
        toJSON: () => ({}),
        top: 0,
        width: 600,
        x: 0,
        y: 0,
      } as DOMRect);
    });
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("renders the pre-RM-073 DOM (baseline generated at 9d119df6) without selectionStates", () => {
      const html = render(element({})).container.innerHTML;
      expect(normaliseIds(`${html}\n`)).toBe(normaliseIds(baseline(name)));
      expect(html).not.toContain("data-selection");
    });

    it("paints the three states apart without hue", () => {
      const { container } = render(element({ selectionStates: byLabel }));
      const excluded = container.querySelectorAll('[data-selection="excluded"]');
      const selected = container.querySelectorAll('[data-selection="selected"]');
      expect(container.querySelector('[data-selection="associated"]')).not.toBeNull();
      expect(excluded.length).toBeGreaterThan(0);
      expect(selected.length).toBeGreaterThan(0);
      const prefix = slotPrefix(name);
      for (const node of excluded) {
        const dimmed =
          node.querySelector(`[data-slot="${prefix}-dim"]`)?.getAttribute("opacity") ===
            String(SELECTION_EXCLUDED_OPACITY) ||
          node.querySelector('[data-slot$="-veil"]') !== null;
        expect(dimmed).toBe(true);
        const frame = node.querySelector(`[data-slot="${prefix}-frame"]`);
        expect(frame?.getAttribute("stroke")).toBe(EXCLUDED_FRAME_COLOR);
        expect(frame).not.toBeNull();
        for (let el: Element | null = frame; el && el !== container; el = el.parentElement) {
          expect(`${el.getAttribute("data-slot")}: ${el.getAttribute("opacity") ?? "1"}`).toBe(
            `${el.getAttribute("data-slot")}: 1`,
          );
        }
      }
      for (const node of selected) {
        expect(node.querySelector(`[data-slot="${prefix}-outline"]`)).not.toBeNull();
        expect(node.querySelector(`[data-slot="${prefix}-outline-core"]`)).not.toBeNull();
      }
    });

    it.runIf(ANNOUNCED.has(name))("announces selected and excluded datapoints by name", () => {
      const { container } = render(
        element({ onDatapointClick: () => {}, selectionStates: byLabel }),
      );
      const names = Array.from(container.querySelectorAll("button[aria-label]")).map((b) =>
        b.getAttribute("aria-label"),
      );
      expect(names.some((label) => label?.endsWith(", selected"))).toBe(true);
      expect(names.some((label) => label?.endsWith(", excluded"))).toBe(true);
    });
  },
);
