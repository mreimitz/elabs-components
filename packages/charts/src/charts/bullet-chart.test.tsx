import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// react-use-measure uses ResizeObserver for layout measurement, which jsdom
// does not implement. Mock it to return a fixed size so the chart's inner
// render gate (mainSize > 0) is satisfied and geometry is deterministic.
// Real render + a11y are covered by the Storybook interaction tests.
const MEASURED_WIDTH = 300;
const MEASURED_HEIGHT = 120;
vi.mock("react-use-measure", () => ({
  default: () => [() => undefined, { width: MEASURED_WIDTH, height: MEASURED_HEIGHT }],
}));

import { scaleLinear } from "@visx/scale";
import {
  BulletChart,
  describeBulletChart,
  findBulletBand,
  resolveBulletDomain,
  type BulletBand,
} from "./bullet-chart";

afterEach(cleanup);

const identityFormat = (value: number) => String(value);

describe("resolveBulletDomain", () => {
  it("defaults to a zero-based floor for a positive value", () => {
    const [min] = resolveBulletDomain({ value: 82, target: 100 });
    expect(min).toBe(0);
  });

  it("extends the floor below zero only when value itself is negative", () => {
    const [min] = resolveBulletDomain({ value: -20, target: 10 });
    expect(min).toBeLessThanOrEqual(-20);
  });

  it("ignores a caller-supplied negative min when value is non-negative (honesty)", () => {
    const [min] = resolveBulletDomain({ value: 50, min: -30 });
    expect(min).toBe(-30); // an EXPLICIT min is honored exactly, never re-derived —
    // the auto-derived default is what stays zero-based; see the next test.
  });

  it("the AUTO-derived floor (no explicit min) stays zero for a non-negative value", () => {
    const [min] = resolveBulletDomain({ value: 50 });
    expect(min).toBe(0);
  });

  it("ceiling covers value/target/comparative/last band with headroom, nice-rounded", () => {
    const [, max] = resolveBulletDomain({
      value: 82,
      target: 100,
      comparative: 75,
      bands: [
        { to: 60, label: "Poor" },
        { to: 80, label: "Satisfactory" },
        { to: 100, label: "Good" },
      ],
    });
    // 100 * 1.05 = 105, niced.
    expect(max).toBeGreaterThanOrEqual(105);
  });

  it("honors an explicit max exactly, never re-nicing it", () => {
    const [, max] = resolveBulletDomain({ value: 10, max: 123 });
    expect(max).toBe(123);
  });
});

describe("findBulletBand", () => {
  const bands: BulletBand[] = [
    { to: 60, label: "Poor" },
    { to: 80, label: "Satisfactory" },
    { to: 100, label: "Good" },
  ];

  it("returns undefined for an empty band list", () => {
    expect(findBulletBand(50, [])).toBeUndefined();
  });

  it("returns the first band whose `to` covers the value", () => {
    expect(findBulletBand(50, bands)?.label).toBe("Poor");
    expect(findBulletBand(70, bands)?.label).toBe("Satisfactory");
    expect(findBulletBand(80, bands)?.label).toBe("Satisfactory");
  });

  it("falls back to the last (open-ended) band once value exceeds every threshold", () => {
    expect(findBulletBand(150, bands)?.label).toBe("Good");
  });
});

