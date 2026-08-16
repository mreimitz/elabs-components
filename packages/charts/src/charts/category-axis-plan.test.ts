import { describe, expect, it } from "vitest";
import {
  CATEGORY_AXIS_ELLIPSIS,
  type CategoryAxisEntry,
  type CategoryAxisPlanInput,
  planCategoryAxis,
  unpaintedCategoryLabels,
} from "./category-axis-plan";

/**
 * Injected measurement — 7px per character. Every assertion below is exact
 * because of it: no canvas, no jsdom, no font. This is the whole reason the
 * planner takes `measure` as an argument.
 */
const measure = (text: string) => text.length * 7;

const LINE_HEIGHT = 16;

function categories(labels: string[]): CategoryAxisEntry[] {
  return labels.map((label, index) => ({ label, index }));
}

function seq(count: number, prefix = "C"): CategoryAxisEntry[] {
  return categories(Array.from({ length: count }, (_, i) => `${prefix}${i}`));
}

function plan(input: Partial<CategoryAxisPlanInput> & { categories: CategoryAxisEntry[] }) {
  return planCategoryAxis({
    placement: "bottom",
    slotSize: 100,
    containerWidth: 640,
    maxExtent: 72,
    lineHeightPx: LINE_HEIGHT,
    measure,
    ...input,
  });
}

