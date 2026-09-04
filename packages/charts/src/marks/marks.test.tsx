/**
 * Editorial marks — smoke + contract tests (RM-017).
 *
 * These marks are bare SVG, so jsdom renders them faithfully (unlike a `@visx`
 * chart, which needs a real layout engine) and the assertions below are about
 * the REAL markup rather than a stand-in. What is deliberately NOT asserted
 * here: resolved colour. A `var(--chart-background)` halo only becomes a colour
 * once a theme stylesheet is attached, so theme-safety is proved by the
 * Vocabulary story in a browser, in both themes — not by a jsdom string match.
 */
import { cleanup, render } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

// One mutable switch instead of a module reset: re-importing the component
// after `vi.resetModules()` would also re-import React, and a component from a
// second React instance cannot use the renderer's hooks.
const motionState = vi.hoisted(() => ({ reduced: false }));
vi.mock("motion/react", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useReducedMotion: () => motionState.reduced,
}));

import {
  CHART_STAGGER_BAR_MS,
  CHART_STAGGER_DOT_MS,
  DrawPath,
  HairlineFloor,
  HaloText,
  Leader,
  leaderPath,
  Marginalia,
  PeakRing,
  QuietDot,
  seededRnd,
  stagger,
  UnitStack,
} from "./index";

afterEach(cleanup);

/** Render marks inside a real <svg> so the elements have a legal parent. */
function renderSvg(ui: ReactNode) {
  return render(
    <svg data-testid="canvas" height={200} viewBox="0 0 200 200" width={200}>
      {ui}
    </svg>,
  );
}

describe("seededRnd", () => {
  it("is deterministic — the same pair always yields the same value", () => {
    const first = seededRnd(3, 7);
    for (let i = 0; i < 100; i += 1) expect(seededRnd(3, 7)).toBe(first);
  });

  it("stays inside [0, 1) — the Math.abs is load-bearing", () => {
    // Without `Math.abs`, `^` yields a SIGNED int32 and roughly half of these
    // pairs come back negative, inverting every jitter that consumes them.
    for (let i = 0; i < 200; i += 1) {
      for (const k of [0, 1, 7, 42, 999]) {
        const v = seededRnd(i, k);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(1);
      }
    }
  });

  it("decorrelates on k, so one index can draw two independent values", () => {
    expect(seededRnd(3, 7)).not.toBe(seededRnd(3, 8));
  });
});

describe("stagger", () => {
  it("converts ms steps to motion's seconds", () => {
    expect(stagger(0)).toBe(0);
    expect(stagger(1, 0, CHART_STAGGER_DOT_MS)).toBeCloseTo(0.012, 6);
    expect(stagger(3, 0, CHART_STAGGER_BAR_MS)).toBeCloseTo(0.3, 6);
  });

  it("applies the group's base offset", () => {
    expect(stagger(2, 100, CHART_STAGGER_DOT_MS)).toBeCloseTo(0.124, 6);
  });

  it("clamps a negative index — a mark can be late, never early", () => {
    expect(stagger(-5, 0, CHART_STAGGER_BAR_MS)).toBe(0);
  });
});

describe("HaloText", () => {
  it("punches the halo with paint-order and the plot-ground token", () => {
    const { getByText } = renderSvg(
      <HaloText x={10} y={10}>
        18°
      </HaloText>,
    );
    const text = getByText("18°");
    expect(text.getAttribute("paint-order")).toBe("stroke");
    expect(text.getAttribute("stroke")).toBe("var(--chart-background)");
    expect(text.getAttribute("stroke-linejoin")).toBe("round");
    expect(text.getAttribute("stroke-width")).toBe("3");
    expect(text.getAttribute("fill")).toBe("var(--chart-foreground)");
  });

  it("takes an explicit halo token for text that is not on the plot ground", () => {
    const { getByText } = renderSvg(
      <HaloText halo="var(--chart-label)" x={0} y={0}>
        on a plate
      </HaloText>,
    );
    expect(getByText("on a plate").getAttribute("stroke")).toBe("var(--chart-label)");
  });
});

