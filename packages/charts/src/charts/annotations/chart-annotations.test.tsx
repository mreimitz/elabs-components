import { cleanup, render } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@visx/responsive", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- vi.mock factory is hoisted; lazy require avoids TDZ
  const React = require("react");
  return {
    ParentSize: ({
      children,
    }: {
      children: (size: { width: number; height: number }) => React.ReactNode;
    }) => React.createElement("div", null, children({ width: 900, height: 400 })),
  };
});

import { Bar } from "../bar";
import { BarChart } from "../bar-chart";
import type { ChartBreakpoint } from "../chart-breakpoint";
import { ChartConfigProvider } from "../chart-config-context";
import { Line } from "../line";
import { LineChart } from "../line-chart";
import { AnnotationKey } from "./annotation-key";
import {
  type ChartAnnotation,
  circledNumber,
  describeAnnotations,
  planAnnotations,
  withAnnotationDescription,
} from "./annotation-types";
import { BIKES_ANNOTATIONS, BIKES_DATA, BIKES_SERIES } from "./bikes-fixture";
import { ChartAnnotations } from "./chart-annotations";
import { annotationValueToDate, bandAxis, valueAxis } from "./resolve-annotation-position";

afterEach(cleanup);

// jsdom has no SVG geometry; `Line` measures its path for the draw-in.
beforeAll(() => {
  Object.defineProperty(SVGElement.prototype, "getTotalLength", {
    configurable: true,
    value: () => 100,
  });
});

function Bikes({
  breakpoint,
  annotations = BIKES_ANNOTATIONS,
}: {
  breakpoint: ChartBreakpoint;
  annotations?: ChartAnnotation[];
}): ReactNode {
  return (
    <ChartConfigProvider value={{ breakpoint }}>
      <LineChart
        accessibleDescription={withAnnotationDescription("Cycle traffic.", annotations)}
        accessibleLabel="Bikes"
        data={BIKES_DATA}
        xDataKey="date"
      >
        {BIKES_SERIES.map((s) => (
          <Line dataKey={s.key} key={s.key} stroke={s.color} />
        ))}
        <ChartAnnotations annotations={annotations} />
      </LineChart>
      <AnnotationKey annotations={annotations} />
    </ChartConfigProvider>
  );
}

const slot = (root: ParentNode, name: string) => root.querySelectorAll(`[data-slot="${name}"]`);

describe("planAnnotations", () => {
  it("paints every note at wide and keys them, numbered in array order, at narrow", () => {
    expect(new Set(planAnnotations(BIKES_ANNOTATIONS, "wide").map((e) => e.display))).toEqual(
      new Set(["painted"]),
    );
    const narrow = planAnnotations(BIKES_ANNOTATIONS, "narrow");
    expect(narrow.filter((e) => e.display === "keyed").map((e) => e.number)).toEqual([1, 2, 3, 4]);
  });

  it("hides a note whose showAt resolves false, and never keys it", () => {
    const note: ChartAnnotation = {
      kind: "text",
      x: 1,
      y: 1,
      text: "Only on desktop",
      showAt: { base: true, narrow: false },
    };
    expect(planAnnotations([note], "narrow")[0]?.display).toBe("hidden");
    expect(planAnnotations([note], "wide")[0]?.display).toBe("painted");
  });

  it("circles 1–20 and parenthesises beyond", () => {
    expect(circledNumber(1)).toBe("①");
    expect(circledNumber(4)).toBe("④");
    expect(circledNumber(21)).toBe("(21)");
  });
});

describe("describeAnnotations", () => {
  it("restates every annotation once, in array order", () => {
    expect(describeAnnotations(BIKES_ANNOTATIONS)).toBe(
      "Covid-19. ±0. Paris opens 50 km of pop-up cycle lanes and keeps them. " +
        "Berlin’s lockdown empties the commute. London’s low-traffic streets hold the gain. " +
        "New York slips back below 2019.",
    );
    expect(withAnnotationDescription("Cycle traffic", BIKES_ANNOTATIONS.slice(0, 1))).toBe(
      "Cycle traffic. Covid-19.",
    );
    expect(withAnnotationDescription("Only this.", [])).toBe("Only this.");
  });

  it("strips the inline bold markers", () => {
    expect(describeAnnotations([{ kind: "text", x: 1, y: 1, text: "A **big** jump" }])).toBe(
      "A big jump.",
    );
  });
});

