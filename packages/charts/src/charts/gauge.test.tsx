/**
 * Gauge — jsdom smoke tests.
 *
 * `Gauge` renders synchronously (no ResizeObserver / measurement round-trip)
 * whenever explicit `width`/`height` props are supplied, so these tests pass
 * both dimensions and skip the `@visx/responsive` ParentSize path entirely.
 * A full visual pass lives in the co-located Storybook story
 * (gauge.stories.tsx), exercised by `pnpm --filter @elabs-ai/components-docs test-storybook`.
 */

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Gauge } from "./gauge";

describe("Gauge", () => {
  it("is exported as a function (forwardRef-free function component)", () => {
    expect(typeof Gauge).toBe("function");
    expect(Gauge.displayName).toBe("Gauge");
  });

  it("renders with no milestones/remainingLabel — unaffected default", () => {
    const { container } = render(<Gauge centerValue={50} height={200} value={50} width={300} />);
    expect(container.querySelectorAll("circle")).toHaveLength(0);
    expect(container.querySelector('[data-slot="halo-text"]')).toBeNull();
    // No caption row when remainingLabel is unset.
    expect(container.textContent).not.toMatch(/ticks to go/i);
  });

  it("renders one dot + one halo-text number + one leader per milestone (#248)", () => {
    const { container } = render(
      <Gauge centerValue={62} height={200} milestones={[25, 50, 75, 100]} value={62} width={300} />,
    );
    expect(container.querySelectorAll("circle")).toHaveLength(4);
    const labels = container.querySelectorAll('[data-slot="halo-text"]');
    expect(labels).toHaveLength(4);
    expect(Array.from(labels).map((el) => el.textContent)).toEqual(["25", "50", "75", "100"]);
    expect(container.querySelectorAll('[data-slot="gauge-milestone-leader"]')).toHaveLength(4);
  });

  it("joins each milestone's dot and number with a leader whose endpoint sits by the label (#248)", () => {
    const { container } = render(
      <Gauge centerValue={62} height={200} milestones={[25, 50, 75, 100]} value={62} width={300} />,
    );
    const dots = Array.from(container.querySelectorAll("circle"));
    const leaders = Array.from(container.querySelectorAll('[data-slot="gauge-milestone-leader"]'));
    const labels = Array.from(container.querySelectorAll('[data-slot="halo-text"]'));
    expect(dots).toHaveLength(4);
    expect(leaders).toHaveLength(4);
    expect(labels).toHaveLength(4);
    for (let i = 0; i < dots.length; i += 1) {
      const dotX = Number(dots[i]?.getAttribute("cx"));
      const dotY = Number(dots[i]?.getAttribute("cy"));
      const leaderX1 = Number(leaders[i]?.getAttribute("x1"));
      const leaderY1 = Number(leaders[i]?.getAttribute("y1"));
      const leaderX2 = Number(leaders[i]?.getAttribute("x2"));
      const leaderY2 = Number(leaders[i]?.getAttribute("y2"));
      const labelX = Number(labels[i]?.getAttribute("x"));
      const labelY = Number(labels[i]?.getAttribute("y"));
      // The leader starts exactly at its own dot…
      expect(Math.hypot(leaderX1 - dotX, leaderY1 - dotY)).toBeCloseTo(0, 5);
      // …and its far end sits within one label line-height (~12px) of the
      // label it belongs to — the association the 33px gap (#248) broke.
      expect(Math.hypot(leaderX2 - labelX, leaderY2 - labelY)).toBeLessThan(12);
    }
  });

  it("never places a milestone label on the notch band (#248)", () => {
    const { container } = render(
      <Gauge centerValue={62} height={200} milestones={[25, 50, 75, 100]} value={62} width={300} />,
    );
    const labels = Array.from(container.querySelectorAll('[data-slot="halo-text"]'));
    for (const label of labels) {
      const x = Number(label.getAttribute("x"));
      const y = Number(label.getAttribute("y"));
      // Center is (width/2, height/2) = (150, 100) for this fixture.
      const radius = Math.hypot(x - 150, y - 100);
      const outerRadius = 200 * 0.42 - 28; // size=min(300,200)=200; milestoneReserve=18+10
      expect(radius).toBeGreaterThan(outerRadius);
    }
  });

  it("computes `remaining` as totalNotches − activeNotches and passes it to remainingLabel", () => {
    // totalNotches=40, value=32 → activeNotches = round(0.32 * 40) = 13 → remaining = 27.
    const { getByText } = render(
      <Gauge
        centerValue={32}
        height={200}
        remainingLabel={(remaining) => `${remaining} ticks to go`}
        totalNotches={40}
        value={32}
        width={300}
      />,
    );
    expect(getByText("27 ticks to go")).toBeInTheDocument();
  });

  it("clamps remaining at 0 (never negative) when value exceeds 100", () => {
    const { getByText } = render(
      <Gauge
        centerValue={120}
        height={200}
        remainingLabel={(remaining) => `${remaining} ticks to go`}
        totalNotches={40}
        value={120}
        width={300}
      />,
    );
    expect(getByText("0 ticks to go")).toBeInTheDocument();
  });

  it("paints track notches in the track ink, never the card colour they sit on", () => {
    const { container } = render(
      <Gauge centerValue={32} height={200} totalNotches={10} value={32} width={300} />,
    );
    const fills = Array.from(container.querySelectorAll("path")).map((p) => p.getAttribute("fill"));
    // totalNotches=10, value=32 → 3 active notches drawn over 10 track notches.
    expect(fills.filter((f) => f === "var(--chart-ring-background)")).toHaveLength(10);
    expect(fills).not.toContain("var(--chart-background)");
  });

  it("renders both milestones and a caption together", () => {
    const { container, getByText } = render(
      <Gauge
        centerValue={70}
        height={200}
        milestones={[50, 100]}
        remainingLabel={(remaining) => `${remaining} to go`}
        totalNotches={10}
        value={70}
        width={300}
      />,
    );
    expect(container.querySelectorAll("circle")).toHaveLength(2);
    expect(getByText("3 to go")).toBeInTheDocument();
  });

  it("fits a long caption to the donut hole's own budget, not the whole box (#248)", () => {
    const { getByText } = render(
      <Gauge
        centerValue={32}
        height={200}
        remainingLabel={() => "27 ticks to go this sprint"}
        totalNotches={40}
        value={32}
        width={300}
      />,
    );
    const caption = getByText("27 ticks to go this sprint");
    // size = min(300, 200) = 200; innerRadiusBase = 200 * 0.28 = 56; no
    // milestones, so outerRadius/notchLength/innerRadius are unaffected —
    // the budget is derived from that same `innerRadius`, never the 300px box.
    expect(caption.style.maxWidth).not.toBe("");
    expect(Number.parseFloat(caption.style.maxWidth)).toBeLessThan(300);
    expect(Number.parseFloat(caption.style.maxWidth)).toBeGreaterThan(0);
  });

  it("renders no accessible-name DOM when accessibleLabel is unset — unaffected default (#290)", () => {
    const { container } = render(<Gauge centerValue={50} height={200} value={50} width={300} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.getAttribute("role")).toBeNull();
    expect(root.getAttribute("aria-label")).toBeNull();
    expect(root.hasAttribute("tabindex")).toBe(false);
  });

  it("exposes accessibleLabel/accessibleDescription as a named, focusable figure (#290)", () => {
    const { container, getByRole } = render(
      <Gauge
        accessibleDescription="62 percent of a 100 percent target."
        accessibleLabel="Score, 62 percent of target"
        centerValue={62}
        height={200}
        value={62}
        width={300}
      />,
    );
    const figure = getByRole("figure", { name: "Score, 62 percent of target" });
    expect(figure.getAttribute("tabindex")).toBe("0");
    const descId = figure.getAttribute("aria-describedby");
    expect(descId).toBeTruthy();
    expect(container.querySelector(`#${descId}`)?.textContent).toBe(
      "62 percent of a 100 percent target.",
    );
  });
});
