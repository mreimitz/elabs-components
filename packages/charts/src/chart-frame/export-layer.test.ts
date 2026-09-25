import { describe, expect, it, vi } from "vitest";

import {
  paints,
  parseLinearGradient,
  renderChartExportLayer,
  renderChartExportUnderlay,
  sanitizeXml,
  type ChartExportLayerModel,
  type ChartExportTextRun,
} from "./export-layer";
import { buildExportSvg, findChartSvg, hasChartSvg, readSvgSize, serializeSvg } from "./export-svg";

const SVG_NS = "http://www.w3.org/2000/svg";

const run = (overrides: Partial<ChartExportTextRun> = {}): ChartExportTextRun => ({
  role: "label",
  text: "42",
  x: 10,
  y: 20,
  fill: "rgb(0, 0, 0)",
  fontFamily: "Inter",
  fontSize: "12px",
  fontWeight: "400",
  fontStyle: "normal",
  ...overrides,
});

const model = (overrides: Partial<ChartExportLayerModel> = {}): ChartExportLayerModel => ({
  width: 200,
  height: 100,
  chart: { x: 0, y: 20, width: 200, height: 80 },
  runs: [],
  swatches: [],
  ...overrides,
});

const INNER_SVG = `<svg xmlns="${SVG_NS}" viewBox="0 0 10 10"><rect width="10" height="10" fill="rgb(255, 0, 0)"/></svg>`;

function fakeChartSvg(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg") as unknown as SVGSVGElement;
  svg.setAttribute("width", "100");
  svg.setAttribute("height", "60");
  svg.append(document.createElementNS(SVG_NS, "path"));
  return svg;
}

function withRect(el: Element, width: number, height: number): Element {
  el.getBoundingClientRect = () =>
    ({ left: 0, top: 0, right: width, bottom: height, width, height, x: 0, y: 0 }) as DOMRect;
  return el;
}