describe("Leader", () => {
  it("draws an elbow through the x midpoint and a curve with horizontal handles", () => {
    expect(leaderPath([0, 0], [20, 10], "elbow")).toBe("M 0 0 H 10 V 10 H 20");
    expect(leaderPath([0, 0], [20, 10], "curve")).toBe("M 0 0 C 10 0, 10 10, 20 10");
  });

  it("is unfilled furniture at the muted hairline weight", () => {
    const { container } = renderSvg(<Leader from={[0, 0]} to={[20, 10]} />);
    const path = container.querySelector('[data-slot="leader"]');
    expect(path?.getAttribute("fill")).toBe("none");
    expect(path?.getAttribute("stroke")).toBe("var(--chart-foreground-muted)");
    expect(path?.getAttribute("stroke-width")).toBe("0.6");
    expect(path?.getAttribute("stroke-dasharray")).toBe("1 3");
  });
});

describe("PeakRing", () => {
  it("emphasises by SHAPE — a dashed outline, not a hue", () => {
    const { container } = renderSvg(<PeakRing cx={50} cy={50} r={8} />);
    const circle = container.querySelector('[data-slot="peak-ring"] circle');
    expect(circle?.getAttribute("stroke-dasharray")).toBe("2 3");
    expect(circle?.getAttribute("fill")).toBe("none");
    expect(circle?.getAttribute("r")).toBe("8");
  });

  it("inscribes the same radius when it rings a matrix cell", () => {
    const { container } = renderSvg(<PeakRing cx={50} cy={40} r={6} shape="square" />);
    const rect = container.querySelector('[data-slot="peak-ring"] rect');
    expect(rect?.getAttribute("x")).toBe("44");
    expect(rect?.getAttribute("y")).toBe("34");
    expect(rect?.getAttribute("width")).toBe("12");
    expect(rect?.getAttribute("height")).toBe("12");
  });
});

describe("Marginalia", () => {
  it("is SVG text plus a leader — never a foreignObject", () => {
    const { container, getByText } = renderSvg(
      <Marginalia anchor={[20, 20]} x={80} y={40}>
        first frost
      </Marginalia>,
    );
    expect(container.querySelector("foreignObject")).toBeNull();
    expect(container.querySelector('[data-slot="marginalia"] [data-slot="leader"]')).not.toBeNull();
    const note = getByText("first frost");
    expect(note.tagName.toLowerCase()).toBe("text");
    expect(note.getAttribute("font-style")).toBe("italic");
  });
});

describe("HairlineFloor", () => {
  it("draws one tick per period and lengthens every n-th", () => {
    const months = Array.from({ length: 24 }, (_m, i) => i);
    const { container } = renderSvg(
      <HairlineFloor every={12} periods={months} scale={(m: number) => m * 5} y={100} />,
    );
    const ticks = container.querySelectorAll('[data-slot="hairline-floor"] line');
    expect(ticks).toHaveLength(24);
    // Index 0 and 12 are the long ones (a year boundary each).
    expect(ticks[0]?.getAttribute("y2")).toBe("106");
    expect(ticks[1]?.getAttribute("y2")).toBe("103");
    expect(ticks[12]?.getAttribute("y2")).toBe("106");
  });

  it("skips a period the scale cannot place, rather than drawing it at NaN", () => {
    const { container } = renderSvg(
      <HairlineFloor
        periods={["a", "b", "c"]}
        scale={(p: string) => (p === "b" ? undefined : 10)}
        y={50}
      />,
    );
    expect(container.querySelectorAll('[data-slot="hairline-floor"] line')).toHaveLength(2);
  });
});

describe("QuietDot", () => {
  it("draws a 0.9px pinprick, so a zero cell is never a hole", () => {
    const { container } = renderSvg(<QuietDot cx={12} cy={12} />);
    const dot = container.querySelector('[data-slot="quiet-dot"]');
    expect(dot?.getAttribute("r")).toBe("0.45");
    expect(dot?.getAttribute("fill")).toBe("var(--chart-foreground-muted)");
    expect(dot?.getAttribute("aria-hidden")).toBe("true");
  });
});

