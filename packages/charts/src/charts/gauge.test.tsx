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

  it("renders one dot + one halo-text number per milestone", () => {
    const { container } = render(
      <Gauge centerValue={62} height={200} milestones={[25, 50, 75, 100]} value={62} width={300} />,
    );
    expect(container.querySelectorAll("circle")).toHaveLength(4);
    const labels = container.querySelectorAll('[data-slot="halo-text"]');
    expect(labels).toHaveLength(4);
    expect(Array.from(labels).map((el) => el.textContent)).toEqual(["25", "50", "75", "100"]);
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
});
