import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CHART_DASH, EXCLUDED_DASH_ARRAY, LINE_STYLE_DASH } from "../charts/chart-stroke";
import {
  ANALYTIC_DASH,
  ANALYTIC_DASHES,
  ANALYTIC_SOLID_RHYTHMS,
} from "../charts/analytics/derived-series";
import { ReferenceRule, TrendRule } from "./reference-rule";

const svg = (node: React.ReactNode) => render(<svg>{node}</svg>).container.querySelector("svg")!;

// RM-188 pixel parity: the one reference / trend painter must emit exactly the
// `<line>` each host drew before (same attributes, same values, same order).
describe("ReferenceRule / TrendRule (RM-188)", () => {
  it("paints ReferenceLine's former rule byte-for-byte", () => {
    const el = svg(<ReferenceRule strokeWidth={1.5} x1={0} x2={120} y1={40} y2={40} />);
    expect(el.innerHTML).toBe(
      '<line stroke="var(--chart-foreground)" stroke-dasharray="4 3" stroke-width="1.5" x1="0" x2="120" y1="40" y2="40"></line>',
    );
  });

  it("keeps a solid rule solid when the dash is explicitly undefined (annotation `solid`)", () => {
    const el = svg(
      <ReferenceRule
        stroke="var(--chart-grid)"
        strokeDasharray={LINE_STYLE_DASH.solid}
        strokeWidth={0.65}
        x1={10}
        x2={10}
        y1={0}
        y2={80}
      />,
    );
    expect(el.innerHTML).toBe(
      '<line stroke="var(--chart-grid)" stroke-width="0.65" x1="10" x2="10" y1="0" y2="80"></line>',
    );
  });

  it("paints TrendLine's former fit byte-for-byte", () => {
    const el = svg(<TrendRule strokeWidth={1.5} x1={0} x2={90} y1={70} y2={12} />);
    expect(el.innerHTML).toBe(
      '<line stroke="var(--chart-foreground-muted)" stroke-dasharray="5 4" stroke-width="1.5" x1="0" x2="90" y1="70" y2="12"></line>',
    );
  });

  it("keeps every rhythm the painters wrote as literals, verbatim", () => {
    expect(CHART_DASH).toEqual({
      dashed: "4 3",
      dotted: "1 3",
      trend: "5 4",
      model: "6 4",
      guide: "2 3",
      leader: "1.5 2.5",
      dashDot: "10 3 2 3",
      sparse: "1 4",
      dotDash: "6 2 1 2",
    });
    expect(LINE_STYLE_DASH).toEqual({ solid: undefined, dashed: "4 3", dotted: "1 3" });
    expect(EXCLUDED_DASH_ARRAY).toBe("4 3");
    expect(ANALYTIC_DASH).toBe("6 4");
    expect(ANALYTIC_DASHES).toEqual(["6 4", "2 3", "10 3 2 3", "1 4"]);
    expect(ANALYTIC_SOLID_RHYTHMS).toEqual([undefined, "1 3", "6 2 1 2"]);
  });
});
