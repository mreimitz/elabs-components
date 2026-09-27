/**
 * RadarChart smoke test.
 *
 * ChartParentSize uses ResizeObserver + DOM measurement which
 * jsdom does not support. We mock it to supply a fixed size so RadarChartInner
 * actually renders. Real rendering (SVG paths, animation, hover) is covered by
 * the Storybook build / test-storybook run (the @elabs-ai/components-editor / @elabs-ai/components-flow
 * precedent for engine-heavy components).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import type * as MotionReact from "motion/react";
import { resetWarnOnce } from "@elabs-ai/components-ui/definition";
import { RadarChart } from "./radar-chart";
import { RadarGrid } from "./radar-grid";
import { RadarAxis } from "./radar-axis";
import { RadarArea } from "./radar-area";
import { RadarChart as RadarChartDouble } from "../test";
import type { RadarData, RadarMetric } from "./radar-context";
import { LocaleProvider } from "@elabs-ai/components-ui";

// RM-196: `animationDuration`/`enterStaggerScale` scale the entry animation's
// computed delay (`radar-area.tsx`'s `animationDelay`), which only reaches the
// DOM through `motion/react`'s `animate(progress, 1, { delay, ... })` — jsdom
// never runs a real rAF, so `useMotionValue`'s progress stays 0 at first paint
// REGARDLESS of duration/stagger (see the "under reduced motion" describe
// below: `cx`/`cy` are "0" for every value). Static markup therefore cannot
// distinguish two different non-default values, so the RM-196 alias test below
// spies on `animate` itself (same technique as `funnel-chart.test.tsx`) and
// reads the `delay` it was actually called with.
const animateSpy = vi.hoisted(() => vi.fn(() => ({ stop: vi.fn() })));
vi.mock("motion/react", async (importOriginal) => {
  const actual = await importOriginal<typeof MotionReact>();
  return { ...actual, animate: animateSpy };
});

// Mock ChartParentSize so it passes a fixed size in jsdom. The size
// is mutable (via `setMockParentSize`, reset in `afterEach`) so one test below
// can exercise a non-square host box without disturbing every other test's
// default 300x300 square.
const { getMockParentSize, setMockParentSize } = vi.hoisted(() => {
  let size = { width: 300, height: 300 };
  return {
    getMockParentSize: () => size,
    setMockParentSize: (next: { width: number; height: number }) => {
      size = next;
    },
  };
});
// The one reduced-motion source (RM-189): the tokens hook, switched per test.
const motionState = vi.hoisted(() => ({ reduced: false }));
vi.mock("@elabs-ai/components-tokens", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useReducedMotion: () => motionState.reduced,
}));

vi.mock("./chart-parent-size", () => ({
  ChartParentSize: ({
    children,
  }: {
    children: (size: { width: number; height: number }) => React.ReactNode;
  }) => <>{children(getMockParentSize())}</>,
}));

const metrics: RadarMetric[] = [
  { key: "speed", label: "Speed" },
  { key: "reliability", label: "Reliability" },
  { key: "comfort", label: "Comfort" },
];

const data: RadarData[] = [
  {
    label: "Series A",
    values: { speed: 80, reliability: 70, comfort: 60 },
  },
];

describe("RadarChart", () => {
  it("is exported as a renderable React component", () => {
    // forwardRef returns an object ({ $$typeof, render }), not a bare function —
    // check it is non-null and has a displayName so callers can use it.
    expect(RadarChart).toBeTruthy();
    expect(RadarChart.displayName).toBe("RadarChart");
  });

  it("mounts with fixed size and children without throwing", () => {
    const { container } = render(
      <RadarChart data={data} metrics={metrics} size={300} animate={false}>
        <RadarGrid />
        <RadarAxis />
        <RadarArea index={0} />
      </RadarChart>,
    );
    expect(container.firstChild).toBeInTheDocument();
  });

  it("mounts in responsive (ParentSize) mode without throwing", () => {
    const { container } = render(
      <RadarChart data={data} metrics={metrics} animate={false}>
        <RadarGrid />
        <RadarAxis />
        <RadarArea index={0} />
      </RadarChart>,
    );
    expect(container.firstChild).toBeInTheDocument();
  });

  it("forwards a ref to the root div", () => {
    const ref = { current: null as HTMLDivElement | null };
    render(
      <RadarChart data={data} metrics={metrics} size={300} animate={false} ref={ref}>
        <RadarArea index={0} />
      </RadarChart>,
    );
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });

  it("merges a custom className onto the root div", () => {
    const { container } = render(
      <RadarChart data={data} metrics={metrics} size={300} animate={false} className="test-class">
        <RadarArea index={0} />
      </RadarChart>,
    );
    expect((container.firstChild as HTMLElement).classList).toContain("test-class");
  });

  it("adds role/aria-label/tabIndex when accessibleLabel is provided (fixed size)", () => {
    const { container } = render(
      <RadarChart
        data={data}
        metrics={metrics}
        size={300}
        animate={false}
        accessibleLabel="Performance radar chart"
        accessibleDescription="Series A: Speed 80, Reliability 70, Comfort 60."
      >
        <RadarArea index={0} />
      </RadarChart>,
    );
    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute("role")).toBe("figure");
    expect(root.getAttribute("aria-label")).toBe("Performance radar chart");
    expect(root.getAttribute("tabindex")).toBe("0");
    const descSpan = root.querySelector("span.sr-only");
    expect(descSpan).toBeInTheDocument();
    expect(descSpan?.textContent).toBe("Series A: Speed 80, Reliability 70, Comfort 60.");
  });

  it("does NOT add role/aria-label when accessibleLabel is absent", () => {
    const { container } = render(
      <RadarChart data={data} metrics={metrics} size={300} animate={false}>
        <RadarArea index={0} />
      </RadarChart>,
    );
    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute("role")).toBeNull();
    expect(root.getAttribute("aria-label")).toBeNull();
    expect(root.getAttribute("tabindex")).toBeNull();
  });
});

// RM-183 review: confirms RadarChart re-draws once `status` flips from
// "loading" to "ready" — Radar measures through `ParentSize` (mocked above to
// answer synchronously on every render), not a mount-only `ResizeObserver`
// effect, so no fix was needed here.
describe("RadarChart re-renders after status flips from loading to ready", () => {
  // Excludes the loading spinner's own `<path>`s (`StatePanel`'s `DefaultSpinner`
  // renders an `animate-spin` svg) — only Radar's own area path counts as
  // "marks drawn" here.
  function radarPaths(container: HTMLElement) {
    return Array.from(container.querySelectorAll("svg path")).filter(
      (path) => !path.closest("svg.animate-spin"),
    );
  }

  it("draws the series area once status goes from loading to ready", () => {
    const { container, rerender } = render(
      <RadarChart data={data} metrics={metrics} size={300} animate={false} status="loading">
        <RadarArea index={0} />
      </RadarChart>,
    );
    expect(radarPaths(container)).toHaveLength(0);

    rerender(
      <RadarChart data={data} metrics={metrics} size={300} animate={false} status="ready">
        <RadarArea index={0} />
      </RadarChart>,
    );
    expect(radarPaths(container).length).toBeGreaterThan(0);
  });
});

// RM-183 review (F33): RadarChart's `margin` widened from a plain `number` to
// the frame-size group's `number | Partial<Margin>` — resolved via
// `resolveChartMargin` into a radius inset, never a CSS box (Radar has no
// `padding`/`inset` style at all; the group's own doc calls this out).
describe("RadarChart margin (frame-size group, F33)", () => {
  function groupTransform(container: HTMLElement) {
    return container.querySelector("g.visx-group")?.getAttribute("transform");
  }

  it("centers on a 300x300 box at the default (60) margin", () => {
    const { container } = render(
      <RadarChart data={data} metrics={metrics} size={300} animate={false}>
        <RadarArea index={0} />
      </RadarChart>,
    );
    expect(groupTransform(container)).toBe("translate(150, 150)");
  });

  it("centers on a 300x300 box for an explicit uniform number margin", () => {
    const { container } = render(
      <RadarChart data={data} metrics={metrics} size={300} animate={false} margin={0}>
        <RadarArea index={0} />
      </RadarChart>,
    );
    expect(groupTransform(container)).toBe("translate(150, 150)");
  });

  it("shifts the center for an asymmetric partial Margin object", () => {
    const { container } = render(
      <RadarChart data={data} metrics={metrics} size={300} animate={false} margin={{ left: 100 }}>
        <RadarArea index={0} />
      </RadarChart>,
    );
    // left:100, right/top/bottom fall back to the 60 default →
    // contentW = 300 - 100 - 60 = 140, cx = 100 + 140/2 = 170; cy stays 150.
    expect(groupTransform(container)).toBe("translate(170, 150)");
  });
});

// RM-183 review (major, 2026-09-26): a non-square host box (a wide
// ParentSize measurement, e.g. a fixed `plotHeight`) MUST NOT stretch the SVG
// to the full width — Radar draws a `min(width, height)` square flush with
// the box's short side, exactly as it did before the frame-size group
// existed. A prior draft centred the square inside the full rect instead
// (a silent visual regression for every non-square Radar host); this locks
// the old geometry down.
describe("RadarChart on a non-square ParentSize box (F33 review)", () => {
  afterEach(() => {
    setMockParentSize({ width: 300, height: 300 });
  });

  it("draws a min(width,height) square flush with the short side, not centered in the full box", () => {
    setMockParentSize({ width: 600, height: 280 });
    const { container } = render(
      <RadarChart data={data} metrics={metrics} animate={false} plotHeight={280}>
        <RadarArea index={0} />
      </RadarChart>,
    );
    const svg = container.querySelector("svg[aria-hidden='true']");
    expect(svg?.getAttribute("width")).toBe("280");
    expect(svg?.getAttribute("height")).toBe("280");
    const transform = container.querySelector("g.visx-group")?.getAttribute("transform");
    expect(transform).toBe("translate(140, 140)");
  });
});

// RM-183 review (fix3): `RadarChartProps` kept only `valueFormat`/`currency`
// from the value-format group; RM-187 adds `locale`/`maxFractionDigits`
// through `useContainerLegend`'s new seam. Every member must genuinely change
// the legend's printed value column, only visible with `legend={{ values: true }}`.
describe("RadarChart value-format group (fix3)", () => {
  const bigData: RadarData[] = [
    { label: "Series A", values: { speed: 400_000, reliability: 300_000, comfort: 300_000 } },
  ];

  it("valueFormat changes the legend's value column text", () => {
    const { container: unset } = render(
      <RadarChart
        animate={false}
        data={bigData}
        legend={{ values: true }}
        metrics={metrics}
        size={300}
      >
        <RadarArea index={0} />
      </RadarChart>,
    );
    const { container: compact } = render(
      <RadarChart
        animate={false}
        data={bigData}
        legend={{ values: true }}
        metrics={metrics}
        size={300}
        valueFormat="compact"
      >
        <RadarArea index={0} />
      </RadarChart>,
    );
    const unsetText = unset.querySelector('[data-slot="chart-legend"]')?.textContent ?? "";
    const compactText = compact.querySelector('[data-slot="chart-legend"]')?.textContent ?? "";
    expect(unsetText).toContain("1,000,000");
    expect(compactText).toContain("1M");
    expect(compactText).not.toContain("1,000,000");
  });

  it("currency changes the legend's value column text", () => {
    const { container: withoutCurrency } = render(
      <RadarChart
        animate={false}
        data={data}
        legend={{ values: true }}
        metrics={metrics}
        size={300}
        valueFormat="currency"
      >
        <RadarArea index={0} />
      </RadarChart>,
    );
    const { container: withCurrency } = render(
      <RadarChart
        animate={false}
        currency="EUR"
        data={data}
        legend={{ values: true }}
        metrics={metrics}
        size={300}
        valueFormat="currency"
      >
        <RadarArea index={0} />
      </RadarChart>,
    );
    const withoutText =
      withoutCurrency.querySelector('[data-slot="chart-legend"]')?.textContent ?? "";
    const withText = withCurrency.querySelector('[data-slot="chart-legend"]')?.textContent ?? "";
    expect(withText).toContain("€");
    expect(withoutText).not.toContain("€");
  });

  // RM-187: the legend's value column reads the chart's own locale and digits.
  const preciseData: RadarData[] = [
    { label: "Series A", values: { speed: 1234.567, reliability: 1000, comfort: 1000 } },
  ];

  it("maxFractionDigits reaches the legend's value column (RM-187)", () => {
    const legendText = (props: { maxFractionDigits?: number }) => {
      const { container } = render(
        <RadarChart
          animate={false}
          data={preciseData}
          legend={{ values: true }}
          metrics={metrics}
          size={300}
          valueFormat="number"
          {...props}
        >
          <RadarArea index={0} />
        </RadarChart>,
      );
      return container.querySelector('[data-slot="chart-legend"]')?.textContent ?? "";
    };
    expect(legendText({})).toContain("3,234.567");
    expect(legendText({ maxFractionDigits: 0 })).toContain("3,235");
    expect(legendText({ maxFractionDigits: 0 })).not.toContain("3,234.567");
  });

  it("locale reaches the legend's value column, over the LocaleProvider's (RM-187)", () => {
    const { container } = render(
      <LocaleProvider locale="en-US">
        <RadarChart
          animate={false}
          data={preciseData}
          legend={{ values: true }}
          locale="de-DE"
          metrics={metrics}
          size={300}
          valueFormat="number"
        >
          <RadarArea index={0} />
        </RadarChart>
      </LocaleProvider>,
    );
    const text = container.querySelector('[data-slot="chart-legend"]')?.textContent ?? "";
    expect(text).toContain("3.234,567");
  });
});

describe("RadarArea under reduced motion (RM-189)", () => {
  afterEach(() => {
    motionState.reduced = false;
  });

  /** An animated radar with one area and its points, as first painted. */
  function renderAnimatedRadar() {
    return render(
      <RadarChart data={data} metrics={metrics} size={300}>
        <RadarArea index={0} />
      </RadarChart>,
    );
  }

  it("mounts the area whole: points at their values, no fade-in", () => {
    motionState.reduced = true;
    const { container } = renderAnimatedRadar();
    const points = Array.from(container.querySelectorAll("circle"));
    expect(points).toHaveLength(metrics.length);
    // No sweep from the centre: every point already sits at its own value.
    expect(
      points.some((point) => point.getAttribute("cx") !== "0" || point.getAttribute("cy") !== "0"),
    ).toBe(true);
    // No fade-in: the area group never starts transparent.
    const group = points[0]?.closest("g");
    expect(group?.getAttribute("style") ?? "").not.toMatch(/opacity:\s*0(?![.\d])/);
  });

  it("still sweeps the area in from the centre when motion is allowed", () => {
    const { container } = renderAnimatedRadar();
    const points = Array.from(container.querySelectorAll("circle"));
    expect(points).toHaveLength(metrics.length);
    for (const point of points) {
      expect(point.getAttribute("cx")).toBe("0");
      expect(point.getAttribute("cy")).toBe("0");
    }
  });
});

