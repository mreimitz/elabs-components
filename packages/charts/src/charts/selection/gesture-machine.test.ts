import { describe, expect, it } from "vitest";
import {
  CLICK_SENSITIVITY,
  createGestureState,
  type GestureEvent,
  type GestureState,
  gestureReducer,
  isGestureActive,
  NO_MODIFIERS,
  resolveMode,
} from "./gesture-machine";

const P0 = { x: 10, y: 10 };
const near = { x: 12, y: 12 }; // travel ≈ 2.8 px < 4
const far = { x: 60, y: 40 };

const down = (overrides: Partial<Extract<GestureEvent, { type: "pointerDown" }>> = {}) =>
  ({
    type: "pointerDown",
    point: P0,
    modifiers: NO_MODIFIERS,
    region: "plot",
    ...overrides,
  }) as GestureEvent;

function run(state: GestureState, ...events: GestureEvent[]): GestureState {
  return events.reduce(gestureReducer, state);
}

describe("resolveMode — modifiers → selection mode (ADR 0040 §4)", () => {
  it.each([
    [{ shift: false, ctrlOrMeta: false }, "immediate", "replace"],
    [{ shift: true, ctrlOrMeta: false }, "immediate", "add"],
    [{ shift: false, ctrlOrMeta: true }, "immediate", "toggle"],
    [{ shift: true, ctrlOrMeta: true }, "immediate", "toggle"],
    [{ shift: false, ctrlOrMeta: false }, "explicit", "toggle"],
    [{ shift: true, ctrlOrMeta: false }, "explicit", "add"],
    [{ shift: false, ctrlOrMeta: true }, "explicit", "toggle"],
  ] as const)("%o in %s → %s", (modifiers, confirm, expected) => {
    expect(resolveMode(modifiers, confirm)).toBe(expected);
  });

  it("explicit confirm flips a plain click to toggle", () => {
    const s = run(createGestureState("rect", "explicit"), down(), { type: "pointerUp", point: P0 });
    expect(s.isClick).toBe(true);
    expect(s.selectionMode).toBe("toggle");
    expect(s.phase).toBe("provisional");
  });

  it("modifiers are resolved at pointerdown and never change mid-drag", () => {
    const s = run(
      createGestureState("rect"),
      down({ modifiers: { shift: true, ctrlOrMeta: false } }),
      { type: "pointerMove", point: far },
      { type: "pointerUp", point: far },
    );
    expect(s.selectionMode).toBe("add");
  });
});