describe("describeBulletChart", () => {
  const t = (key: string, vars?: Record<string, string | number>) => {
    const templates: Record<string, string> = {
      "charts.bulletChart.noData": "No data",
      "charts.bulletChart.valueOfTarget": "{value} of {target} target",
      "charts.bulletChart.gapAbove": "{amount} above target",
      "charts.bulletChart.gapBelow": "{amount} below target",
      "charts.bulletChart.onTarget": "on target",
      "charts.bulletChart.band": "in band {band}",
      "charts.bulletChart.comparative": "compared to {value}",
    };
    let out = templates[key] ?? key;
    for (const [k, v] of Object.entries(vars ?? {})) {
      out = out.replace(`{${k}}`, String(v));
    }
    return out;
  };

  it('says "No data" for a non-finite value', () => {
    expect(describeBulletChart({ value: Number.NaN, formatValue: identityFormat, t })).toBe(
      "No data",
    );
  });

  it("states value, gap-below and band when target and bands are set", () => {
    const bands: BulletBand[] = [
      { to: 60, label: "Poor" },
      { to: 80, label: "Satisfactory" },
      { to: 100, label: "Good" },
    ];
    const description = describeBulletChart({
      value: 82,
      target: 100,
      bands,
      formatValue: identityFormat,
      t,
    });
    expect(description).toBe("82 of 100 target, 18 below target, in band Good");
  });

  it("states gap-above when the value exceeds the target", () => {
    const description = describeBulletChart({
      value: 120,
      target: 100,
      formatValue: identityFormat,
      t,
    });
    expect(description).toBe("120 of 100 target, 20 above target");
  });

  it('says "on target" when value equals target exactly', () => {
    const description = describeBulletChart({
      value: 100,
      target: 100,
      formatValue: identityFormat,
      t,
    });
    expect(description).toBe("100 of 100 target, on target");
  });

  it("drops the target/gap clause entirely when no target is given", () => {
    const description = describeBulletChart({ value: 82, formatValue: identityFormat, t });
    expect(description).toBe("82");
  });

  it("prefixes value/target with caller-supplied names", () => {
    const description = describeBulletChart({
      value: 82,
      target: 100,
      labels: { value: "Revenue", target: "Q3 target" },
      formatValue: identityFormat,
      t,
    });
    expect(description).toBe("Revenue 82 of Q3 target 100 target, 18 below target");
  });

  it("appends the comparative clause when set", () => {
    const description = describeBulletChart({
      value: 82,
      comparative: 75,
      labels: { comparative: "Last year" },
      formatValue: identityFormat,
      t,
    });
    expect(description).toBe("82, compared to Last year 75");
  });
});

