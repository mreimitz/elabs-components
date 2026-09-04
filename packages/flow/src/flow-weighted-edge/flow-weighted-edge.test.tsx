import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// @xyflow/react requires real layout/measurement — mock the engine and assert
// the brand component's own output. Real rendering + a11y are covered by
// Storybook interaction tests.
//
// `vi.mock`'s factory is hoisted above every import (and above ordinary
// top-level `const`s) — `vi.hoisted` is the escape hatch so the mock fns
// themselves survive the hoist without a TDZ ReferenceError.
const { getBezierPathMock, getSmoothStepPathMock, edgesBox } = vi.hoisted(() => {
  return {
    edgesBox: { current: [] as unknown[] },
    getBezierPathMock: vi.fn(
      ({
        sourceX,
        sourceY,
        targetX,
        targetY,
      }: {
        sourceX: number;
        sourceY: number;
        targetX: number;
        targetY: number;
      }) => [
        `M${sourceX},${sourceY} C${targetX},${targetY}`,
        (sourceX + targetX) / 2,
        (sourceY + targetY) / 2,
      ],
    ),
    getSmoothStepPathMock: vi.fn(
      ({
        sourceX,
        sourceY,
        targetX,
        targetY,
      }: {
        sourceX: number;
        sourceY: number;
        targetX: number;
        targetY: number;
      }) => [
        `M${sourceX},${sourceY} L${targetX},${targetY}`,
        (sourceX + targetX) / 2,
        (sourceY + targetY) / 2,
      ],
    ),
  };
});

vi.mock("@xyflow/react", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- a vi.mock factory is hoisted above imports; a lazy require avoids the TDZ a top-level import would hit
  const React = require("react");
  return {
    BaseEdge: ({
      id,
      path,
      style,
      className,
    }: {
      id: string;
      path: string;
      style?: React.CSSProperties;
      className?: string;
    }) =>
      React.createElement("svg", { "data-testid": "base-edge" }, [
        React.createElement("path", { key: "p", d: path, id, style, className }),
      ]),
    // Real EdgeLabelRenderer portals into a fixed container; a passthrough is
    // enough here since we only assert the brand component's own output.
    EdgeLabelRenderer: ({ children }: { children: React.ReactNode }) => children,
    getBezierPath: getBezierPathMock,
    getSmoothStepPath: getSmoothStepPathMock,
    useEdges: () => edgesBox.current,
    Position: { Top: "top", Bottom: "bottom", Left: "left", Right: "right" },
  };
});

import { oklchToHex } from "@elabs-ai/components-tokens";
import { FlowWeightedEdge, type BrandFlowWeightedEdge } from "./flow-weighted-edge";
import type { EdgeProps } from "@xyflow/react";

afterEach(() => {
  cleanup();
  edgesBox.current = [];
  getBezierPathMock.mockClear();
  getSmoothStepPathMock.mockClear();
});

/** Minimal EdgeProps factory for FlowWeightedEdge. */
function makeEdgeProps(
  overrides: Partial<EdgeProps<BrandFlowWeightedEdge>> = {},
): EdgeProps<BrandFlowWeightedEdge> {
  return {
    id: "test-edge",
    type: "weighted",
    source: "node-a",
    target: "node-b",
    sourceX: 0,
    sourceY: 0,
    targetX: 100,
    targetY: 100,
    sourcePosition: "bottom" as EdgeProps["sourcePosition"],
    targetPosition: "top" as EdgeProps["targetPosition"],
    selected: false,
    animated: false,
    data: {},
    ...overrides,
  };
}