describe("gestureReducer — transition table", () => {
  const idle = createGestureState("rect");

  // [from phase builder, event, expected phase]
  const table: Array<[string, () => GestureState, GestureEvent, GestureState["phase"]]> = [
    ["idle", () => idle, down(), "armed"],
    ["idle", () => idle, { type: "pointerMove", point: far }, "idle"],
    ["idle", () => idle, { type: "pointerUp", point: far }, "idle"],
    ["idle", () => idle, { type: "cancel" }, "idle"],
    ["idle", () => idle, { type: "commit" }, "idle"],
    ["armed", () => run(idle, down()), { type: "pointerMove", point: near }, "armed"],
    ["armed", () => run(idle, down()), { type: "pointerMove", point: far }, "dragging"],
    ["armed", () => run(idle, down()), { type: "pointerUp", point: near }, "committed"],
    // A release far away with no move sampled in between is still a drag.
    ["armed", () => run(idle, down()), { type: "pointerUp", point: far }, "committed"],
    ["armed", () => run(idle, down()), { type: "cancel" }, "idle"],
    ["armed", () => run(idle, down()), down({ point: far }), "armed"],
    [
      "dragging",
      () => run(idle, down(), { type: "pointerMove", point: far }),
      { type: "pointerMove", point: P0 },
      "dragging",
    ],
    [
      "dragging",
      () => run(idle, down(), { type: "pointerMove", point: far }),
      { type: "pointerUp", point: far },
      "committed",
    ],
    [
      "dragging",
      () => run(idle, down(), { type: "pointerMove", point: far }),
      { type: "cancel" },
      "idle",
    ],
    [
      "dragging",
      () => run(idle, down(), { type: "pointerMove", point: far }),
      { type: "commit" },
      "dragging",
    ],
    ["committed", () => run(idle, down(), { type: "pointerUp", point: P0 }), down(), "armed"],
    [
      "committed",
      () => run(idle, down(), { type: "pointerUp", point: P0 }),
      { type: "cancel" },
      "idle",
    ],
    [
      "committed",
      () => run(idle, down(), { type: "pointerUp", point: P0 }),
      { type: "pointerMove", point: far },
      "committed",
    ],
  ];

  it.each(table)("%s + %o → %s", (_from, build, event, expected) => {
    expect(gestureReducer(build(), event).phase).toBe(expected);
  });

  describe("explicit confirm", () => {
    const explicit = createGestureState("lasso", "explicit");
    it("a released drag is provisional, not committed", () => {
      const s = run(explicit, down(), { type: "pointerMove", point: far }, { type: "pointerUp" });
      expect(s.phase).toBe("provisional");
    });
    it("provisional + commit → committed", () => {
      const s = run(explicit, down(), { type: "pointerUp", point: P0 }, { type: "commit" });
      expect(s.phase).toBe("committed");
    });
    it("provisional + pointerDown → armed (the set keeps accumulating)", () => {
      const s = run(explicit, down(), { type: "pointerUp", point: P0 }, down());
      expect(s.phase).toBe("armed");
    });
    it("provisional + cancel (Esc) → idle", () => {
      const s = run(explicit, down(), { type: "pointerUp", point: P0 }, { type: "cancel" });
      expect(s.phase).toBe("idle");
    });
  });

  it(`a release within ${CLICK_SENSITIVITY}px is a click; beyond it a drag`, () => {
    const click = run(idle, down(), { type: "pointerUp", point: { x: 14, y: 10 } });
    expect(click.isClick).toBe(true);
    const drag = run(idle, down(), { type: "pointerMove", point: { x: 15, y: 10 } });
    expect(drag.phase).toBe("dragging");
  });

  it("pointer mode never drags; a long travel releases to idle (no click)", () => {
    const pointer = createGestureState("pointer");
    const moved = run(pointer, down(), { type: "pointerMove", point: far });
    expect(moved.phase).toBe("armed");
    expect(gestureReducer(moved, { type: "pointerUp", point: far }).phase).toBe("idle");
    const tapped = run(pointer, down(), { type: "pointerUp", point: near });
    expect(tapped.phase).toBe("committed");
    expect(tapped.isClick).toBe(true);
  });

  it("gutters force an axis range whatever the mode", () => {
    expect(run(idle, down({ region: "gutter-x" })).activeMode).toBe("range-x");
    expect(run(idle, down({ region: "gutter-y" })).activeMode).toBe("range-y");
    expect(run(idle, down({ region: "plot" })).activeMode).toBe("rect");
  });

  it("a pointerDown mode override (touch long-press) arms a lasso", () => {
    expect(run(idle, down({ mode: "lasso" })).activeMode).toBe("lasso");
  });

  it("the lasso path records every sample; a rect keeps origin + current only", () => {
    const moves: GestureEvent[] = [
      { type: "pointerMove", point: { x: 30, y: 10 } },
      { type: "pointerMove", point: { x: 30, y: 30 } },
      { type: "pointerMove", point: { x: 10, y: 30 } },
    ];
    const lasso = run(createGestureState("lasso"), down(), ...moves, {
      type: "pointerUp",
      point: { x: 11, y: 12 },
    });
    expect(lasso.path).toHaveLength(5);
    const rect = run(idle, down(), ...moves);
    expect(rect.path).toHaveLength(2);
    expect(rect.current).toEqual({ x: 10, y: 30 });
  });

  it("setMode resets to idle in the new mode; setConfirm likewise", () => {
    const dragging = run(idle, down(), { type: "pointerMove", point: far });
    const switched = gestureReducer(dragging, { type: "setMode", mode: "lasso" });
    expect(switched).toMatchObject({ phase: "idle", mode: "lasso", activeMode: "lasso" });
    const explicit = gestureReducer(idle, { type: "setConfirm", confirm: "explicit" });
    expect(explicit.confirm).toBe("explicit");
  });

  it("returns the same object for a no-op event", () => {
    expect(gestureReducer(idle, { type: "pointerMove", point: far })).toBe(idle);
    expect(gestureReducer(idle, { type: "setMode", mode: "rect" })).toBe(idle);
    expect(gestureReducer(idle, { type: "cancel" })).toBe(idle);
  });

  it("isGestureActive is true only while armed or dragging", () => {
    expect(isGestureActive(idle)).toBe(false);
    expect(isGestureActive(run(idle, down()))).toBe(true);
    expect(isGestureActive(run(idle, down(), { type: "pointerMove", point: far }))).toBe(true);
    expect(isGestureActive(run(idle, down(), { type: "pointerUp", point: P0 }))).toBe(false);
  });
});