describe("annotation axes", () => {
  it("reads ISO date strings in local time", () => {
    expect(annotationValueToDate("2020-03-01")?.getTime()).toBe(new Date(2020, 2, 1).getTime());
    expect(annotationValueToDate("not a date")).toBeUndefined();
  });

  it("places a category at its band centre and spans bands edge to edge", () => {
    const starts: Record<string, number> = { a: 0, b: 50, c: 100 };
    const scale = Object.assign((v: string) => starts[v], { bandwidth: () => 40 });
    const axis = bandAxis(scale);
    expect(axis.point("b")).toBe(70);
    expect(axis.span("c", "a")).toEqual([0, 140]);
    expect(axis.point("missing")).toBeUndefined();
  });

  it("maps numbers (and numeric strings) through a value scale", () => {
    const axis = valueAxis(((v: number) => v * 2) as never);
    expect(axis.point(3)).toBe(6);
    expect(axis.point("4")).toBe(8);
    expect(axis.point("x")).toBeUndefined();
  });
});

describe("ChartAnnotations in a LineChart", () => {
  it("paints four notes, the range under the series and the line over them at wide", () => {
    const { container } = render(<Bikes breakpoint="wide" />);
    expect(slot(container, "chart-annotations-text")).toHaveLength(4);
    expect(slot(container, "chart-annotations-marker")).toHaveLength(0);
    expect(slot(container, "annotation-key-item")).toHaveLength(0);

    const back = container.querySelector('[data-slot="chart-annotations"][data-layer="back"]');
    const front = container.querySelector('[data-slot="chart-annotations"][data-layer="front"]');
    expect(back && slot(back, "chart-annotations-range")).toHaveLength(1);
    expect(front && slot(front, "chart-annotations-line")).toHaveLength(1);
    const series = container.querySelector("path");
    expect(back && series && back.compareDocumentPosition(series)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(front && series && front.compareDocumentPosition(series)).toBe(
      Node.DOCUMENT_POSITION_PRECEDING,
    );
  });

  it("uses the furniture ink, undimmed, for the range fill and the reference line", () => {
    const { container } = render(<Bikes breakpoint="wide" />);
    const range = container.querySelector('[data-slot="chart-annotations-range"] rect');
    expect(range?.getAttribute("fill")).toBe("var(--chart-grid)");
    const line = container.querySelector('[data-slot="chart-annotations-line"] line');
    expect(line?.getAttribute("stroke")).toBe("var(--chart-grid)");
    expect(line?.getAttribute("stroke-opacity")).toBeNull();
    expect(line?.getAttribute("stroke-width")).toBe("2");
  });

  it("inks a series note with that series' stroke", () => {
    const { container } = render(<Bikes breakpoint="wide" />);
    const note = container.querySelector(
      '[data-slot="chart-annotations-text"] [data-slot="marginalia-note"]',
    );
    expect(note?.getAttribute("fill")).toBe("var(--chart-1)");
  });

  it("swaps the notes for numbered markers and a four-row key at narrow", () => {
    const { container } = render(<Bikes breakpoint="narrow" />);
    expect(slot(container, "chart-annotations-text")).toHaveLength(0);
    const markers = [...slot(container, "chart-annotations-marker")];
    expect(markers.map((m) => m.textContent)).toEqual(["1", "2", "3", "4"]);
    const rows = slot(container, "annotation-key-item");
    expect(rows).toHaveLength(4);
    expect(rows[0]?.textContent).toBe("①Paris opens 50 km of pop-up cycle lanes and keeps them");
  });

  it.each(["wide", "narrow"] as const)("keeps every note in the description at %s", (tier) => {
    const { getByRole } = render(<Bikes breakpoint={tier} />);
    const figure = getByRole("figure", { name: "Bikes" });
    const description = document.getElementById(figure.getAttribute("aria-describedby") ?? "");
    for (const text of ["Covid-19.", "Paris opens", "Berlin’s lockdown", "London’s", "New York"]) {
      expect(description?.textContent).toContain(text);
    }
  });

  it("hides a showAt-false note and its marker at narrow, keeping its description", () => {
    const annotations: ChartAnnotation[] = [
      {
        kind: "text",
        x: new Date(2021, 0, 1),
        y: 10,
        text: "Desktop-only note",
        showAt: { base: true, narrow: false },
      },
    ];
    const { container, getByRole } = render(
      <Bikes annotations={annotations} breakpoint="narrow" />,
    );
    expect(slot(container, "chart-annotations-marker")).toHaveLength(0);
    expect(slot(container, "annotation-key-item")).toHaveLength(0);
    const figure = getByRole("figure", { name: "Bikes" });
    const description = document.getElementById(figure.getAttribute("aria-describedby") ?? "");
    expect(description?.textContent).toContain("Desktop-only note.");
  });
});

describe("the annotations prop on LineChart", () => {
  const PropBikes = ({ breakpoint }: { breakpoint: ChartBreakpoint }) => (
    <ChartConfigProvider value={{ breakpoint }}>
      <LineChart
        accessibleDescription="Cycle traffic."
        accessibleLabel="Bikes"
        annotations={BIKES_ANNOTATIONS}
        data={BIKES_DATA}
        xDataKey="date"
      >
        {BIKES_SERIES.map((s) => (
          <Line dataKey={s.key} key={s.key} stroke={s.color} />
        ))}
      </LineChart>
    </ChartConfigProvider>
  );

  it("paints the notes at wide and stacks no key rows", () => {
    const { container } = render(<PropBikes breakpoint="wide" />);
    expect(slot(container, "chart-annotations-text")).toHaveLength(4);
    expect(slot(container, "annotation-key-item")).toHaveLength(0);
  });

  it("keys the notes under the plot at narrow and merges them into the description", () => {
    const { container, getByRole } = render(<PropBikes breakpoint="narrow" />);
    const host = container.querySelector('[data-slot="chart-annotations-host"]');
    expect(host?.lastElementChild?.getAttribute("data-slot")).toBe("annotation-key");
    expect(slot(container, "annotation-key-item")).toHaveLength(4);
    const figure = getByRole("figure", { name: "Bikes" });
    const description = document.getElementById(figure.getAttribute("aria-describedby") ?? "");
    expect(description?.textContent).toContain("Cycle traffic.");
    expect(description?.textContent).toContain("Covid-19.");
  });

  it("renders the bare chart, with no host wrapper, when there are no annotations", () => {
    const { container } = render(
      <LineChart accessibleLabel="Bikes" data={BIKES_DATA} xDataKey="date">
        <Line dataKey="paris" />
      </LineChart>,
    );
    expect(slot(container, "chart-annotations-host")).toHaveLength(0);
    expect(slot(container, "annotation-key")).toHaveLength(0);
  });
});

describe("ChartAnnotations in a horizontal BarChart", () => {
  it("pins a row note to its category, wherever the row sorts", () => {
    const data = [
      { team: "Alpha", score: 30 },
      { team: "Beta", score: 80 },
    ];
    const rowY = (rows: typeof data) => {
      const { container } = render(
        <BarChart data={rows} orientation="horizontal" xDataKey="team">
          <Bar dataKey="score" />
          <ChartAnnotations annotations={[{ kind: "row", category: "Beta", text: "Record" }]} />
        </BarChart>,
      );
      const note = container.querySelector('[data-slot="chart-annotations-row"]');
      expect(note?.textContent).toBe("Record");
      const y = Number(note?.getAttribute("y"));
      cleanup();
      return y;
    };
    const before = rowY(data);
    const after = rowY([...data].reverse());
    expect(Number.isFinite(before) && Number.isFinite(after)).toBe(true);
    expect(before).not.toBe(after);
  });
});