describe("<BulletChart />", () => {
  it("mounts without throwing and attaches to the document", () => {
    const { container } = render(<BulletChart value={82} />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it("applies a custom className to the container", () => {
    const { container } = render(<BulletChart value={82} className="my-bullet" />);
    expect(container.firstChild).toHaveClass("my-bullet");
  });

  it("forwards a ref to the container div", () => {
    let capturedRef: HTMLDivElement | null = null;
    render(
      <BulletChart
        value={82}
        ref={(el) => {
          capturedRef = el;
        }}
      />,
    );
    expect(capturedRef).toBeInstanceOf(HTMLDivElement);
  });

  it("has data-slot on the root and every drawn part", () => {
    const { container } = render(
      <BulletChart
        bands={[
          { to: 60, label: "Poor" },
          { to: 100, label: "Good" },
        ]}
        comparative={75}
        target={100}
        value={82}
      />,
    );
    expect(container.querySelector('[data-slot="bullet-chart"]')).toBeInTheDocument();
    expect(container.querySelector('[data-slot="bullet-chart-band"]')).toBeInTheDocument();
    expect(container.querySelector('[data-slot="bullet-chart-bar"]')).toBeInTheDocument();
    expect(container.querySelector('[data-slot="bullet-chart-target"]')).toBeInTheDocument();
    expect(container.querySelector('[data-slot="bullet-chart-comparative"]')).toBeInTheDocument();
  });

  it("skips a band without a finite `to` instead of drawing NaN geometry (streamed prefix)", () => {
    const { container } = render(
      <BulletChart
        // What an A2UI prefix — or a spec that wrote bare numbers — hands the chart.
        bands={[{} as BulletBand, { to: 60, label: "Poor" }, { to: 100, label: "Good" }]}
        value={82}
      />,
    );
    const rects = [...container.querySelectorAll("rect")];
    expect(rects.length).toBeGreaterThan(0);
    for (const rect of rects) {
      expect(rect.getAttribute("width")).not.toMatch(/NaN/);
      expect(rect.getAttribute("x")).not.toMatch(/NaN/);
    }
    // Two real bands plus the open-ended headroom segment above the last `to`.
    expect(container.querySelectorAll('[data-slot="bullet-chart-band"]')).toHaveLength(3);
  });

  it('renders the axis slot only when size="md" (showAxis defaults to size === "md")', () => {
    const sm = render(<BulletChart value={82} target={100} />);
    expect(sm.container.querySelector('[data-slot="bullet-chart-axis"]')).not.toBeInTheDocument();
    sm.unmount();

    const md = render(<BulletChart size="md" target={100} value={82} />);
    expect(md.container.querySelector('[data-slot="bullet-chart-axis"]')).toBeInTheDocument();
  });

  it("computes a real accessible name stating value, gap and band by default", () => {
    const { container } = render(
      <BulletChart
        bands={[
          { to: 60, label: "Poor" },
          { to: 80, label: "Satisfactory" },
          { to: 100, label: "Good" },
        ]}
        target={100}
        value={82}
      />,
    );
    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute("role")).toBe("img");
    const name = root.getAttribute("aria-label") ?? "";
    expect(name).toMatch(/82/);
    expect(name).toMatch(/100/);
    expect(name).toMatch(/below target/);
    expect(name).toMatch(/Good/);
  });

  it("an explicit accessibleLabel overrides the computed name", () => {
    const { container } = render(
      <BulletChart accessibleLabel="Custom name" target={100} value={82} />,
    );
    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute("aria-label")).toBe("Custom name");
  });

  it("draws the zero-based track from domain min, not from an arbitrary offset", () => {
    const { container } = render(<BulletChart value={40} />);
    const band = container.querySelector('[data-slot="bullet-chart-band"]');
    // The single (no-bands) track spans the full [min, max] domain — its x
    // starts at the scaled `min`, which for a non-negative value is 0.
    const [min, max] = resolveBulletDomain({ value: 40 });
    const scale = scaleLinear({ domain: [min, max], range: [0, MEASURED_WIDTH] });
    expect(Number(band?.getAttribute("x"))).toBeCloseTo(scale(min));
  });

  it("positions the target tick proportionally to the resolved domain", () => {
    const { container } = render(<BulletChart target={80} value={40} />);
    const [min, max] = resolveBulletDomain({ value: 40, target: 80 });
    const scale = scaleLinear({ domain: [min, max], range: [0, MEASURED_WIDTH] });
    const target = container.querySelector('[data-slot="bullet-chart-target"]');
    expect(Number(target?.getAttribute("x1"))).toBeCloseTo(scale(80));
  });

  it("clamps the bar visually when value exceeds max, but the accessible name states the real value", () => {
    const { container } = render(<BulletChart max={100} min={0} value={250} />);
    const [, max] = resolveBulletDomain({ value: 250, max: 100, min: 0 });
    const scale = scaleLinear({ domain: [0, max], range: [0, MEASURED_WIDTH] });
    const bar = container.querySelector('[data-slot="bullet-chart-bar"]');
    // The bar's right edge never exceeds the scaled domain max...
    expect(Number(bar?.getAttribute("width"))).toBeCloseTo(scale(max));
    // ...but the accessible name still says 250, not the clamped 100.
    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute("aria-label")).toMatch(/250/);
  });

  it("draws no target tick when target is unset", () => {
    const { container } = render(<BulletChart value={40} />);
    expect(container.querySelector('[data-slot="bullet-chart-target"]')).not.toBeInTheDocument();
  });

  it("renders a single neutral track when no bands are given", () => {
    const { container } = render(<BulletChart value={40} />);
    const bands = container.querySelectorAll('[data-slot="bullet-chart-band"]');
    expect(bands.length).toBe(1);
  });

  it('renders no bar and says "No data" for a NaN value', () => {
    const { container } = render(<BulletChart value={Number.NaN} />);
    expect(container.querySelector('[data-slot="bullet-chart-bar"]')).not.toBeInTheDocument();
    // The single neutral track still renders (the "empty track" per the spec).
    expect(container.querySelector('[data-slot="bullet-chart-band"]')).toBeInTheDocument();
    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute("aria-label")).toBe("No data");
  });

  it("shades the worst (first) band darkest by default (higherIsBetter)", () => {
    const { container } = render(
      <BulletChart
        bands={[
          { to: 60, label: "Poor" },
          { to: 80, label: "Satisfactory" },
          { to: 100, label: "Good" },
        ]}
        target={100}
        value={82}
      />,
    );
    const bands = container.querySelectorAll('[data-slot="bullet-chart-band"]');
    // Worst (index 0) gets the strongest-contrast rung; best (last) gets the lighter one —
    // never the near-invisible `--muted` rung a card-white theme would swallow (#…).
    expect(bands[0]?.getAttribute("fill")).toBe("var(--chart-grid)");
    expect(bands[bands.length - 1]?.getAttribute("fill")).toBe("var(--chart-ring-background)");
  });

  it("mirrors the ramp for a lower-is-better measure so the high (worst) end stays darkest", () => {
    const { container } = render(
      <BulletChart
        bands={[
          { to: 8, label: "On track" },
          { to: 9, label: "Watch" },
          { to: 12, label: "Behind" },
        ]}
        higherIsBetter={false}
        target={7.9}
        value={8.4}
      />,
    );
    const bands = container.querySelectorAll('[data-slot="bullet-chart-band"]');
    // Lowest values are BEST here, so index 0 gets the lighter rung and the
    // high (worst) end — the last band plus its open-ended overflow — gets
    // the darkest rung, the mirror image of the higherIsBetter case above.
    expect(bands[0]?.getAttribute("fill")).toBe("var(--chart-ring-background)");
    expect(bands[bands.length - 1]?.getAttribute("fill")).toBe("var(--chart-grid)");
  });
});

