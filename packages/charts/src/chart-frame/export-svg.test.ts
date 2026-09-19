import { describe, expect, it } from "vitest";

import { buildExportSvg, composeSvg, serializeSvg, type ComposeSvgPart } from "./export-svg";
import { renderChartExportLayer, type ChartExportLayerModel } from "./export-layer";

const SVG_NS = "http://www.w3.org/2000/svg";

function fakeChartSvg(markCount: number): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg") as unknown as SVGSVGElement;
  svg.setAttribute("width", "100");
  svg.setAttribute("height", "60");
  svg.setAttribute("aria-hidden", "true");
  for (let i = 0; i < markCount; i++) {
    svg.appendChild(document.createElementNS(SVG_NS, "rect"));
  }
  return svg;
}

describe("composeSvg (RM-084)", () => {
  it("emits one <g transform> per part, at the part's x/y, sized to its w/h", () => {
    const parts: ComposeSvgPart[] = [
      { svg: fakeChartSvg(3), x: 0, y: 0, width: 200, height: 100, title: "Revenue" },
      { svg: fakeChartSvg(5), x: 200, y: 0, width: 200, height: 100, title: "Churn" },
    ];
    const composed = composeSvg(parts, { width: 400, height: 100 });
    const groups = Array.from(composed.querySelectorAll("g"));
    expect(groups).toHaveLength(2);
    expect(groups[0]?.getAttribute("transform")).toBe("translate(0, 0)");
    expect(groups[1]?.getAttribute("transform")).toBe("translate(200, 0)");
    expect(groups[0]?.querySelector("title")?.textContent).toBe("Revenue");

    // Mark count survives composition (the acceptance's "same mark count as the live chart").
    expect(groups[0]?.querySelectorAll("rect")).toHaveLength(3);
    expect(groups[1]?.querySelectorAll("rect")).toHaveLength(5);

    // Nested <svg> carries the part's own size, not the source chart's original size.
    const nested = groups[0]?.querySelector("svg");
    expect(nested?.getAttribute("width")).toBe("200");
    expect(nested?.getAttribute("height")).toBe("100");
  });

  it("offsets every part's group by the title row height when a title is set", () => {
    const parts: ComposeSvgPart[] = [{ svg: fakeChartSvg(1), x: 10, y: 20, width: 50, height: 50 }];
    const withTitle = composeSvg(parts, { width: 100, height: 50, title: "Q3 sales" });
    const withoutTitle = composeSvg(parts, { width: 100, height: 50 });
    const yWith = withTitle.querySelector("g")?.getAttribute("transform");
    const yWithout = withoutTitle.querySelector("g")?.getAttribute("transform");
    expect(yWithout).toBe("translate(10, 20)");
    expect(yWith).not.toBe(yWithout);
    expect(withTitle.querySelector("text")?.textContent).toBe("Q3 sales");
  });

  it("appends one source row when `source` is set, none when it is not", () => {
    const parts: ComposeSvgPart[] = [{ svg: fakeChartSvg(1), x: 0, y: 0, width: 50, height: 50 }];
    const withSource = composeSvg(parts, { width: 50, height: 50, source: "Internal CRM" });
    const withoutSource = composeSvg(parts, { width: 50, height: 50 });
    const sourceTexts = Array.from(withSource.querySelectorAll("text")).filter(
      (t) => t.textContent === "Internal CRM",
    );
    expect(sourceTexts).toHaveLength(1);
    expect(Array.from(withoutSource.querySelectorAll("text"))).toHaveLength(0);
  });

  it("is deterministic: two calls with the same parts/options serialise identically", () => {
    const parts: ComposeSvgPart[] = [
      { svg: fakeChartSvg(2), x: 0, y: 0, width: 80, height: 40, title: "A" },
    ];
    const options = { width: 80, height: 40, title: "Sheet", source: "Data" };
    const a = new XMLSerializer().serializeToString(composeSvg(parts, options));
    const b = new XMLSerializer().serializeToString(composeSvg(parts, options));
    expect(a).toBe(b);
  });

  it("paints the resolved background behind every part", () => {
    const composed = composeSvg([], { width: 10, height: 10, backgroundColor: "rgb(1, 2, 3)" });
    expect(composed.querySelector("rect")?.getAttribute("fill")).toBe("rgb(1, 2, 3)");
  });

  it("carries role=img and aria-labelledby pointing at a root <title> as the first child", () => {
    const composed = composeSvg([], { width: 10, height: 10, title: "Q3 sales" });
    expect(composed.getAttribute("role")).toBe("img");
    const title = composed.firstElementChild;
    expect(title?.tagName).toBe("title");
    expect(title?.textContent).toBe("Q3 sales");
    expect(title?.getAttribute("id")).toBeTruthy();
    expect(composed.getAttribute("aria-labelledby")).toBe(title?.getAttribute("id"));
  });

  it("falls back to a non-empty root title when `title` is not set — every export needs a name", () => {
    const composed = composeSvg([], { width: 10, height: 10 });
    const title = composed.firstElementChild;
    expect(title?.tagName).toBe("title");
    expect(title?.textContent).toBeTruthy();
    expect(composed.getAttribute("aria-labelledby")).toBe(title?.getAttribute("id"));
  });

  it("adds a root <desc> + aria-describedby only when `description` is set", () => {
    const withDesc = composeSvg([], {
      width: 10,
      height: 10,
      title: "Q3 sales",
      description: "Revenue by region, EMEA vs APAC.",
    });
    const desc = withDesc.querySelector("desc");
    expect(desc?.textContent).toBe("Revenue by region, EMEA vs APAC.");
    expect(withDesc.getAttribute("aria-describedby")).toBe(desc?.getAttribute("id"));

    const withoutDesc = composeSvg([], { width: 10, height: 10, title: "Q3 sales" });
    expect(withoutDesc.querySelector("desc")).toBeNull();
    expect(withoutDesc.getAttribute("aria-describedby")).toBeNull();
  });
});

