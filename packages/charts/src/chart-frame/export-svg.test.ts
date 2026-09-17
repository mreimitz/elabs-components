import { describe, expect, it } from "vitest";

import { composeSvg, type ComposeSvgPart } from "./export-svg";

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