describe("planCategoryAxis", () => {
  describe('fit: "off" — the pinned pre-fit behaviour', () => {
    it("keeps full labels, count-capped stride, and reserves nothing", () => {
      const result = plan({ categories: seq(20), fit: "off", maxLabels: 12, slotSize: 4 });

      expect(result.mode).toBe("horizontal");
      expect(result.stride).toBe(2);
      expect(result.labels).toHaveLength(10);
      expect(result.labels.every((label) => label.display === label.label)).toBe(true);
      expect(result.labels.every((label) => !label.truncated)).toBe(true);
      // The margin must not grow — that is what makes "off" a true escape hatch.
      expect(result.requiredExtentPx).toBe(0);
      expect(result.angleDeg).toBe(0);
    });

    it("ignores the container floor that would otherwise hide the axis", () => {
      const result = plan({ categories: seq(4), fit: "off", containerWidth: 80 });

      expect(result.mode).toBe("horizontal");
      expect(result.labels).toHaveLength(4);
    });
  });

  it("returns an empty horizontal plan for no categories", () => {
    const result = plan({ categories: [] });

    expect(result.mode).toBe("horizontal");
    expect(result.labels).toEqual([]);
    expect(result.requiredExtentPx).toBe(0);
  });

  it("renders horizontally when every label fits its own slot", () => {
    const result = plan({ categories: categories(["A", "B", "C"]), slotSize: 100 });

    expect(result.mode).toBe("horizontal");
    expect(result.stride).toBe(1);
    expect(result.angleDeg).toBe(0);
    expect(result.labels.map((label) => label.display)).toEqual(["A", "B", "C"]);
    // one line of text + the plot gap
    expect(result.requiredExtentPx).toBe(24);
  });

  it("tilts and ellipsizes when the labels are wider than their slot", () => {
    const result = plan({
      categories: categories(["Q1 Western Region", "Q2 Western Region", "Q3 Western Region"]),
      slotSize: 40,
    });

    expect(result.mode).toBe("tilted");
    expect(result.angleDeg).toBe(45);
    expect(result.stride).toBe(1);
    expect(result.labels[0]?.display).toBe(`Q1 Wester${CATEGORY_AXIS_ELLIPSIS}`);
    expect(result.labels[0]?.truncated).toBe(true);
    // Full label survives for AT even though the painted string is clipped.
    expect(result.labels[0]?.label).toBe("Q1 Western Region");
    expect(result.requiredExtentPx).toBe(69);
    expect(result.requiredExtentPx).toBeLessThanOrEqual(72);
  });

  it("keeps the whole label when the tilt budget can pay for it", () => {
    const result = plan({ categories: categories(["Alpha", "Bravo", "Charlie"]), slotSize: 30 });

    expect(result.mode).toBe("tilted");
    expect(result.labels.every((label) => !label.truncated)).toBe(true);
    expect(result.labels.map((label) => label.display)).toEqual(["Alpha", "Bravo", "Charlie"]);
  });

  it("drops to a stride and RE-ENTERS horizontally when the wider slot allows it", () => {
    // 40 slots of 10px: too narrow for the text AND too narrow to tilt into.
    const result = plan({ categories: seq(40), slotSize: 10 });

    expect(result.stride).toBe(3);
    expect(result.mode).toBe("horizontal");
    expect(result.labels).toHaveLength(14);
    expect(result.labels.every((label) => !label.truncated)).toBe(true);
    expect(result.requiredExtentPx).toBe(24);
  });

  it("hides below the container legibility floor", () => {
    const result = plan({ categories: categories(["A", "B"]), containerWidth: 120 });

    expect(result.mode).toBe("hidden");
    expect(result.labels).toEqual([]);
    expect(result.requiredExtentPx).toBe(0);
  });

  it("hides when the reserved band cannot pay for any text", () => {
    const result = plan({ categories: categories(["Alpha", "Bravo"]), maxExtent: 8, slotSize: 12 });

    expect(result.mode).toBe("hidden");
  });

  it("hides rather than overprint when dropping is disallowed and nothing fits", () => {
    const result = plan({
      categories: categories(["Northwest Territories", "Southeast Territories"]),
      slotSize: 10,
      allowDrop: false,
    });

    expect(result.mode).toBe("hidden");
  });

  it("floors the stride with maxLabels", () => {
    const result = plan({ categories: seq(20), maxLabels: 5, slotSize: 100 });

    expect(result.stride).toBe(4);
    expect(result.labels).toHaveLength(5);
  });

  describe('placement: "left"', () => {
    const leftInput = {
      placement: "left" as const,
      slotSize: 30,
      maxExtent: 112,
    };

    it("never tilts — it ellipsizes to the gutter instead", () => {
      const result = plan({
        ...leftInput,
        categories: categories(["Northwest Territories", "Southeast Territories"]),
      });

      expect(result.mode).toBe("horizontal");
      expect(result.angleDeg).toBe(0);
      expect(result.labels[0]?.display).toBe(`Northwest Ter${CATEGORY_AXIS_ELLIPSIS}`);
      expect(result.labels[0]?.truncated).toBe(true);
      expect(result.requiredExtentPx).toBe(106);
      expect(result.requiredExtentPx).toBeLessThanOrEqual(112);
    });

    it("reserves only what the widest kept label needs", () => {
      const result = plan({ ...leftInput, categories: categories(["Q1", "Q2"]) });

      expect(result.mode).toBe("horizontal");
      expect(result.labels.every((label) => !label.truncated)).toBe(true);
      expect(result.requiredExtentPx).toBe(14 + 8);
    });

    it("drops when the bands are shorter than one line of text", () => {
      const result = plan({ ...leftInput, categories: seq(20), slotSize: 8 });

      expect(result.stride).toBe(2);
      expect(result.labels).toHaveLength(10);
    });
  });

  describe("invariants", () => {
    const cases: Array<Partial<CategoryAxisPlanInput> & { categories: CategoryAxisEntry[] }> = [
      { categories: seq(3), slotSize: 200 },
      { categories: seq(12), slotSize: 40 },
      { categories: seq(40), slotSize: 10 },
      { categories: seq(120), slotSize: 4 },
      { categories: categories(["Northwest Territories"]), slotSize: 18 },
      { categories: seq(8), slotSize: 25, placement: "left", maxExtent: 112 },
      { categories: seq(8), slotSize: 25, maxExtent: 30 },
      { categories: seq(8), slotSize: 25, containerWidth: 159 },
    ];

    it.each(cases)("never reserves more than maxExtent (%#)", (input) => {
      const result = plan(input);
      const maxExtent = input.maxExtent ?? 72;

      expect(result.requiredExtentPx).toBeLessThanOrEqual(maxExtent);
      expect(result.requiredExtentPx).toBeGreaterThanOrEqual(0);
    });

    it.each(cases)("keeps every painted label a prefix of its full label (%#)", (input) => {
      for (const label of plan(input).labels) {
        if (label.truncated) {
          expect(label.display.endsWith(CATEGORY_AXIS_ELLIPSIS)).toBe(true);
          expect(label.label.startsWith(label.display.slice(0, -1))).toBe(true);
        } else {
          expect(label.display).toBe(label.label);
        }
      }
    });

    it.each(cases)("is deterministic (%#)", (input) => {
      expect(plan(input)).toEqual(plan(input));
    });
  });

  // A clip that leaves two DIFFERENT categories reading the same is not a
  // shortened label, it is a false one — the axis would assert that two bars
  // share a name. Reported by the visual sweep on `charts-barchart--narrow-container`,
  // where six regions all painted as "Q1…"/"Q2…".
  describe("ambiguous truncation", () => {
    const colliding = categories(["Alpha Region", "Alpha Sector", "Beta Zone"]);

    it("thins the run until the painted labels are distinguishable", () => {
      const result = planCategoryAxis({
        categories: colliding,
        placement: "left",
        slotSize: 20,
        containerWidth: 400,
        // 5 characters of budget — "Alpha Region" and "Alpha Sector" both clip
        // to "Alph…" at this width.
        maxExtent: 8 + 7 * 5,
        lineHeightPx: LINE_HEIGHT,
        measure,
      });

      const painted = result.labels.map((label) => label.display);
      expect(new Set(painted).size).toBe(painted.length);
      expect(result.stride).toBeGreaterThan(1);
      expect(result.labels.length).toBeLessThan(colliding.length);
    });

    it("keeps the ambiguous run when the caller asked for every label", () => {
      const result = planCategoryAxis({
        categories: colliding,
        placement: "left",
        slotSize: 20,
        containerWidth: 400,
        maxExtent: 8 + 7 * 5,
        lineHeightPx: LINE_HEIGHT,
        measure,
        allowDrop: false,
      });

      // `showAllLabels` means "do not drop", and that still wins — the reader
      // gets every name, ambiguous prefixes and all.
      expect(result.stride).toBe(1);
      expect(result.labels).toHaveLength(colliding.length);
    });

    it("leaves a run alone when the collision is in the DATA, not the clip", () => {
      // Two categories genuinely named "North" are not ambiguous — thinning
      // them would drop a real bar's label to fix nothing.
      const dupes = categories(["North", "North", "South"]);
      const result = planCategoryAxis({
        categories: dupes,
        placement: "left",
        slotSize: 20,
        containerWidth: 400,
        maxExtent: 8 + 7 * 8,
        lineHeightPx: LINE_HEIGHT,
        measure,
      });

      expect(result.stride).toBe(1);
      expect(result.labels.map((label) => label.display)).toEqual(["North", "North", "South"]);
    });
  });

  describe("ellipsis", () => {
    it("never leaves a space stranded before the ellipsis", () => {
      const result = planCategoryAxis({
        categories: categories(["Q1 Central Region"]),
        placement: "left",
        slotSize: 20,
        containerWidth: 400,
        // Budget lands mid-word, right after "Q1 ".
        maxExtent: 8 + 7 * 4,
        lineHeightPx: LINE_HEIGHT,
        measure,
      });

      const [label] = result.labels;
      expect(label?.truncated).toBe(true);
      expect(label?.display).not.toMatch(/\s…$/);
    });
  });

  describe("unpaintedCategoryLabels", () => {
    const six = categories(["Jan", "Feb", "Mar", "Apr", "May", "Jun"]);

    it("is empty when the axis paints everything", () => {
      expect(unpaintedCategoryLabels(six, six)).toEqual([]);
    });

    it("returns every category when the axis paints nothing (mode: hidden)", () => {
      expect(unpaintedCategoryLabels(six, [])).toEqual(["Jan", "Feb", "Mar", "Apr", "May", "Jun"]);
    });

    it("returns what a stride skipped, in source order", () => {
      const strided = six.filter((entry) => entry.index % 2 === 0);
      expect(unpaintedCategoryLabels(six, strided)).toEqual(["Feb", "Apr", "Jun"]);
    });

    it("keys off the index, not the label — duplicate names stay distinguishable", () => {
      const dupes = categories(["North", "North", "South"]);
      expect(unpaintedCategoryLabels(dupes, [dupes[0]!])).toEqual(["North", "South"]);
    });
  });
});