describe("renderChartExportLayer — graphics, boxes and clips", () => {
  it("paints another <svg> as a nested svg at its measured box", () => {
    const layer = renderChartExportLayer(
      model({ graphics: [{ kind: "svg", x: 5, y: 6, width: 30, height: 40, content: INNER_SVG }] }),
    );
    const nested = layer.querySelector("svg")!;
    expect(nested).not.toBeNull();
    expect(["x", "y", "width", "height"].map((a) => nested.getAttribute(a))).toEqual([
      "5",
      "6",
      "30",
      "40",
    ]);
    expect(nested.querySelector("rect")?.getAttribute("fill")).toBe("rgb(255, 0, 0)");
  });

  it("paints a bitmap as an <image> and skips svg markup that does not parse", () => {
    const layer = renderChartExportLayer(
      model({
        graphics: [
          {
            kind: "image",
            x: 0,
            y: 0,
            width: 20,
            height: 10,
            content: "data:image/png;base64,AA==",
          },
          { kind: "svg", x: 0, y: 0, width: 20, height: 10, content: "<svg><rect></svg>" },
          {
            kind: "svg",
            x: 0,
            y: 0,
            width: 20,
            height: 10,
            content: `<svg xmlns="${SVG_NS}"><rect></svg>`,
          },
        ],
      }),
    );
    expect(layer.querySelector("image")?.getAttribute("href")).toBe("data:image/png;base64,AA==");
    expect(layer.querySelectorAll("image")).toHaveLength(1);
    expect(layer.querySelector("svg")).toBeNull();
  });

  it("draws svg markup as an image of itself where the page refuses to parse it", () => {
    // `require-trusted-types-for 'script'` makes DOMParser throw.
    vi.stubGlobal(
      "DOMParser",
      class {
        parseFromString(): Document {
          throw new TypeError("This document requires 'TrustedHTML' assignment.");
        }
      },
    );
    try {
      const layer = renderChartExportLayer(
        model({
          graphics: [{ kind: "svg", x: 5, y: 6, width: 30, height: 40, content: INNER_SVG }],
        }),
      );
      const image = layer.querySelector("image")!;
      expect(image.getAttribute("href")).toBe(
        `data:image/svg+xml;charset=utf-8,${encodeURIComponent(INNER_SVG)}`,
      );
      expect(["x", "y", "width", "height"].map((a) => image.getAttribute(a))).toEqual([
        "5",
        "6",
        "30",
        "40",
      ]);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("keeps paint order across swatches and graphics, and text on top", () => {
    const layer = renderChartExportLayer(
      model({
        runs: [run()],
        swatches: [{ x: 0, y: 0, width: 4, height: 4, fill: "rgb(1, 1, 1)", radius: 0, order: 2 }],
        graphics: [{ kind: "svg", x: 0, y: 0, width: 4, height: 4, content: INNER_SVG, order: 1 }],
      }),
    );
    expect([...layer.children].map((c) => c.localName)).toEqual(["svg", "rect", "text"]);
  });

  it("puts what stacks beneath the chart in the underlay, never in the layer", () => {
    const m = model({
      swatches: [
        {
          x: 0,
          y: 0,
          width: 200,
          height: 100,
          fill: "rgb(9, 9, 9)",
          radius: 0,
          under: true,
          order: 0,
        },
        { x: 0, y: 0, width: 4, height: 4, fill: "rgb(1, 1, 1)", radius: 0, order: 1 },
      ],
    });
    const underlay = renderChartExportUnderlay(m)!;
    expect(underlay.getAttribute("data-slot")).toBe("chart-export-underlay");
    expect(underlay.querySelectorAll("rect")).toHaveLength(1);
    expect(underlay.querySelector("rect")?.getAttribute("fill")).toBe("rgb(9, 9, 9)");
    const layer = renderChartExportLayer(m);
    expect([...layer.querySelectorAll("rect")].map((r) => r.getAttribute("fill"))).toEqual([
      "rgb(1, 1, 1)",
    ]);
    expect(renderChartExportUnderlay(model())).toBeNull();
  });

  it("cuts a clipped run to its clip box under a deterministic id", () => {
    const m = model({
      runs: [run({ clip: 0 })],
      clips: [{ x: 0, y: 0, width: 50, height: 30 }],
    });
    const layer = renderChartExportLayer(m);
    const wrapper = layer.querySelector("g[clip-path]")!;
    const id = /^url\(#(.+)\)$/.exec(wrapper.getAttribute("clip-path")!)![1]!;
    const clipRect = layer.querySelector(`clipPath[id="${id}"] rect`)!;
    expect(["x", "y", "width", "height"].map((a) => clipRect.getAttribute(a))).toEqual([
      "0",
      "0",
      "50",
      "30",
    ]);
    expect(wrapper.querySelector("text")?.textContent).toBe("42");
    // Same model, same ids: the file is reproducible.
    expect(serializeSvg(renderChartExportLayer(m) as unknown as SVGSVGElement)).toBe(
      serializeSvg(layer as unknown as SVGSVGElement),
    );
  });

  it("draws a gradient ramp, per-corner radii, a dashed ring and a turned box", () => {
    const layer = renderChartExportLayer(
      model({
        swatches: [
          {
            x: 0,
            y: 0,
            width: 100,
            height: 8,
            fill: "none",
            radius: 0,
            gradient: {
              x1: 0,
              y1: 4,
              x2: 4,
              y2: 4,
              repeat: true,
              stops: [
                { offset: 0, color: "rgb(0, 0, 0)" },
                { offset: 1, color: "rgb(255, 255, 255)" },
              ],
            },
          },
          {
            x: 0,
            y: 10,
            width: 20,
            height: 10,
            fill: "rgb(1, 1, 1)",
            radius: 4,
            radii: [4, 4, 0, 0],
          },
          {
            x: 0,
            y: 30,
            width: 8,
            height: 8,
            fill: "none",
            radius: 4,
            stroke: "rgb(2, 2, 2)",
            strokeWidth: 1.5,
            strokeDasharray: "4.5 3",
          },
          {
            x: 0,
            y: 40,
            width: 6,
            height: 6,
            fill: "rgb(3, 3, 3)",
            radius: 0,
            transform: "rotate(45 3 43)",
          },
        ],
      }),
    );
    const [ramp, rounded, ring, diamond] = [...layer.children].filter(
      (c) => c.localName !== "defs",
    );
    const gradientId = /^url\(#(.+)\)$/.exec(ramp!.getAttribute("fill")!)![1]!;
    const gradient = layer.querySelector(`linearGradient[id="${gradientId}"]`)!;
    expect(gradient.getAttribute("spreadMethod")).toBe("repeat");
    expect(gradient.getAttribute("gradientUnits")).toBe("userSpaceOnUse");
    expect(gradient.querySelectorAll("stop")).toHaveLength(2);
    expect(rounded!.localName).toBe("path");
    expect(rounded!.getAttribute("d")).toContain("A4 4");
    expect(ring!.getAttribute("stroke")).toBe("rgb(2, 2, 2)");
    expect(ring!.getAttribute("stroke-dasharray")).toBe("4.5 3");
    expect(ring!.getAttribute("fill")).toBe("none");
    expect(diamond!.getAttribute("transform")).toBe("rotate(45 3 43)");
  });

  it("keeps a run's alignment, figures and opacity", () => {
    const layer = renderChartExportLayer(
      model({
        runs: [run({ anchor: "middle", fontVariantNumeric: "tabular-nums", opacity: 0.5 })],
      }),
    );
    const text = layer.querySelector("text")!;
    expect(text.getAttribute("text-anchor")).toBe("middle");
    expect(text.getAttribute("opacity")).toBe("0.5");
    expect(text.getAttribute("style")).toContain("tabular-nums");
  });
});

describe("sanitizeXml / serializeSvg", () => {
  it("replaces characters XML forbids and keeps everything else", () => {
    expect(sanitizeXml("a\u0001b\u001Fc")).toBe("a\uFFFDb\uFFFDc");
    expect(sanitizeXml("lone \uD800 high")).toBe("lone \uFFFD high");
    expect(sanitizeXml("tab\tline\nemoji 😀")).toBe("tab\tline\nemoji 😀");
  });

  it("serialises a chart holding a control character without it", () => {
    const svg = fakeChartSvg();
    const path = svg.querySelector("path")!;
    path.setAttribute("data-edge", "Receive\u0001Approve");
    const markup = serializeSvg(buildExportSvg(svg));
    // (jsdom's serializer repeats `xmlns`, so a parse check here would test jsdom.)
    expect(markup).not.toContain("\u0001");
    expect(markup).toContain("Receive\uFFFDApprove");
  });
});

describe("findChartSvg / hasChartSvg", () => {
  function container() {
    const root = document.createElement("div");
    const button = document.createElement("button");
    button.append(withRect(document.createElementNS(SVG_NS, "svg"), 16, 16));
    const toolbar = document.createElement("div");
    toolbar.setAttribute("role", "toolbar");
    toolbar.append(withRect(document.createElementNS(SVG_NS, "svg"), 16, 16));
    const marker = withRect(document.createElementNS(SVG_NS, "svg"), 10, 10);
    const chart = withRect(document.createElementNS(SVG_NS, "svg"), 400, 200);
    chart.append(withRect(document.createElementNS(SVG_NS, "svg"), 500, 500)); // nested, never a candidate
    root.append(button, toolbar, marker, chart);
    return { root, marker, chart };
  }

  it("picks the largest top-level svg that is not a control's glyph", () => {
    const { root, chart } = container();
    expect(findChartSvg(root)).toBe(chart);
    expect(hasChartSvg(root)).toBe(true);
  });

  it("falls back to the first candidate when nothing has a size yet", () => {
    const root = document.createElement("div");
    const icon = document.createElement("button");
    icon.append(document.createElementNS(SVG_NS, "svg"));
    const first = document.createElementNS(SVG_NS, "svg");
    root.append(icon, first, document.createElementNS(SVG_NS, "svg"));
    expect(findChartSvg(root)).toBe(first);
  });

  it("finds no chart among controls alone", () => {
    const root = document.createElement("div");
    const button = document.createElement("button");
    button.append(document.createElementNS(SVG_NS, "svg"));
    root.append(button);
    expect(findChartSvg(root)).toBeNull();
    expect(hasChartSvg(root)).toBe(false);
  });

  it("reads a percentage size as no pixel size", () => {
    const svg = withRect(document.createElementNS(SVG_NS, "svg"), 320, 180) as SVGSVGElement;
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    expect(readSvgSize(svg)).toEqual({ width: 320, height: 180 });
  });
});

describe("buildExportSvg with an underlay", () => {
  const underlaid = (overrides: Partial<ChartExportLayerModel> = {}) =>
    model({
      swatches: [
        { x: 0, y: 0, width: 200, height: 100, fill: "rgb(9, 9, 9)", radius: 0, under: true },
      ],
      runs: [run()],
      ...overrides,
    });

  it("framed: frame background, then the underlay, then the chart, then the layer", () => {
    const built = buildExportSvg(fakeChartSvg(), {
      layer: underlaid(),
      backgroundColor: "rgb(255, 255, 255)",
      title: "Chart",
    });
    expect([...built.children].map((c) => c.getAttribute("data-slot") ?? c.localName)).toEqual([
      "title",
      "rect",
      "chart-export-underlay",
      "svg",
      "chart-export-layer",
    ]);
    // The clone's own background would cover the underlay; the frame paints it instead.
    const clone = [...built.children].find((c) => c.localName === "svg")!;
    expect(clone.firstElementChild?.localName).toBe("path");
  });

  it("in place: the underlay sits right on the background", () => {
    const built = buildExportSvg(fakeChartSvg(), {
      layer: underlaid({ width: 100, height: 60, chart: { x: 0, y: 0, width: 100, height: 60 } }),
    });
    const [background, underlay] = [...built.children];
    expect(background?.localName).toBe("rect");
    expect(underlay?.getAttribute("data-slot")).toBe("chart-export-underlay");
    expect(built.lastElementChild?.getAttribute("data-slot")).toBe("chart-export-layer");
  });

  it("in the svg's user space: the underlay takes the same transform", () => {
    const built = buildExportSvg(fakeChartSvg(), {
      layer: underlaid({
        width: 100,
        height: 60,
        chart: { x: 0, y: 0, width: 100, height: 60 },
        userSpace: "matrix(2 0 0 2 0 0)",
      }),
    });
    const underlay = built.querySelector('[data-slot="chart-export-underlay"]')!;
    expect(underlay.getAttribute("transform")).toBe("matrix(2 0 0 2 0 0)");
    expect(underlay.previousElementSibling?.localName).toBe("rect");
  });

  it("a layer with only graphics still paints", () => {
    const built = buildExportSvg(fakeChartSvg(), {
      layer: model({
        width: 100,
        height: 60,
        chart: { x: 0, y: 0, width: 100, height: 60 },
        userSpace: "matrix(1 0 0 1 0 0)",
        graphics: [{ kind: "svg", x: 0, y: 0, width: 10, height: 10, content: INNER_SVG }],
      }),
    });
    expect(built.querySelector('[data-slot="chart-export-layer"] svg')).not.toBeNull();
  });

  it("framed: a chart its scroller cuts is cut to the same box", () => {
    const built = buildExportSvg(fakeChartSvg(), {
      layer: model({
        chart: { x: 0, y: 20, width: 200, height: 600, clip: 0 },
        clips: [{ x: 0, y: 20, width: 200, height: 80 }],
      }),
    });
    const cut = built.querySelector('[data-slot="chart-export-chart-clip"]')!;
    expect(cut.lastElementChild?.localName).toBe("svg");
    const id = /^url\(#(.+)\)$/.exec(cut.getAttribute("clip-path") ?? "")![1]!;
    const box = built.querySelector(`clipPath[id="${id}"] rect`)!;
    expect(["x", "y", "width", "height"].map((a) => box.getAttribute(a))).toEqual([
      "0",
      "20",
      "200",
      "80",
    ]);
  });
});

describe("paints", () => {
  it.each([
    "rgb(0, 0, 0)",
    "rgb(255, 0, 0)",
    "rgb(255, 153, 0)",
    "rgba(0, 0, 0, 0.5)",
    "hsl(30, 100%, 50%)",
    "oklch(0.5 0.1 200)",
    "rgb(0 0 0 / 0.4)",
  ])("%s paints", (color) => {
    expect(paints(color)).toBe(true);
  });

  it.each([
    "",
    "transparent",
    "rgba(0, 0, 0, 0)",
    "rgba(255, 0, 0, 0)",
    "hsla(30, 100%, 50%, 0)",
    "rgb(0 0 0 / 0)",
    "oklch(0.5 0.1 200 / 0)",
    "oklab(0.5 0 0 / 0%)",
  ])("%j paints nothing", (color) => {
    expect(paints(color)).toBe(false);
  });
});

describe("parseLinearGradient — Chromium's computed serialisations", () => {
  const RED = "rgb(255, 0, 0)";
  const BLUE = "rgb(0, 0, 255)";
  const stops = (g: ReturnType<typeof parseLinearGradient>) =>
    g?.stops.map((s) => [s.offset, s.color]);

  it("runs top to bottom by default", () => {
    const g = parseLinearGradient(`linear-gradient(${RED}, ${BLUE})`, 0, 0, 100, 20);
    expect(g).toMatchObject({ x1: 50, y1: 0, x2: 50, y2: 20 });
    expect(stops(g)).toEqual([
      [0, RED],
      [1, BLUE],
    ]);
  });

  it.each(["to right in oklab", "to right in oklch longer hue", "90deg in srgb"])(
    "reads the direction past an interpolation space: %s",
    (config) => {
      const g = parseLinearGradient(`linear-gradient(${config}, ${RED}, ${BLUE})`, 0, 0, 100, 20);
      expect(g).toMatchObject({ x1: 0, y1: 10, x2: 100, y2: 10 });
    },
  );

  it("skips a bare interpolation space and keeps the default direction", () => {
    const g = parseLinearGradient(`linear-gradient(in oklab, ${RED}, ${BLUE})`, 0, 0, 100, 20);
    expect(g).toMatchObject({ x1: 50, y1: 0, x2: 50, y2: 20 });
    expect(stops(g)).toHaveLength(2);
  });

  it("aims a corner keyword across the box's own diagonal", () => {
    const square = parseLinearGradient(
      `linear-gradient(to bottom left, ${RED}, ${BLUE})`,
      0,
      0,
      100,
      100,
    );
    expect(square).toMatchObject({ x1: 100, y1: 0, x2: 0, y2: 100 });
    // On a wide box the line stays perpendicular to the other diagonal (CSS's corner rule).
    const wide = parseLinearGradient(
      `linear-gradient(to top right, ${RED}, ${BLUE})`,
      0,
      0,
      100,
      20,
    )!;
    const [dx, dy] = [wide.x2 - wide.x1, wide.y2 - wide.y1];
    expect(dx).toBeGreaterThan(0);
    expect(dy).toBeLessThan(0);
    // cos(angle to the diagonal) ≈ 0, to the endpoints' two-decimal rounding.
    expect(Math.abs(dx * 100 + dy * 20) / (Math.hypot(dx, dy) * Math.hypot(100, 20))).toBeLessThan(
      1e-3,
    );
  });

  it("places percentage stops along the line and spreads unplaced ones evenly", () => {
    expect(
      stops(parseLinearGradient(`linear-gradient(90deg, ${RED} 25%, ${BLUE} 75%)`, 0, 0, 100, 20)),
    ).toEqual([
      [0.25, RED],
      [0.75, BLUE],
    ]);
    const lime = "rgb(0, 255, 0)";
    expect(
      stops(parseLinearGradient(`linear-gradient(90deg, ${RED}, ${lime}, ${BLUE})`, 0, 0, 100, 20)),
    ).toEqual([
      [0, RED],
      [0.5, lime],
      [1, BLUE],
    ]);
  });

  it("repeats a stripe over its own period", () => {
    const clear = "rgba(0, 0, 0, 0)";
    const g = parseLinearGradient(
      `repeating-linear-gradient(45deg, ${RED} 0px, ${RED} 2px, ${clear} 2px, ${clear} 4px)`,
      0,
      0,
      100,
      100,
    );
    expect(g).toMatchObject({ x1: 0, y1: 100, x2: 2.83, y2: 97.17, repeat: true });
    expect(stops(g)).toEqual([
      [0, RED],
      [0.5, RED],
      [0.5, clear],
      [1, clear],
    ]);
  });

  it("leaves any other image to the page", () => {
    expect(parseLinearGradient(`radial-gradient(${RED}, ${BLUE})`, 0, 0, 10, 10)).toBeUndefined();
    expect(parseLinearGradient('url("ramp.png")', 0, 0, 10, 10)).toBeUndefined();
  });
});
