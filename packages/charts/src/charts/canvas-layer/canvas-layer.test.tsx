/**
 * canvas-layer.test.tsx — RM-046 acceptance for the rendering + interaction
 * contract that a canvas cannot get for free.
 *
 * jsdom has NO 2D canvas context (`getContext("2d")` is `null` without the
 * optional native `canvas` package, which this repo deliberately does not
 * depend on), so the draw path is exercised through the same context stub the
 * package ships to consumers — `installCanvasContextStub` in
 * `src/test/primitives.tsx`. That keeps the assertion honest in both
 * directions: the test asserts on the real component, and the helper it leans
 * on is the one a consumer gets.
 */

import { useMemo, useRef } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { installCanvasContextStub } from "../../test/primitives";
import { CanvasLayer } from "./canvas-layer";
import { createSpatialGrid } from "./hit-test";
import type { ChartScales } from "./use-canvas-draw";

interface Dot {
  id: string;
  x: number;
  y: number;
}

const DOTS: Dot[] = [
  { id: "a", x: 20, y: 20 },
  { id: "b", x: 60, y: 40 },
  { id: "c", x: 120, y: 80 },
];

// @visx-free, but `react-use-measure` needs a ResizeObserver jsdom does not
// have. Same local stub the other chart tests in this package use.
beforeAll(() => {
  if (typeof window !== "undefined" && !window.ResizeObserver) {
    window.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
});

let canvasStub: ReturnType<typeof installCanvasContextStub>;

beforeEach(() => {
  canvasStub = installCanvasContextStub();
});

afterEach(() => {
  canvasStub.restore();
  document.documentElement.removeAttribute("data-theme");
  vi.restoreAllMocks();
});

/** A layer over `DOTS` with a grid-backed hit test — the documented wiring. */
function Fixture(props: Partial<React.ComponentProps<typeof CanvasLayer<Dot>>> = {}) {
  const drawn = useRef<{ scales: ChartScales; dpr: number }[]>([]);
  const grid = useMemo(() => {
    const g = createSpatialGrid<Dot>(8);
    for (const dot of DOTS) {
      g.insert(dot.x, dot.y, dot);
    }
    return g;
  }, []);

  return (
    <CanvasLayer<Dot>
      accessibleDescription="3 events on one case row."
      accessibleLabel="Event marks"
      draw={(ctx, scales, dpr) => {
        drawn.current.push({ scales, dpr });
        for (const dot of DOTS) {
          ctx.fillRect(dot.x, dot.y, 2, 2);
        }
      }}
      focusRect={(dot) => ({ x: dot.x - 4, y: dot.y - 4, width: 8, height: 8 })}
      height={200}
      hitTest={(x, y) => grid.query(x, y, 8)}
      labelFor={(dot) => `Event ${dot.id}`}
      points={DOTS}
      width={300}
      {...props}
    />
  );
}

const cursor = () => screen.getByRole("button", { name: "Event marks" });
const surface = () =>
  document.querySelector<HTMLCanvasElement>(
    '[data-slot="canvas-layer-surface"]',
  ) as HTMLCanvasElement;
/**
 * jsdom (25) implements no `PointerEvent` constructor, so RTL's
 * `fireEvent.pointerMove` builds a bare `Event` and the coordinates never
 * arrive. A `MouseEvent` typed `pointermove` carries `clientX`/`clientY` and
 * React dispatches it to `onPointerMove` by type name.
 */
function movePointer(el: Element, clientX: number, clientY: number) {
  fireEvent(el, new MouseEvent("pointermove", { bubbles: true, clientX, clientY }));
}

const ringRect = () =>
  document.querySelector<SVGRectElement>('[data-slot="canvas-layer-focus-ring"] rect');

describe("CanvasLayer", () => {
  it("paints through the caller's draw callback, in CSS pixels, dpr-scaled", () => {
    Object.defineProperty(window, "devicePixelRatio", { configurable: true, value: 2 });
    render(<Fixture />);

    // One fillRect per dot — the callback really ran against a context.
    expect(canvasStub.calls.filter((call) => call.method === "fillRect")).toHaveLength(3);
    // The context is transformed once, so the callback never multiplies by dpr.
    expect(canvasStub.calls.find((call) => call.method === "setTransform")?.args).toEqual([
      2, 0, 0, 2, 0, 0,
    ]);
    // Backing store in device pixels, element box in CSS pixels.
    expect(surface().width).toBe(600);
    expect(surface().height).toBe(400);
    expect(surface().style.width).toBe("300px");
  });

  it("exposes ONE tab stop for the marks, not one per point", () => {
    render(<Fixture />);
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("keeps the parallel accessible summary a canvas would otherwise delete", () => {
    render(<Fixture />);
    const region = screen.getByRole("group", { name: "Event marks" });
    expect(region).toHaveAccessibleDescription("3 events on one case row.");
    expect(surface()).toHaveAttribute("aria-hidden", "true");
  });

  it("tracks the focused datum across a Tab / Arrow / Home / End sequence", async () => {
    const onDatapointFocus = vi.fn();
    render(<Fixture onDatapointFocus={onDatapointFocus} />);

    act(() => cursor().focus());
    await waitFor(() => expect(onDatapointFocus).toHaveBeenLastCalledWith(DOTS[0]));
    // The single overlay rect sits on the focused datum's geometry.
    expect(ringRect()).toHaveAttribute("x", "16");
    expect(screen.getByRole("status")).toHaveTextContent("Event a");

    fireEvent.keyDown(cursor(), { key: "ArrowRight" });
    await waitFor(() => expect(onDatapointFocus).toHaveBeenLastCalledWith(DOTS[1]));
    expect(ringRect()).toHaveAttribute("x", "56");
    expect(screen.getByRole("status")).toHaveTextContent("Event b");

    fireEvent.keyDown(cursor(), { key: "End" });
    await waitFor(() => expect(onDatapointFocus).toHaveBeenLastCalledWith(DOTS[2]));
    expect(ringRect()).toHaveAttribute("x", "116");

    // Clamped at the ends — no wrap, no out-of-range index.
    fireEvent.keyDown(cursor(), { key: "ArrowRight" });
    expect(ringRect()).toHaveAttribute("x", "116");

    fireEvent.keyDown(cursor(), { key: "Home" });
    await waitFor(() => expect(ringRect()).toHaveAttribute("x", "16"));

    act(() => cursor().blur());
    await waitFor(() => expect(onDatapointFocus).toHaveBeenLastCalledWith(null));
    expect(ringRect()).toBeNull();
  });

  it("activates the focused datum on Enter, and a mark on click", () => {
    const onDatapointActivate = vi.fn();
    render(<Fixture onDatapointActivate={onDatapointActivate} />);

    act(() => cursor().focus());
    // A native button turns Enter/Space into a click.
    fireEvent.click(cursor());
    expect(onDatapointActivate).toHaveBeenLastCalledWith(DOTS[0]);

    fireEvent.click(surface(), { clientX: 60, clientY: 40 });
    expect(onDatapointActivate).toHaveBeenLastCalledWith(DOTS[1]);
  });

  it("reports hover through the caller's hit test, once per change", () => {
    const onDatapointHover = vi.fn();
    render(<Fixture onDatapointHover={onDatapointHover} />);

    movePointer(surface(), 22, 21);
    expect(onDatapointHover).toHaveBeenLastCalledWith(DOTS[0]);

    // Same datum → no second report.
    movePointer(surface(), 21, 22);
    expect(onDatapointHover).toHaveBeenCalledTimes(1);

    movePointer(surface(), 200, 190);
    expect(onDatapointHover).toHaveBeenLastCalledWith(null);

    fireEvent(surface(), new MouseEvent("pointerout", { bubbles: true }));
    expect(onDatapointHover).toHaveBeenCalledTimes(2);
  });

  it("redraws on a theme flip WITHOUT remounting the canvas", async () => {
    render(<Fixture />);
    const before = surface();
    const paintedBefore = canvasStub.calls.filter((call) => call.method === "fillRect").length;

    act(() => {
      document.documentElement.setAttribute("data-theme", "dark");
    });

    await waitFor(() => {
      expect(canvasStub.calls.filter((call) => call.method === "fillRect").length).toBeGreaterThan(
        paintedBefore,
      );
    });
    // Element identity is the point: a remount would drop the surface (and any
    // state a caller keeps beside it) on every theme toggle.
    expect(surface()).toBe(before);
  });

  it("adds no tab stop and no ring when there is nothing to walk", () => {
    render(<Fixture points={[]} />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(ringRect()).toBeNull();
  });

  it("still shows a focus ring when the caller supplies no per-datum geometry", () => {
    render(<Fixture focusRect={undefined} />);
    act(() => cursor().focus());
    // Frames the whole layer rather than leaving focus invisible (WCAG 2.4.7).
    expect(ringRect()).toHaveAttribute("width", "298");
  });
});