describe("UnitStack", () => {
  it("draws n countable units and emphasises every markEvery-th", () => {
    const { container } = renderSvg(
      <UnitStack direction="up" kind="rung" length={10} markEvery={5} n={10} seed={1} y={100} />,
    );
    const units = container.querySelectorAll('[data-slot="unit-stack-unit"]');
    expect(units).toHaveLength(10);
    // The 5th unit (index 4) is the emphatic one: 1.5× the cross extent.
    expect(units[0]?.getAttribute("x1")).toBe("-5");
    expect(units[4]?.getAttribute("x1")).toBe("-7.5");
    // A rung is centred on the growth axis; the stack grows upward from y.
    expect(units[0]?.getAttribute("y1")).toBe("100");
    expect(units[1]?.getAttribute("y1")).toBe("97");
  });

  it("anchors a tick on one side of the axis instead of centring it", () => {
    const { container } = renderSvg(
      <UnitStack direction="right" kind="tick" length={6} n={3} seed={2} x={10} y={10} />,
    );
    const first = container.querySelectorAll('[data-slot="unit-stack-unit"]')[0];
    expect(first?.getAttribute("y1")).toBe("10");
    expect(first?.getAttribute("y2")).toBe("16");
  });

  it("renders dots when asked, sized by length", () => {
    const { container } = renderSvg(
      <UnitStack direction="down" kind="dot" length={3} n={4} seed={3} />,
    );
    const dots = container.querySelectorAll('[data-slot="unit-stack-unit"]');
    expect(dots).toHaveLength(4);
    expect(dots[0]?.tagName.toLowerCase()).toBe("circle");
    expect(dots[0]?.getAttribute("r")).toBe("1.5");
  });

  it("jitters reproducibly — the same seed draws the same stack twice", () => {
    const widths = () => {
      const { container, unmount } = renderSvg(
        <UnitStack direction="up" jitter kind="rung" length={8} n={12} seed={9} />,
      );
      const out = Array.from(container.querySelectorAll('[data-slot="unit-stack-unit"]')).map((u) =>
        u.getAttribute("stroke-width"),
      );
      unmount();
      return out;
    };
    const a = widths();
    const b = widths();
    expect(a).toEqual(b);
    // …and it really is jitter, not a constant.
    expect(new Set(a).size).toBeGreaterThan(1);
  });

  it("floors a fractional or negative count to a drawable number of units", () => {
    const { container } = renderSvg(
      <UnitStack direction="up" kind="dot" length={2} n={-4} seed={0} />,
    );
    expect(container.querySelectorAll('[data-slot="unit-stack-unit"]')).toHaveLength(0);
  });
});

describe("DrawPath", () => {
  it("scales its own length to 1 so no layout read is needed", () => {
    const { container } = renderSvg(<DrawPath d="M 0 0 L 50 50" stroke="currentColor" />);
    const path = container.querySelector('[data-slot="draw-path"]');
    expect(path?.getAttribute("pathLength")).toBe("1");
    expect(path?.getAttribute("fill")).toBe("none");
  });
});

describe("DrawPath under reduced motion", () => {
  it("renders the finished path with no dash attributes at all", () => {
    motionState.reduced = true;
    try {
      const { container } = renderSvg(<DrawPath d="M 0 0 L 50 50" stroke="currentColor" />);
      const path = container.querySelector('[data-slot="draw-path"]');
      expect(path).not.toBeNull();
      expect(path?.hasAttribute("stroke-dasharray")).toBe(false);
      expect(path?.hasAttribute("stroke-dashoffset")).toBe(false);
      expect(path?.hasAttribute("pathLength")).toBe(false);
    } finally {
      motionState.reduced = false;
    }
  });
});

describe("the marks layer as a whole", () => {
  it("contains no literal colour and no Math.random in its CODE", async () => {
    // A guard on the RULE, not on one file: the acceptance criterion for this
    // layer is that `Math.random` appears nowhere under `src/marks/`, and that
    // every colour is a semantic token. Comments are stripped first — the
    // docblocks deliberately NAME `Math.random` in order to ban it, and a guard
    // that could not tell prose from code would forbid its own rationale.
    const { existsSync, readdirSync, readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    // Resolved from the vitest root (the package dir), not from `import.meta.url`
    // — Vite rewrites that to a server-root-relative path, which is not a real
    // filesystem location.
    const fromPackage = join(process.cwd(), "src", "marks");
    const dir = existsSync(fromPackage)
      ? fromPackage
      : join(process.cwd(), "packages", "charts", "src", "marks");
    const files = readdirSync(dir).filter((f) => /\.tsx?$/.test(f) && !f.includes(".test."));
    expect(files.length).toBeGreaterThan(8);

    const stripComments = (src: string) =>
      src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");

    for (const file of files) {
      const code = stripComments(readFileSync(join(dir, file), "utf8"));
      expect(`${file} uses Math.random: ${code.includes("Math.random")}`).toBe(
        `${file} uses Math.random: false`,
      );
      const literalColour = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(|\boklch\(/.test(code);
      expect(`${file} has a literal colour: ${literalColour}`).toBe(
        `${file} has a literal colour: false`,
      );
    }
  });
});
