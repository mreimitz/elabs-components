/**
 * The box's DOM contract. Placement maths lives in `placement/place-tooltip.ts`
 * (golden cases + an invariant sweep in its own test); here: that the box
 * feeds it real rects, lands where it says, and keeps the old in-container
 * behaviour where there is no layout (jsdom, SSR) or a caller still passes
 * the deprecated `left`/`top`.
 */

import { act, render } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rectsOverlap } from "./placement/rect";
import { ChartTooltipBox, type ChartTooltipBoxProps } from "./tooltip-box";

type HarnessProps = Omit<ChartTooltipBoxProps, "containerRef" | "children"> & {
  dir?: "ltr" | "rtl";
};

function Harness({ dir, ...props }: HarnessProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  return (
    <div data-testid="container" dir={dir} ref={containerRef} style={{ direction: dir }}>
      <span data-testid="plot-child">plot</span>
      <ChartTooltipBox {...props} containerRef={containerRef}>
        <div>Tooltip</div>
      </ChartTooltipBox>
    </div>
  );
}

/** Mounts, then re-renders once: the box needs its container ref from the first commit. */
function renderBox(props: HarnessProps) {
  const view = render(<Harness {...props} />);
  view.rerender(<Harness {...props} />);
  const box = () => view.container.querySelector<HTMLElement>('[data-slot="chart-tooltip-box"]');
  return {
    ...view,
    box,
    rerenderBox: (next: HarnessProps) => view.rerender(<Harness {...next} />),
  };
}

describe("ChartTooltipBox — no layout (jsdom, SSR, first frame)", () => {
  it("renders inside its container, positioned beside the anchor", () => {
    const { box, getByTestId } = renderBox({
      x: 50,
      y: 100,
      visible: true,
      containerWidth: 800,
      containerHeight: 300,
    });
    const element = box();
    expect(element).not.toBeNull();
    expect(getByTestId("container").contains(element)).toBe(true);
    expect(element?.getAttribute("data-chart-export")).toBe("exclude");
    expect(element?.style.position).toBe("absolute");
    expect(element?.style.left).toBe("66px");
  });

  it("keeps a wide box inside a narrow container (#605)", () => {
    const { box } = renderBox({
      x: 60,
      y: 100,
      visible: true,
      containerWidth: 250,
      containerHeight: 300,
    });
    const left = Number.parseFloat(box()?.style.left ?? "");
    expect(left).toBeGreaterThanOrEqual(16);
    // The measured-size fallback is 180×80 in jsdom.
    expect(left + 180).toBeLessThanOrEqual(250 - 16);
  });

  it("renders nothing while hidden", () => {
    const { box } = renderBox({
      x: 50,
      y: 100,
      visible: false,
      containerWidth: 800,
      containerHeight: 300,
    });
    expect(box()).toBeNull();
  });

  it("follows the deprecated left/top bypass exactly", () => {
    const { box } = renderBox({
      x: 50,
      y: 100,
      visible: true,
      containerWidth: 800,
      containerHeight: 300,
      left: 12,
      top: 34,
    });
    const element = box();
    expect(element?.hasAttribute("popover")).toBe(false);
    expect(element?.style.left).toBe("12px");
    expect(element?.style.top).toBe("34px");
  });
});