describe("FlowWeightedEdge", () => {
  it("renders a BaseEdge element", () => {
    render(<FlowWeightedEdge {...makeEdgeProps()} />);
    expect(screen.getByTestId("base-edge")).toBeInTheDocument();
  });

  it("renders at the fixed 1.5px floor when data.weight is absent (unchanged from FlowEdge)", () => {
    edgesBox.current = [{ id: "test-edge", data: {} }];
    render(<FlowWeightedEdge {...makeEdgeProps()} />);
    const path = screen.getByTestId("base-edge").querySelector("path")!;
    expect(path.style.strokeWidth).toBe("1.5");
    expect(path.style.stroke).toBe("var(--flow-edge)");
  });

  it("scales strokeWidth into [1.5, 8] against sibling edges from the same scaleGroup", () => {
    edgesBox.current = [
      { id: "test-edge", data: { weight: 1 } },
      { id: "sibling", data: { weight: 10 } },
    ];
    render(<FlowWeightedEdge {...makeEdgeProps({ data: { weight: 1 } })} />);
    const path = screen.getByTestId("base-edge").querySelector("path")!;
    expect(path.style.strokeWidth).toBe("1.5");
  });

  it("renders an EdgeLabelPill when data.label is set", () => {
    edgesBox.current = [{ id: "test-edge", data: {} }];
    render(<FlowWeightedEdge {...makeEdgeProps({ data: { label: "128×" } })} />);
    expect(screen.getByRole("button", { name: "128×" })).toBeInTheDocument();
  });

  it("renders no EdgeLabelPill when neither label is set", () => {
    edgesBox.current = [{ id: "test-edge", data: {} }];
    render(<FlowWeightedEdge {...makeEdgeProps()} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  // #286 — an edge is a real tab stop, so it must show a focus indicator with
  // NO `selected` state and no consumer-supplied `onEdgesChange`. These lock
  // the structure; `KeyboardFocus` in the stories locks the rendered result
  // (resolved computed values in a real browser, both themes).
  it("draws the compound focus indicator with no `selected` state (#286)", () => {
    edgesBox.current = [{ id: "test-edge", data: { weight: 5 } }];
    const { container } = render(
      <FlowWeightedEdge {...makeEdgeProps({ selected: false, data: { weight: 5 } })} />,
    );
    const contour = container.querySelector<SVGPathElement>(
      '[data-slot="flow-edge-focus-contour"]',
    );
    const ring = container.querySelector<SVGPathElement>('[data-slot="flow-edge-focus-ring"]');
    expect(contour).not.toBeNull();
    expect(ring).not.toBeNull();

    const edgeWidth = parseFloat(
      screen.getByTestId("base-edge").querySelector("path")!.style.strokeWidth,
    );
    const contourWidth = parseFloat(contour!.getAttribute("stroke-width")!);
    const ringWidth = parseFloat(ring!.getAttribute("stroke-width")!);
    // Neutral contour outside the --ring band, both outside the edge itself.
    expect(contourWidth).toBeGreaterThan(ringWidth);
    expect(ringWidth).toBeGreaterThan(edgeWidth);

    // Same geometry as the edge — a halo, not a second shape.
    expect(contour!.getAttribute("d")).toBe(ring!.getAttribute("d"));

    // Hidden until the ancestor g.react-flow__edge matches :focus-visible. The
    // pattern is asserted rather than the literal class string so this file does
    // not itself become a Tailwind candidate.
    for (const layer of [contour!, ring!]) {
      const cls = layer.getAttribute("class") ?? "";
      expect(cls).toContain("opacity-0");
      expect(cls).toMatch(/react-flow.+edge:focus-visible.+opacity-100/);
      expect(cls).toContain("pointer-events-none");
    }
  });

  it("uses --ring and a wider stroke when selected", () => {
    edgesBox.current = [{ id: "test-edge", data: { weight: 5 } }];
    render(<FlowWeightedEdge {...makeEdgeProps({ selected: true, data: { weight: 5 } })} />);
    const path = screen.getByTestId("base-edge").querySelector("path")!;
    expect(path.style.stroke).toBe("var(--ring)");
  });

  it("colours the stroke when value + valueDomain are set (not the plain --flow-edge token)", () => {
    edgesBox.current = [{ id: "test-edge", data: {} }];
    render(<FlowWeightedEdge {...makeEdgeProps({ data: { value: 5, valueDomain: [0, 10] } })} />);
    const path = screen.getByTestId("base-edge").querySelector("path")!;
    expect(path.style.stroke).not.toBe("var(--flow-edge)");
    expect(path.style.stroke).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("uses getSmoothStepPath when data.path is 'smoothstep'", () => {
    edgesBox.current = [{ id: "test-edge", data: {} }];
    render(<FlowWeightedEdge {...makeEdgeProps({ data: { path: "smoothstep" } })} />);
    expect(getSmoothStepPathMock).toHaveBeenCalled();
    expect(getBezierPathMock).not.toHaveBeenCalled();
  });

  it("uses getBezierPath by default", () => {
    edgesBox.current = [{ id: "test-edge", data: {} }];
    render(<FlowWeightedEdge {...makeEdgeProps()} />);
    expect(getBezierPathMock).toHaveBeenCalled();
    expect(getSmoothStepPathMock).not.toHaveBeenCalled();
  });
});

// #282 — the SSR fallback hexes (used whenever `--flow-edge-weak`/
// `--flow-edge-strong` can't be resolved from a live stylesheet — true SSR,
// or, as here, jsdom with no themes.css custom properties set, which
// `resolveTokenColor` treats identically via its `if (!raw) return fallback`
// branch) must clear WCAG 1.4.11's 3:1 non-text bar against BOTH reference
// themes' `--canvas` — not just the theme they happen to approximate. A pure
// SSR render can't know which theme will apply, so a single hex pair has to
// be safe under either one.
//
// The oklch→sRGB→luminance math below is a MINIMAL, self-contained
// reimplementation of `packages/tokens/src/color-contrast.ts` — that module
// isn't part of `@elabs-ai/components-tokens`'s public barrel (only
// `oklchToHex`/`resolveTokenColor` are), so this package can't reach it
// without a relative cross-package import. Keep this in sync with
// `color-contrast.ts` if that math ever changes; `themes-contrast.test.ts`
// is the source of truth for the underlying token values.
describe("FlowWeightedEdge SSR fallback contrast (#282)", () => {
  function hexToSrgb01(hex: string): [number, number, number] {
    const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex)!;
    return [parseInt(m[1]!, 16) / 255, parseInt(m[2]!, 16) / 255, parseInt(m[3]!, 16) / 255];
  }

  function relativeLuminance([r, g, b]: [number, number, number]): number {
    const lin = (v: number) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  }

  function contrastHexVsHex(a: string, b: string): number {
    const la = relativeLuminance(hexToSrgb01(a));
    const lb = relativeLuminance(hexToSrgb01(b));
    const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
    return (hi + 0.05) / (lo + 0.05);
  }

  // `--canvas` in each reference theme (packages/tokens/src/themes/light.css,
  // themes/dark.css), pre-converted to hex via the same oklch math — kept as
  // hex here rather than re-deriving oklch→sRGB locally a second time.
  const LIGHT_CANVAS_HEX = "#f4f5f6"; // oklch(0.97 0.002 257)
  const DARK_CANVAS_HEX = "#0e1217"; // oklch(0.18 0.012 257)
  const AA_NONTEXT = 3;

  function strokeAt(value: number, valueDomain: [number, number]): string {
    edgesBox.current = [{ id: "test-edge", data: {} }];
    render(<FlowWeightedEdge {...makeEdgeProps({ data: { value, valueDomain } })} />);
    const path = screen.getByTestId("base-edge").querySelector("path")!;
    const stroke = path.style.stroke;
    cleanup();
    return stroke;
  }

  it("FALLBACK_WEAK (t=0) clears 3:1 on light's and dark's --canvas", () => {
    const stroke = strokeAt(0, [0, 10]);
    expect(stroke).toMatch(/^#[0-9a-f]{6}$/i);
    const vsLight = contrastHexVsHex(stroke, LIGHT_CANVAS_HEX);
    const vsDark = contrastHexVsHex(stroke, DARK_CANVAS_HEX);
    expect(
      vsLight,
      `FALLBACK_WEAK ${stroke} vs light --canvas = ${vsLight.toFixed(2)}`,
    ).toBeGreaterThanOrEqual(AA_NONTEXT);
    expect(
      vsDark,
      `FALLBACK_WEAK ${stroke} vs dark --canvas = ${vsDark.toFixed(2)}`,
    ).toBeGreaterThanOrEqual(AA_NONTEXT);
  });

  it("FALLBACK_STRONG (t=1) clears 3:1 on light's and dark's --canvas", () => {
    const stroke = strokeAt(10, [0, 10]);
    expect(stroke).toMatch(/^#[0-9a-f]{6}$/i);
    const vsLight = contrastHexVsHex(stroke, LIGHT_CANVAS_HEX);
    const vsDark = contrastHexVsHex(stroke, DARK_CANVAS_HEX);
    expect(
      vsLight,
      `FALLBACK_STRONG ${stroke} vs light --canvas = ${vsLight.toFixed(2)}`,
    ).toBeGreaterThanOrEqual(AA_NONTEXT);
    expect(
      vsDark,
      `FALLBACK_STRONG ${stroke} vs dark --canvas = ${vsDark.toFixed(2)}`,
    ).toBeGreaterThanOrEqual(AA_NONTEXT);
  });
});

// #286 — the focus indicator's neutral contour is what carries WCAG 1.4.11's
// 3:1 non-text bar, because `--ring` alone measures 1.30:1 against `--canvas`
// in the `light` reference theme. That makes `--foreground` vs `--canvas` a
// load-bearing token pairing for the flow package, and nothing else gates it:
// `--canvas` is not one of the five MARK_SURFACES in
// packages/tokens/src/themes-contrast.test.ts. Values are the literals in
// packages/tokens/src/themes/{light,dark}.css.
describe("edge focus contour contrast (#286)", () => {
  const THEMES = [
    { name: "light", foreground: "oklch(0.3 0.021 257)", canvas: "oklch(0.97 0.002 257)" },
    { name: "dark", foreground: "oklch(0.95 0.004 257)", canvas: "oklch(0.18 0.012 257)" },
  ] as const;

  function srgb01(hex: string): [number, number, number] {
    const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex)!;
    return [parseInt(m[1]!, 16) / 255, parseInt(m[2]!, 16) / 255, parseInt(m[3]!, 16) / 255];
  }
  function luminance([r, g, b]: [number, number, number]): number {
    const lin = (v: number) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  }

  it.each(THEMES)(
    "--foreground clears 3:1 against --canvas in $name",
    ({ name, foreground, canvas }) => {
      const [la, lb] = [
        luminance(srgb01(oklchToHex(foreground)!)),
        luminance(srgb01(oklchToHex(canvas)!)),
      ].sort((x, y) => y - x);
      const ratio = (la! + 0.05) / (lb! + 0.05);
      expect(
        ratio,
        `--foreground vs --canvas in ${name} = ${ratio.toFixed(2)}:1`,
      ).toBeGreaterThanOrEqual(3);
    },
  );
});