// ── RM-196: renamed motion props (ADR 0042 A.6 rows 36–38) ──────────────────

/** The `console.warn` calls that are deprecation warnings. */
const deprecations = (spy: { mock: { calls: unknown[][] } }) =>
  spy.mock.calls.filter(([message]) => String(message).includes("is deprecated"));

/** The `delay` `useMountProgress` (`RadarArea`) passed to the mocked `animate`. */
function lastAnimateDelay(): number | undefined {
  const call = animateSpy.mock.calls.at(-1) as [unknown, unknown, { delay?: number }] | undefined;
  return call?.[2]?.delay;
}

describe("RadarChart renamed motion props (RM-196)", () => {
  afterEach(() => {
    animateSpy.mockClear();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  function renderOneArea(props: Record<string, unknown>) {
    return render(
      <RadarChart data={data} metrics={metrics} size={300} {...props}>
        <RadarArea index={0} />
      </RadarChart>,
    );
  }

  it(
    "enterDurationMs/staggerScale reach the SAME computed entry delay as " +
      "animationDuration/enterStaggerScale, which differs from the unset default",
    () => {
      const viaOld = renderOneArea({ enterDurationMs: 2200, staggerScale: 3 });
      const oldDelay = lastAnimateDelay();
      viaOld.unmount();
      animateSpy.mockClear();

      const viaNew = renderOneArea({ animationDuration: 2200, enterStaggerScale: 3 });
      const newDelay = lastAnimateDelay();
      viaNew.unmount();
      animateSpy.mockClear();

      const viaDefault = renderOneArea({});
      const defaultDelay = lastAnimateDelay();
      viaDefault.unmount();

      expect(oldDelay).toBeDefined();
      expect(oldDelay).toBe(newDelay);
      expect(oldDelay).not.toBe(defaultDelay);
    },
  );

  it("revealSignature (or its deprecated alias motionReplayKey) changing on a rerender replays the entry", () => {
    const { rerender } = renderOneArea({ motionReplayKey: "v1" });
    animateSpy.mockClear();

    // Same value again: `useMountProgress`'s effect dependency (`replayKey`) is
    // unchanged, so the entry does not replay.
    rerender(
      <RadarChart data={data} metrics={metrics} size={300} motionReplayKey="v1">
        <RadarArea index={0} />
      </RadarChart>,
    );
    expect(animateSpy).not.toHaveBeenCalled();

    // A new value — given through the NEW name this time, proving both names
    // drive the same replay key — retriggers the entry animation.
    rerender(
      <RadarChart data={data} metrics={metrics} size={300} revealSignature="v2">
        <RadarArea index={0} />
      </RadarChart>,
    );
    expect(animateSpy).toHaveBeenCalledTimes(1);
  });

  const rows = [
    { from: "enterDurationMs", to: "animationDuration", old: { enterDurationMs: 2200 } },
    { from: "staggerScale", to: "enterStaggerScale", old: { staggerScale: 3 } },
    { from: "motionReplayKey", to: "revealSignature", old: { motionReplayKey: "v1" } },
  ];

  it.each(rows)("$from warns once in development, naming $to", ({ from, to, old }) => {
    resetWarnOnce();
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    renderOneArea(old).unmount();
    renderOneArea(old).unmount();
    expect(deprecations(spy)).toEqual([
      [`[RadarChart] "${from}" is deprecated and will be removed in 6.0.0. Use "${to}".`],
    ]);
  });

  it.each(rows)("$from never warns in production", ({ old }) => {
    resetWarnOnce();
    vi.stubEnv("NODE_ENV", "production");
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    renderOneArea(old).unmount();
    expect(deprecations(spy)).toEqual([]);
  });

  it.each(rows)(
    "$from keeps the ./test double silent under the default deprecatedProps",
    ({ old }) => {
      resetWarnOnce();
      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
      render(
        <RadarChartDouble data={data} metrics={metrics} {...old}>
          <RadarArea index={0} />
        </RadarChartDouble>,
      ).unmount();
      expect(spy).not.toHaveBeenCalled();
    },
  );
});