describe("ChartTooltipBox — with layout", () => {
  const plot = { left: 100, top: 100, width: 140, height: 56 };
  const boxSize = { width: 146, height: 64 };
  const restore: Array<() => void> = [];

  beforeEach(() => {
    const prototype = HTMLElement.prototype;
    const isBox = (element: Element) => element.getAttribute("data-slot") === "chart-tooltip-box";
    const isContainer = (element: Element) => element.getAttribute("data-testid") === "container";

    const rect = vi.spyOn(prototype, "getBoundingClientRect").mockImplementation(function (
      this: HTMLElement,
    ) {
      if (isContainer(this)) {
        return DOMRect.fromRect({ x: plot.left, y: plot.top, ...plot });
      }
      if (isBox(this)) {
        // No transformed ancestor: `position: fixed` resolves to the viewport.
        return DOMRect.fromRect({
          x: Number.parseFloat(this.style.left) || 0,
          y: Number.parseFloat(this.style.top) || 0,
          ...boxSize,
        });
      }
      return DOMRect.fromRect({ x: 0, y: 0, width: 0, height: 0 });
    });
    restore.push(() => rect.mockRestore());

    for (const [key, size] of [
      ["offsetWidth", boxSize.width],
      ["offsetHeight", boxSize.height],
    ] as const) {
      const original = Object.getOwnPropertyDescriptor(prototype, key);
      Object.defineProperty(prototype, key, {
        configurable: true,
        get(this: HTMLElement) {
          return isBox(this) ? size : 0;
        },
      });
      restore.push(() => {
        if (original) {
          Object.defineProperty(prototype, key, original);
        }
      });
    }

    if (typeof prototype.showPopover !== "function") {
      prototype.showPopover = vi.fn();
      restore.push(() => {
        // Removes the jsdom stub again.
        Reflect.deleteProperty(prototype, "showPopover");
      });
    }
  });

  afterEach(() => {
    for (const undo of restore.splice(0).reverse()) {
      undo();
    }
  });

  function boxRect(element: HTMLElement | null) {
    return {
      x: Number.parseFloat(element?.style.left ?? ""),
      y: Number.parseFloat(element?.style.top ?? ""),
      ...boxSize,
    };
  }

  function hover(target: Element, clientX: number, clientY: number) {
    act(() => {
      target.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, clientX, clientY }));
    });
  }

  it("steps outside a chart too small to hold it, clear of the pointer and the chart", () => {
    const props = { x: 50, y: 28, visible: true, containerWidth: 140, containerHeight: 56 };
    const { box, getByTestId, rerenderBox } = renderBox(props);
    hover(getByTestId("plot-child"), 150, 128);
    rerenderBox({ ...props, x: 51 });

    const element = box();
    expect(element?.getAttribute("popover")).toBe("manual");
    expect(element?.dataset.placementPass).toBe("escape");
    expect(element?.dataset.side).toBe("right");
    const placed = boxRect(element);
    expect(placed.x).toBe(plot.left + plot.width + 16);
    expect(rectsOverlap(placed, { x: plot.left, y: plot.top, ...plot })).toBe(false);
    expect(rectsOverlap(placed, { x: 150 - 12, y: 128 - 12, width: 28, height: 32 })).toBe(false);
  });

  it("stays beside the pointer inside a chart with room", () => {
    plot.width = 800;
    plot.height = 300;
    try {
      const props = { x: 50, y: 40, visible: true, containerWidth: 800, containerHeight: 300 };
      const { box, getByTestId, rerenderBox } = renderBox({ ...props, track: "x" });
      hover(getByTestId("plot-child"), 150, 200);
      rerenderBox({ ...props, x: 51, track: "x" });

      const element = box();
      expect(element?.dataset.placementPass).toBe("inside");
      expect(element?.dataset.side).toBe("right");
      expect(
        rectsOverlap(boxRect(element), { x: 150 - 12, y: 200 - 12, width: 28, height: 32 }),
      ).toBe(false);
    } finally {
      plot.width = 140;
      plot.height = 56;
    }
  });

  it("keeps clear of the marks it is asked to avoid", () => {
    plot.width = 800;
    plot.height = 300;
    try {
      // A dot right of the pointer, where the box would otherwise go.
      const dot = { x: 170, y: 90, width: 16, height: 16 };
      const props = {
        x: 150,
        y: 100,
        visible: true,
        containerWidth: 800,
        containerHeight: 300,
        avoid: dot,
      };
      const { box, getByTestId, rerenderBox } = renderBox(props);
      hover(getByTestId("plot-child"), 250, 200);
      rerenderBox({ ...props, x: 151 });

      const placed = boxRect(box());
      expect(rectsOverlap(placed, { ...dot, x: dot.x + plot.left, y: dot.y + plot.top })).toBe(
        false,
      );
    } finally {
      plot.width = 140;
      plot.height = 56;
    }
  });

  it("tries the inline end first in a right-to-left chart: its left", () => {
    plot.left = 400;
    try {
      const props = { x: 50, y: 28, visible: true, containerWidth: 140, containerHeight: 56 };
      const { box, getByTestId, rerenderBox } = renderBox({ ...props, dir: "rtl" });
      hover(getByTestId("plot-child"), 450, 128);
      rerenderBox({ ...props, x: 51, dir: "rtl" });
      expect(box()?.dataset.side).toBe("left");
      expect(boxRect(box()).x).toBe(400 - 16 - boxSize.width);
    } finally {
      plot.left = 100;
    }
  });

  it("hides on Escape until the hover moves on", () => {
    const props = { x: 50, y: 28, visible: true, containerWidth: 140, containerHeight: 56 };
    const { box, rerenderBox } = renderBox(props);
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(box()?.style.visibility).toBe("hidden");
    expect(box()?.dataset.placementPass).toBe("dismissed");

    rerenderBox(props);
    expect(box()?.style.visibility).toBe("hidden");

    rerenderBox({ ...props, x: 60 });
    expect(box()?.style.visibility).toBe("");
    expect(box()?.dataset.placementPass).toBe("escape");
  });
});
