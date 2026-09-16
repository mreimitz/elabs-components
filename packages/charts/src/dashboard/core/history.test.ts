import { describe, expect, it } from "vitest";

import { createHistory } from "./history";

describe("createHistory", () => {
  it("undoes and redoes pushes in order", () => {
    const h = createHistory({ n: 0 });
    h.push({ n: 1 });
    h.push({ n: 2 });
    expect(h.undo()).toEqual({ n: 1 });
    expect(h.undo()).toEqual({ n: 0 });
    expect(h.undo()).toBeUndefined();
    expect(h.redo()).toEqual({ n: 1 });
    expect(h.canRedo()).toBe(true);
    h.push({ n: 9 });
    expect(h.canRedo()).toBe(false);
    expect(h.present).toEqual({ n: 9 });
  });

  it("keeps at most `limit` undo steps", () => {
    const h = createHistory(0, 3);
    for (let i = 1; i <= 10; i++) h.push(i);
    expect(h.size()).toEqual({ past: 3, future: 0 });
    h.undo();
    h.undo();
    h.undo();
    expect(h.present).toBe(7);
    expect(h.canUndo()).toBe(false);
  });

  it("folds a batch into one step, nested or not", () => {
    const h = createHistory(0);
    h.batch(() => {
      h.push(1);
      h.batch(() => h.push(2));
      h.push(3);
    });
    expect(h.size().past).toBe(1);
    expect(h.undo()).toBe(0);
  });

  it("an empty batch adds no step; a cancelled begin/end restores the base", () => {
    const h = createHistory("a");
    h.batch(() => undefined);
    expect(h.canUndo()).toBe(false);
    h.begin();
    h.push("b");
    expect(h.present).toBe("b");
    expect(h.canUndo()).toBe(false);
    expect(h.cancel()).toBe("a");
    expect(h.inBatch()).toBe(false);
    expect(h.canUndo()).toBe(false);
  });

  it("tracks dirtiness against the mark, including undo back to it", () => {
    const h = createHistory({ v: 1 });
    expect(h.isDirtySince()).toBe(false);
    h.push({ v: 2 });
    expect(h.isDirtySince()).toBe(true);
    h.undo();
    expect(h.isDirtySince()).toBe(false);
    h.redo();
    h.mark();
    expect(h.isDirtySince()).toBe(false);
  });

  it("freezes values outside production", () => {
    const h = createHistory({ nested: { v: 1 } });
    expect(() => {
      (h.present.nested as { v: number }).v = 2;
    }).toThrow();
  });
});
