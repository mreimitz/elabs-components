/**
 * PieSlice entrance under reduced motion (#549 item 8). `motion/react`'s
 * `useReducedMotion` is forced on; every other export stays real, so the
 * slices' own JS sweep (`useMountProgress`) really runs in jsdom.
 */
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("motion/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("motion/react")>()),
  useReducedMotion: () => true,
}));

vi.mock("@visx/responsive", () => ({
  ParentSize: ({
    children,
  }: {
    children: (size: { width: number; height: number }) => React.ReactNode;
  }) => children({ width: 300, height: 300 }),
}));

if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

import { PieChart } from "./pie-chart";
import { PieSlice } from "./pie-slice";

afterEach(cleanup);

const sixSlices = ["A", "B", "C", "D", "E", "F"].map((label, i) => ({ label, value: 10 + i }));

describe("PieSlice — reduced motion (#549)", () => {
  for (const hoverEffect of ["translate", "grow"] as const) {
    it(`every ${hoverEffect} slice is fully drawn within 150ms (the full stagger is ~1s)`, async () => {
      const { container } = render(
        <PieChart data={sixSlices} size={200}>
          {sixSlices.map((_, i) => (
            <PieSlice hoverEffect={hoverEffect} index={i} key={i} />
          ))}
        </PieChart>,
      );
      await act(() => new Promise((resolve) => setTimeout(resolve, 150)));
      const hitboxes = Array.from(container.querySelectorAll('path[fill="transparent"]'));
      const painted = Array.from(container.querySelectorAll("path")).filter(
        (p) =>
          p.getAttribute("fill") !== "transparent" && p.getAttribute("pointer-events") === "none",
      );
      expect(hitboxes).toHaveLength(sixSlices.length);
      // Each slice's painted arc has swept to its full resting shape — the
      // last slice (index 5) would still be waiting out a 0.5s stagger delay
      // with full motion.
      expect(painted).toHaveLength(sixSlices.length);
      painted.forEach((path, i) => {
        if (hoverEffect === "translate") {
          expect(path.getAttribute("d")).toBe(hitboxes[i]?.getAttribute("d"));
        } else {
          // `grow` hands its settled `d` to a motion spring jsdom cannot
          // interpolate, so assert only that the slice left its empty
          // pre-reveal state ("") — a still-staggered slice has not.
          expect(path.getAttribute("d")).not.toBe("");
        }
      });
    });
  }
});
