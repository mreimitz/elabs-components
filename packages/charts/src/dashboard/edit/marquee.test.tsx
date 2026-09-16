import { useRef } from "react";
import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { GridSpec, TileLayout } from "../core/spec";
import { DashboardMarquee, useDashboardMarquee } from "./marquee";

const GRID: GridSpec = { mode: "fit", columns: 24, rows: 12, gap: 8 };
const SIZE = { width: 480, height: 240 }; // 20px/cell, 20px/row at this grid+size
const LAYOUT: TileLayout[] = [
  { id: "a", x: 0, y: 0, w: 4, h: 4 }, // pixel rect ~ (0,0)-(80,80)
  { id: "b", x: 10, y: 0, w: 4, h: 4 }, // ~ (200,0)-(280,80)
];

function Harness({
  onSelect,
  enabled = true,
}: {
  onSelect: (ids: string[], additive: boolean) => void;
  enabled?: boolean;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const { rect } = useDashboardMarquee({
    sheetRef,
    grid: GRID,
    size: SIZE,
    layout: LAYOUT,
    onSelect,
    enabled,
  });
  return (
    <div
      ref={sheetRef}
      data-testid="sheet"
      style={{ position: "relative", width: 480, height: 240 }}
    >
      <div
        data-tile-id="a"
        data-testid="tile-a"
        style={{ position: "absolute", inset: 0, width: 80, height: 80 }}
      />
      {rect ? <DashboardMarquee rect={rect} data-testid="marquee" /> : null}
    </div>
  );
}

function pointer(
  type: string,
  target: EventTarget,
  x: number,
  y: number,
  extra: Partial<PointerEventInit> = {},
) {
  act(() => {
    target.dispatchEvent(
      new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
        button: 0,
        ...extra,
      }),
    );
  });
}

describe("useDashboardMarquee", () => {
  it("draws the rectangle while dragging and hides it after release", async () => {
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />);
    const sheet = screen.getByTestId("sheet");
    sheet.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      right: 480,
      bottom: 240,
      width: 480,
      height: 240,
      x: 0,
      y: 0,
      toJSON() {
        return {};
      },
    });

    pointer("pointerdown", sheet, 100, 0);
    expect(screen.queryByTestId("marquee")).not.toBeNull();
    pointer("pointermove", window, 300, 80);
    const marquee = screen.getByTestId("marquee");
    expect(marquee.style.width).toBe("200px");
    expect(marquee.style.height).toBe("80px");
    pointer("pointerup", window, 300, 80);
    expect(screen.queryByTestId("marquee")).toBeNull();
  });

  it("selects tiles whose cell rect intersects the drawn rectangle, carrying Shift as additive", () => {
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />);
    const sheet = screen.getByTestId("sheet");
    sheet.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      right: 480,
      bottom: 240,
      width: 480,
      height: 240,
      x: 0,
      y: 0,
      toJSON() {
        return {};
      },
    });

    // Drag a rectangle over tile "b" (~x 200-280) only, holding Shift.
    pointer("pointerdown", sheet, 190, 0, { shiftKey: true });
    pointer("pointermove", window, 290, 90, { shiftKey: true });
    pointer("pointerup", window, 290, 90, { shiftKey: true });
    expect(onSelect).toHaveBeenCalledWith(["b"], true);
  });

  it("never starts a drag from a pointerdown on a tile", () => {
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />);
    const tile = screen.getByTestId("tile-a");
    pointer("pointerdown", tile, 10, 10);
    expect(screen.queryByTestId("marquee")).toBeNull();
  });

  it("Escape cancels mid-drag without calling onSelect", () => {
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} />);
    const sheet = screen.getByTestId("sheet");
    sheet.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      right: 480,
      bottom: 240,
      width: 480,
      height: 240,
      x: 0,
      y: 0,
      toJSON() {
        return {};
      },
    });

    pointer("pointerdown", sheet, 0, 0);
    pointer("pointermove", window, 300, 100);
    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    expect(screen.queryByTestId("marquee")).toBeNull();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("is inert when disabled", () => {
    const onSelect = vi.fn();
    render(<Harness onSelect={onSelect} enabled={false} />);
    const sheet = screen.getByTestId("sheet");
    pointer("pointerdown", sheet, 0, 0);
    expect(screen.queryByTestId("marquee")).toBeNull();
  });
});
