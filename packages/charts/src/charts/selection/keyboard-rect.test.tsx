import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  KEYBOARD_RECT_IDLE,
  KeyboardRectCrosshair,
  keyboardRectReducer,
  KeyboardRectTarget,
  useKeyboardRect,
  type UseKeyboardRectOptions,
} from "./keyboard-rect";

afterEach(cleanup);

describe("keyboardRectReducer", () => {
  const bounds = { width: 100, height: 50 };
  it("S → crosshair at the centre; arrows move it inside the plot", () => {
    const on = keyboardRectReducer(KEYBOARD_RECT_IDLE, { type: "enter", center: { x: 50, y: 25 } });
    expect(on).toEqual({ active: true, cursor: { x: 50, y: 25 }, anchor: null });
    const moved = keyboardRectReducer(on, { type: "move", dx: 500, dy: -10, bounds });
    expect(moved.cursor).toEqual({ x: 100, y: 15 });
    expect(keyboardRectReducer(KEYBOARD_RECT_IDLE, { type: "move", dx: 1, dy: 1, bounds })).toBe(
      KEYBOARD_RECT_IDLE,
    );
  });
  it("Space anchors once; release clears the anchor; Esc drops the rect, then the mode", () => {
    const on = keyboardRectReducer(KEYBOARD_RECT_IDLE, { type: "enter", center: { x: 5, y: 5 } });
    const anchored = keyboardRectReducer(on, { type: "anchor" });
    expect(anchored.anchor).toEqual({ x: 5, y: 5 });
    expect(keyboardRectReducer(anchored, { type: "anchor" })).toBe(anchored);
    expect(keyboardRectReducer(anchored, { type: "release" }).anchor).toBeNull();
    const esc1 = keyboardRectReducer(anchored, { type: "escape" });
    expect(esc1).toMatchObject({ active: true, anchor: null });
    expect(keyboardRectReducer(esc1, { type: "escape" })).toBe(KEYBOARD_RECT_IDLE);
    expect(keyboardRectReducer(anchored, { type: "exit" })).toBe(KEYBOARD_RECT_IDLE);
  });
});

function Harness(props: Pick<UseKeyboardRectOptions, "onCommit" | "announce">) {
  const controller = useKeyboardRect({ width: 200, height: 100, step: { x: 10, y: 5 }, ...props });
  return (
    <div>
      <svg aria-hidden="true">
        <KeyboardRectCrosshair height={100} state={controller.state} width={200} />
      </svg>
      <KeyboardRectTarget
        box={{ left: 0, top: 0, width: 200, height: 100 }}
        controller={controller}
      />
    </div>
  );
}

describe("useKeyboardRect + KeyboardRectTarget", () => {
  it("S, arrows, Space held grows, release commits with the modifiers at release", () => {
    const onCommit = vi.fn(() => 12);
    const announce = vi.fn();
    const { container } = render(<Harness announce={announce} onCommit={onCommit} />);
    const target = screen.getByRole("button", { name: "Select an area with the keyboard" });
    fireEvent.keyDown(target, { key: "s" });
    expect(announce).toHaveBeenLastCalledWith(
      "Rectangle selection. Hold Space and use the arrow keys to draw.",
    );
    const crosshair = () =>
      container.querySelector('[data-slot="chart-selection-keyboard-crosshair"]');
    expect(crosshair()).toHaveAttribute("data-x", "100");
    fireEvent.keyDown(target, { key: "ArrowLeft", shiftKey: true });
    expect(crosshair()).toHaveAttribute("data-x", "0");
    fireEvent.keyDown(target, { key: " ", code: "Space" });
    fireEvent.keyDown(target, { key: " ", code: "Space", repeat: true });
    fireEvent.keyDown(target, { key: "ArrowRight" });
    fireEvent.keyDown(target, { key: "ArrowDown" });
    expect(
      container.querySelector('[data-slot="chart-selection-keyboard-rect-shape"]'),
    ).not.toBeNull();
    expect(onCommit).not.toHaveBeenCalled();
    fireEvent.keyUp(target, { key: " ", code: "Space", shiftKey: true });
    expect(onCommit).toHaveBeenCalledWith(
      { x: 0, y: 50 },
      { x: 10, y: 55 },
      { shift: true, ctrlOrMeta: false },
    );
    expect(announce).toHaveBeenLastCalledWith("12 points selected");
    expect(container.querySelector('[data-slot="chart-selection-keyboard-rect-shape"]')).toBeNull();
  });

  it("a Space release without an anchor commits nothing; zero hits announce so; blur exits", () => {
    const onCommit = vi.fn(() => 0);
    const announce = vi.fn();
    const { container } = render(<Harness announce={announce} onCommit={onCommit} />);
    const target = screen.getByRole("button");
    fireEvent.keyUp(target, { key: " ", code: "Space" });
    expect(onCommit).not.toHaveBeenCalled();
    fireEvent.keyDown(target, { key: "S" });
    fireEvent.keyDown(target, { key: " ", code: "Space" });
    fireEvent.keyUp(target, { key: " ", code: "Space", ctrlKey: true });
    expect(onCommit).toHaveBeenCalledWith(
      { x: 100, y: 50 },
      { x: 100, y: 50 },
      { shift: false, ctrlOrMeta: true },
    );
    expect(announce).toHaveBeenLastCalledWith("No points selected");
    fireEvent.blur(target);
    expect(container.querySelector('[data-slot="chart-selection-keyboard-crosshair"]')).toBeNull();
  });
});
