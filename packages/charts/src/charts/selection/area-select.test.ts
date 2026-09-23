import { describe, expect, it } from "vitest";
import { hasAreaGesture, resolveAreaDragMode } from "./area-select";
import { hitsInPolygon, hitsInRect, type ChartMarkGeometry } from "./hit-test";

describe("resolveAreaDragMode (RM-144 arming table)", () => {
  const plain = { shift: false, alt: false };
  const shift = { shift: true, alt: false };
  const shiftAlt = { shift: true, alt: true };
  it("pointer mode: plain drag stays a pointer; Shift draws a rect when listed", () => {
    expect(resolveAreaDragMode("pointer", plain, ["range", "rect"])).toBeUndefined();
    expect(resolveAreaDragMode("pointer", shift, ["range", "rect"])).toBe("rect");
    expect(resolveAreaDragMode("pointer", shift, ["range"])).toBeUndefined();
  });
  it("Shift+Alt draws a lasso from any mode when listed", () => {
    expect(resolveAreaDragMode("rect", shiftAlt, ["rect", "lasso"])).toBe("lasso");
    expect(resolveAreaDragMode("pointer", shiftAlt, ["range", "lasso"])).toBe("lasso");
    expect(resolveAreaDragMode("rect", shiftAlt, ["rect"])).toBeUndefined();
  });
  it("a drawing mode keeps its own shape under Shift (Shift = add)", () => {
    expect(resolveAreaDragMode("rect", shift, ["rect"])).toBeUndefined();
    expect(resolveAreaDragMode("lasso", shift, ["lasso"])).toBeUndefined();
    expect(resolveAreaDragMode("radial", shift, ["radial", "rect"])).toBeUndefined();
  });
  it("hasAreaGesture", () => {
    expect(hasAreaGesture(["range"])).toBe(false);
    expect(hasAreaGesture(["range", "radial"])).toBe(true);
  });
});

describe("area hit rules (RM-144)", () => {
  const tall: ChartMarkGeometry = {
    id: "tall",
    category: "Tall",
    datum: {},
    index: 0,
    shape: { kind: "rect", x: 10, y: 0, w: 20, h: 200 },
    visible: true,
  };
  const short: ChartMarkGeometry = {
    ...tall,
    id: "short",
    category: "Short",
    index: 1,
    shape: { kind: "rect", x: 40, y: 150, w: 20, h: 50 },
  };
  const hidden: ChartMarkGeometry = { ...tall, id: "hidden", index: 2, visible: false };

  it("overlap: a thin lasso band CROSSING a tall bar hits it (no corner, no centre inside)", () => {
    const band = [
      { x: 0, y: 60 },
      { x: 100, y: 60 },
      { x: 100, y: 80 },
      { x: 0, y: 80 },
    ];
    expect(hitsInPolygon([tall, short, hidden], band).map((m) => m.id)).toEqual(["tall"]);
    expect(hitsInPolygon([tall, short], band, { rule: "contain" })).toEqual([]);
  });

  it("contain tolerates a rect clamped to the plot edge (float round trip)", () => {
    const y = 57.3;
    const rect = { x: 0, y, w: 100, h: 200 - y };
    expect(rect.y + rect.h).not.toBe(200 + 1e-3);
    expect(hitsInRect([tall, short], rect, { rule: "contain" }).map((m) => m.id)).toEqual([
      "short",
    ]);
    expect(hitsInRect([tall, short], rect).map((m) => m.id)).toEqual(["tall", "short"]);
  });

  it("visible marks only", () => {
    const all = { x: 0, y: 0, w: 100, h: 200 };
    expect(hitsInRect([tall, hidden], all).map((m) => m.id)).toEqual(["tall"]);
  });
});
