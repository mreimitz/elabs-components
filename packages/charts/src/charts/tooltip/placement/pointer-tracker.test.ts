import { afterEach, describe, expect, it, vi } from "vitest";
import {
  markKeyboardReplay,
  readPointer,
  retainPointerTracker,
  subscribePointer,
} from "./pointer-tracker";

function touchEvent(type: string, touches: Array<{ clientX: number; clientY: number }>): Event {
  const event = new Event(type, { bubbles: true });
  Object.defineProperty(event, "touches", { value: touches });
  return event;
}

describe("pointer tracker", () => {
  let release: (() => void) | null = null;
  afterEach(() => {
    release?.();
    release = null;
  });

  it("records nothing until retained, then records mouse moves", () => {
    document.dispatchEvent(new MouseEvent("mousemove", { clientX: 5, clientY: 6 }));
    expect(readPointer()).toBeNull();

    release = retainPointerTracker();
    document.body.dispatchEvent(
      new MouseEvent("mousemove", { bubbles: true, clientX: 40, clientY: 50 }),
    );
    expect(readPointer()).toMatchObject({ clientX: 40, clientY: 50, kind: "mouse" });
  });

  it("removes its listeners and forgets the pointer on the last release", () => {
    const first = retainPointerTracker();
    const second = retainPointerTracker();
    document.dispatchEvent(new MouseEvent("mousemove", { clientX: 1, clientY: 2 }));
    first();
    expect(readPointer()).not.toBeNull();
    second();
    expect(readPointer()).toBeNull();
    document.dispatchEvent(new MouseEvent("mousemove", { clientX: 3, clientY: 4 }));
    expect(readPointer()).toBeNull();
  });

  it("tells subscribers about every move", () => {
    release = retainPointerTracker();
    const listener = vi.fn();
    const unsubscribe = subscribePointer(listener);
    document.dispatchEvent(new MouseEvent("mousemove", { clientX: 1, clientY: 2 }));
    document.dispatchEvent(new MouseEvent("mousemove", { clientX: 3, clientY: 4 }));
    unsubscribe();
    document.dispatchEvent(new MouseEvent("mousemove", { clientX: 5, clientY: 6 }));
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("tracks a finger, knows when it lifts, and ignores the compatibility mouse move after a tap", () => {
    release = retainPointerTracker();
    document.dispatchEvent(touchEvent("touchstart", [{ clientX: 10, clientY: 20 }]));
    expect(readPointer()).toMatchObject({ clientX: 10, clientY: 20, kind: "touch", down: true });

    document.dispatchEvent(touchEvent("touchend", []));
    expect(readPointer()).toMatchObject({ kind: "touch", down: false });

    document.dispatchEvent(new MouseEvent("mousemove", { clientX: 10, clientY: 20 }));
    expect(readPointer()).toMatchObject({ kind: "touch" });
  });

  it("recognises the datapoint layer's keyboard replay", () => {
    release = retainPointerTracker();
    document.dispatchEvent(
      markKeyboardReplay(new MouseEvent("mousemove", { clientX: 70, clientY: 80 })),
    );
    expect(readPointer()).toMatchObject({ clientX: 70, clientY: 80, kind: "keyboard" });
  });
});