// ── RM-117: the export layer ─────────────────────────────────────────────────

describe("buildExportSvg with an export layer (RM-117)", () => {
  const layer: ChartExportLayerModel = {
    width: 640,
    height: 480,
    chart: { x: 24, y: 80, width: 300, height: 150 },
    swatches: [{ x: 24, y: 60, width: 10, height: 10, fill: "rgb(1, 2, 3)", radius: 2 }],
    runs: [
      {
        role: "title",
        text: "RAM prices doubled",
        x: 24,
        y: 30,
        fill: "rgb(0, 0, 0)",
        fontFamily: "Inter",
        fontSize: "16px",
        fontWeight: "600",
        fontStyle: "normal",
      },
      {
        role: "tick",
        text: "Jan",
        x: 40,
        y: 240,
        fill: "rgb(9, 9, 9)",
        fontFamily: "Inter",
        fontSize: "12px",
        fontWeight: "400",
        fontStyle: "normal",
      },
      {
        role: "tick",
        text: "Feb",
        x: 80,
        y: 240,
        rotate: -45,
        fill: "rgb(9, 9, 9)",
        fontFamily: "Inter",
        fontSize: "12px",
        fontWeight: "400",
        fontStyle: "normal",
      },
      {
        role: "notes",
        text: "Prices in USD.",
        x: 24,
        y: 420,
        fill: "rgb(9, 9, 9)",
        fontFamily: "Inter",
        fontSize: "12px",
        fontWeight: "400",
        fontStyle: "italic",
      },
    ],
  };

  it("places the chart at its measured box inside a canvas the frame's size", () => {
    const built = buildExportSvg(fakeChartSvg(3), {
      layer,
      backgroundColor: "rgb(255, 255, 255)",
      title: "RAM",
    });
    expect(built.getAttribute("width")).toBe("640");
    expect(built.getAttribute("height")).toBe("480");
    const nested = built.querySelector("svg")!;
    expect([nested.getAttribute("x"), nested.getAttribute("y")]).toEqual(["24", "80"]);
    const texts = [...built.querySelectorAll('[data-slot="chart-export-layer"] text')];
    expect(texts.map((t) => [t.getAttribute("data-export-role"), t.textContent])).toEqual([
      ["title", "RAM prices doubled"],
      ["tick", "Jan"],
      ["tick", "Feb"],
      ["notes", "Prices in USD."],
    ]);
    expect(texts[2]!.getAttribute("transform")).toBe("rotate(-45 80 240)");
    expect(texts[3]!.getAttribute("font-style")).toBe("italic");
    expect(built.querySelector('[data-slot="chart-export-layer"] rect')!.getAttribute("rx")).toBe(
      "2",
    );
    expect(serializeSvg(built)).not.toContain("var(");
  });

  it("is deterministic: the same model serialises byte-identically", () => {
    const a = serializeSvg(renderChartExportLayer(layer) as unknown as SVGSVGElement);
    const b = serializeSvg(renderChartExportLayer(layer) as unknown as SVGSVGElement);
    expect(a).toBe(b);
  });

  it("appends in place when the layer's canvas is the chart's own box (a dashboard part)", () => {
    const svg = fakeChartSvg(2);
    const inPlace: ChartExportLayerModel = {
      ...layer,
      width: 100,
      height: 60,
      chart: { x: 0, y: 0, width: 100, height: 60 },
    };
    const built = buildExportSvg(svg, { layer: inPlace });
    const before = buildExportSvg(svg);
    expect(built.getAttribute("width")).toBe(before.getAttribute("width"));
    expect(built.getAttribute("viewBox")).toBe(before.getAttribute("viewBox"));
    expect(built.lastElementChild?.getAttribute("data-slot")).toBe("chart-export-layer");
  });

  it("maps a layer measured in the svg's own box into its user space, untouched otherwise", () => {
    const svg = fakeChartSvg(2);
    const before = buildExportSvg(svg);
    // A part drawn at 98.4 % of its viewBox: CSS pixels need scaling back up.
    const measured: ChartExportLayerModel = {
      ...layer,
      width: 98.4,
      height: 59.04,
      chart: { x: 0, y: 0, width: 98.4, height: 59.04 },
      userSpace: "matrix(1.01626 0 0 1.01626 0 0)",
    };
    const built = buildExportSvg(svg, { layer: measured });
    expect(built.getAttribute("width")).toBe(before.getAttribute("width"));
    expect(built.getAttribute("height")).toBe(before.getAttribute("height"));
    expect(built.getAttribute("viewBox")).toBe(before.getAttribute("viewBox"));
    const group = built.lastElementChild;
    expect(group?.getAttribute("data-slot")).toBe("chart-export-layer");
    expect(group?.getAttribute("transform")).toBe("matrix(1.01626 0 0 1.01626 0 0)");
    // Everything but the layer is the plain export, byte for byte.
    group?.remove();
    expect(serializeSvg(built)).toBe(serializeSvg(before));
  });

  it("adds nothing for an empty layer measured in the svg's own box", () => {
    const svg = fakeChartSvg(2);
    const empty: ChartExportLayerModel = {
      width: 100,
      height: 60,
      chart: { x: 0, y: 0, width: 100, height: 60 },
      runs: [],
      swatches: [],
      userSpace: "matrix(1 0 0 1 0 0)",
    };
    expect(serializeSvg(buildExportSvg(svg, { layer: empty }))).toBe(
      serializeSvg(buildExportSvg(svg)),
    );
  });
});