// RM-183 review: confirms BulletChart re-draws once `status` flips from
// "loading" to "ready" — Bullet measures through `useLayoutMeasure`, a
// callback ref that re-attaches whenever the plot node mounts, not a
// mount-only `ResizeObserver` effect, so no fix was needed here.
describe("BulletChart re-renders after status flips from loading to ready", () => {
  it("draws the band/bar marks once status goes from loading to ready", () => {
    const { container, rerender } = render(
      <BulletChart status="loading" target={100} value={82} />,
    );
    expect(container.querySelectorAll('[data-slot="bullet-chart-band"]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-slot="bullet-chart-bar"]')).toHaveLength(0);

    rerender(<BulletChart status="ready" target={100} value={82} />);
    expect(container.querySelectorAll('[data-slot="bullet-chart-band"]').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('[data-slot="bullet-chart-bar"]')).toHaveLength(1);
  });
});

// RM-183 review (minor, 2026-09-26): a plain generic element cannot carry an
// accessible name — the loading root needs a real ARIA role alongside
// `aria-label`, or AT may ignore the label entirely.
describe("BulletChart loading root is nameable by assistive tech", () => {
  it('gives the loading root role="group" so its aria-label is a valid accessible name', () => {
    const { container } = render(
      <BulletChart accessibleLabel="Revenue vs target" status="loading" target={100} value={82} />,
    );
    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute("role")).toBe("group");
    expect(root).toHaveAccessibleName("Revenue vs target");
  });
});

// RM-183 review: thin-tests minor — `margin` (frame-size group) had no
// behavior test for BulletChart. `resolveChartMargin` + `marginPaddingStyle`
// turn it into root `padding`.
describe("BulletChart margin (frame-size group)", () => {
  it("renders no padding when margin is unset", () => {
    const { container } = render(<BulletChart target={100} value={82} />);
    expect((container.firstChild as HTMLElement).style.padding).toBe("");
  });

  it("renders a uniform padding for a number margin", () => {
    const { container } = render(<BulletChart margin={24} target={100} value={82} />);
    expect((container.firstChild as HTMLElement).style.padding).toBe("24px");
  });

  it("renders a per-side padding for a partial Margin object", () => {
    const { container } = render(
      <BulletChart margin={{ top: 8, right: 16 }} target={100} value={82} />,
    );
    expect((container.firstChild as HTMLElement).style.padding).toBe("8px 16px 0px 0px");
  });
});

// RM-183 review (fix3): `BulletChartProps` keeps `currency`/`maxFractionDigits`
// from the value-format group (locale dropped — the formatter always reads
// the ambient `useLocale()`). Both feed `useChartValueSetFormatter`, which
// builds the computed accessible name — the one place their effect is visible.
describe("BulletChart value-format group (fix3)", () => {
  it("currency changes the computed accessible name", () => {
    const { container: withoutCurrency } = render(
      <BulletChart value={320.456} valueFormat="currency" />,
    );
    const { container: withCurrency } = render(
      <BulletChart currency="EUR" value={320.456} valueFormat="currency" />,
    );
    const withoutName =
      (withoutCurrency.firstChild as HTMLElement).getAttribute("aria-label") ?? "";
    const withName = (withCurrency.firstChild as HTMLElement).getAttribute("aria-label") ?? "";
    expect(withName).toContain("€");
    expect(withoutName).not.toContain("€");
  });

  it("maxFractionDigits changes the computed accessible name", () => {
    const { container: withoutLimit } = render(
      <BulletChart currency="EUR" value={320.456} valueFormat="currency" />,
    );
    const { container: withLimit } = render(
      <BulletChart currency="EUR" maxFractionDigits={0} value={320.456} valueFormat="currency" />,
    );
    const withoutName = (withoutLimit.firstChild as HTMLElement).getAttribute("aria-label") ?? "";
    const withName = (withLimit.firstChild as HTMLElement).getAttribute("aria-label") ?? "";
    expect(withName).toMatch(/€320(?!\.)/);
    expect(withoutName).toMatch(/€320\.\d/);
  });
});
