/**
 * tree-transition.test.ts — the expand/collapse motion is pure maths, so it
 * is tested here at fixed progress values; the component tests only check
 * that a flight starts, lands and can be interrupted.
 */
import { describe, expect, it } from "vitest";
import { computeTreeLayout } from "./tree-chart-layout";
import type { TreeNode } from "./tree-chart";
import {
  fadeInAt,
  fadeOutAt,
  flightScrollTarget,
  frameAt,
  frameFromLayout,
  linkAt,
  linkPath,
  nodeAt,
  planTreeTransition,
  REVEAL_PADDING,
  sizeAt,
  type TreeFrame,
} from "./tree-transition";

const org: TreeNode = {
  name: "Engineering",
  children: [
    { name: "Platform", children: [{ name: "CI" }, { name: "Infra" }, { name: "Release" }] },
    { name: "Product", children: [{ name: "Onboarding" }, { name: "Billing" }] },
  ],
};

// Ids by position: root "0", Platform "0.0", CI "0.0.0", Product "0.1".
const ALL = new Set(["0", "0.0", "0.1"]);
const PLATFORM_CLOSED = new Set(["0", "0.1"]);

function layoutOf(
  expandedIds: ReadonlySet<string>,
  orientation: "lr" | "tb" = "lr",
  nodeBox?: { width: number; height: number },
) {
  return computeTreeLayout(org, {
    orientation,
    palette: "mono",
    nodeRadius: 3.5,
    expandedIds,
    nodeBox,
  });
}

function nodeIn(frame: TreeFrame, id: string) {
  const n = frame.nodes.find((m) => m.id === id);
  if (!n) throw new Error(`no node ${id}`);
  return n;
}

describe("planTreeTransition", () => {
  it("returns null on first paint and when nothing moves", () => {
    const frame = frameFromLayout(layoutOf(ALL));
    expect(planTreeTransition(null, frame)).toBeNull();
    expect(planTreeTransition(frame, frameFromLayout(layoutOf(ALL)))).toBeNull();
  });

  it("t = 0 is the previous frame and t = 1 the next one", () => {
    const prev = frameFromLayout(layoutOf(ALL));
    const next = frameFromLayout(layoutOf(PLATFORM_CLOSED));
    const plan = planTreeTransition(prev, next)!;
    expect(plan).not.toBeNull();

    const start = frameAt(plan, 0);
    for (const n of prev.nodes) {
      const s = nodeIn(start, n.id);
      expect(s.x).toBeCloseTo(n.x);
      expect(s.y).toBeCloseTo(n.y);
      expect(s.opacity).toBeCloseTo(1);
    }
    expect(start.width).toBeCloseTo(prev.width);
    expect(start.height).toBeCloseTo(prev.height);

    const end = frameAt(plan, 1);
    expect(end.nodes.map((n) => n.id).sort()).toEqual(next.nodes.map((n) => n.id).sort());
    expect(end.height).toBeCloseTo(next.height);
  });

  it("an entering child starts at its parent's OLD position, invisible", () => {
    const prev = frameFromLayout(layoutOf(PLATFORM_CLOSED));
    const next = frameFromLayout(layoutOf(ALL));
    const plan = planTreeTransition(prev, next)!;
    const ci = plan.byId.get("0.0.0")!;
    expect(ci.kind).toBe("enter");
    const oldPlatform = nodeIn(prev, "0.0");
    expect(nodeAt(ci, 0)).toEqual({ x: oldPlatform.x, y: oldPlatform.y, opacity: 0 });
    const target = nodeIn(next, "0.0.0");
    expect(nodeAt(ci, 1)).toEqual({ x: target.x, y: target.y, opacity: 1 });
  });

  it("an exiting child ends at its parent's NEW position, faded out", () => {
    const prev = frameFromLayout(layoutOf(ALL));
    const next = frameFromLayout(layoutOf(PLATFORM_CLOSED));
    const plan = planTreeTransition(prev, next)!;
    const ci = plan.byId.get("0.0.0")!;
    expect(ci.kind).toBe("exit");
    const newPlatform = nodeIn(next, "0.0");
    expect(nodeAt(ci, 1)).toEqual({ x: newPlatform.x, y: newPlatform.y, opacity: 0 });
    // The frame at t = 1 has dropped it.
    expect(frameAt(plan, 1).nodes.some((n) => n.id === "0.0.0")).toBe(false);
  });

  it("works the same way top to bottom", () => {
    const prev = frameFromLayout(layoutOf(ALL, "tb"));
    const next = frameFromLayout(layoutOf(PLATFORM_CLOSED, "tb"));
    const plan = planTreeTransition(prev, next)!;
    const ci = plan.byId.get("0.0.0")!;
    const newPlatform = nodeIn(next, "0.0");
    expect(nodeAt(ci, 1)).toMatchObject({ x: newPlatform.x, y: newPlatform.y });
    expect(nodeIn(prev, "0.0.0").y).toBeGreaterThan(nodeIn(prev, "0.0").y);
  });

  it("links are rebuilt from their endpoints, not tweened as paths", () => {
    const prev = frameFromLayout(layoutOf(ALL));
    const next = frameFromLayout(layoutOf(PLATFORM_CLOSED));
    const plan = planTreeTransition(prev, next)!;
    const link = plan.links.find((l) => l.targetId === "0.0.0")!;
    expect(link.kind).toBe("exit");
    for (const t of [0, 0.25, 0.5, 1]) {
      const s = nodeAt(plan.byId.get(link.sourceId)!, t);
      const e = nodeAt(plan.byId.get(link.targetId)!, t);
      const { d, opacity } = linkAt(plan, link, t);
      expect(d.startsWith(`M${s.x},${s.y}C`)).toBe(true);
      expect(d.endsWith(`,${e.x},${e.y}`)).toBe(true);
      expect(opacity).toBeCloseTo(e.opacity);
    }
  });

  it("custom boxes attach links to the box edges", () => {
    const box = { width: 160, height: 72 };
    const lr = frameFromLayout(layoutOf(ALL, "lr", box));
    expect(lr.anchor).toEqual({ sourceX: 80, sourceY: 0, targetX: -80, targetY: 0 });
    const tb = frameFromLayout(layoutOf(ALL, "tb", box));
    expect(tb.anchor).toEqual({ sourceX: 0, sourceY: 36, targetX: 0, targetY: -36 });

    const plan = planTreeTransition(lr, frameFromLayout(layoutOf(PLATFORM_CLOSED, "lr", box)))!;
    const link = plan.links.find((l) => l.targetId === "0.1")!;
    const s = nodeAt(plan.byId.get("0")!, 0);
    const e = nodeAt(plan.byId.get("0.1")!, 0);
    const { d } = linkAt(plan, link, 0);
    expect(d.startsWith(`M${s.x + 80},${s.y}C`)).toBe(true);
    expect(d.endsWith(`,${e.x - 80},${e.y}`)).toBe(true);
  });

  it("an orientation switch blends the curve form and the size", () => {
    const prev = frameFromLayout(layoutOf(ALL, "lr"));
    const next = frameFromLayout(layoutOf(ALL, "tb"));
    const plan = planTreeTransition(prev, next)!;
    expect(sizeAt(plan, 0).linkForm).toBe(0);
    expect(sizeAt(plan, 1).linkForm).toBe(1);
    expect(sizeAt(plan, 0.5).linkForm).toBeCloseTo(0.5);
    expect(sizeAt(plan, 0.5).width).toBeCloseTo((prev.width + next.width) / 2);
  });

  it("an interruption plans from the mid-flight snapshot, exits included", () => {
    const all = frameFromLayout(layoutOf(ALL));
    const closed = frameFromLayout(layoutOf(PLATFORM_CLOSED));
    const first = planTreeTransition(all, closed)!;
    // Leaving nodes fade over the first half of the flight: half gone at 0.25.
    const snapshot = frameAt(first, 0.25);
    const ciMid = nodeIn(snapshot, "0.0.0");
    expect(ciMid.opacity).toBeCloseTo(0.5);

    // Re-open before the fold finished: CI moves back from where it is NOW.
    const second = planTreeTransition(snapshot, all)!;
    const ci = second.byId.get("0.0.0")!;
    expect(ci.kind).toBe("update");
    expect(nodeAt(ci, 0)).toEqual({ x: ciMid.x, y: ciMid.y, opacity: ciMid.opacity });
    expect(nodeAt(ci, 1).opacity).toBe(1);
  });

  it("drops nodes that had already faded out", () => {
    const all = frameFromLayout(layoutOf(ALL));
    const closed = frameFromLayout(layoutOf(PLATFORM_CLOSED));
    const first = planTreeTransition(all, closed)!;
    const nearlyDone = frameAt(first, 0.999);
    const productClosed = frameFromLayout(layoutOf(new Set(["0"])));
    const second = planTreeTransition(nearlyDone, productClosed)!;
    expect(second.byId.has("0.0.0")).toBe(false);
  });
});

describe("fades", () => {
  it("leaving nodes are gone by mid-flight; arriving ones wait for it", () => {
    expect(fadeOutAt(0)).toBe(1);
    expect(fadeOutAt(0.25)).toBeCloseTo(0.5);
    expect(fadeOutAt(0.5)).toBe(0);
    expect(fadeOutAt(1)).toBe(0);
    expect(fadeInAt(0)).toBe(0);
    expect(fadeInAt(0.5)).toBe(0);
    expect(fadeInAt(0.75)).toBeCloseTo(0.5);
    expect(fadeInAt(1)).toBe(1);
  });

  it("a mass collapse never shows two half-faded layers at once", () => {
    const all = frameFromLayout(layoutOf(ALL));
    const closed = frameFromLayout(layoutOf(new Set(["0"])));
    const plan = planTreeTransition(all, closed)!;
    for (const t of [0.5, 0.6, 0.8]) {
      for (const n of plan.nodes.filter((m) => m.kind === "exit")) {
        expect(nodeAt(n, t).opacity).toBe(0);
      }
    }
  });

  it("an entering node is still invisible at mid-flight", () => {
    const plan = planTreeTransition(
      frameFromLayout(layoutOf(PLATFORM_CLOSED)),
      frameFromLayout(layoutOf(ALL)),
    )!;
    const ci = plan.byId.get("0.0.0")!;
    expect(nodeAt(ci, 0.5).opacity).toBe(0);
    expect(nodeAt(ci, 1).opacity).toBe(1);
  });
});

describe("flightScrollTarget", () => {
  const cardBox = { width: 160, height: 72 };

  it("keeps the toggled node where it was on screen when it closes", () => {
    const before = layoutOf(ALL, "tb", cardBox);
    const after = layoutOf(PLATFORM_CLOSED, "tb", cardBox);
    const platformBefore = before.nodes.find((n) => n.id === "0.0")!;
    const platformAfter = after.nodes.find((n) => n.id === "0.0")!;
    const target = flightScrollTarget({
      viewport: { left: 40, top: 0, width: 200, height: 200 },
      layout: after,
      anchor: { id: "0.0", x: platformBefore.x, y: platformBefore.y },
      align: "start",
    });
    const maxLeft = Math.max(0, after.width - 200);
    expect(target.left).toBeCloseTo(
      Math.min(maxLeft, Math.max(0, 40 + platformAfter.x - platformBefore.x)),
    );
  });

  it("opening a branch scrolls its new children into view (tb, too tall for the view)", () => {
    const before = layoutOf(PLATFORM_CLOSED, "tb", cardBox);
    const after = layoutOf(ALL, "tb", cardBox);
    const platformBefore = before.nodes.find((n) => n.id === "0.0")!;
    const view = { left: 0, top: 0, width: 300, height: 120 };
    const target = flightScrollTarget({
      viewport: view,
      layout: after,
      anchor: { id: "0.0", x: platformBefore.x, y: platformBefore.y },
      align: "start",
    });
    const platform = after.nodes.find((n) => n.id === "0.0")!;
    // The family is taller than the view: it starts at the opened node.
    expect(target.top).toBeCloseTo(platform.hit.y - REVEAL_PADDING);
    // Across, the view centres on the family.
    const family = after.nodes.filter((n) => n.id === "0.0" || n.parentId === "0.0");
    const x0 = Math.min(...family.map((n) => n.hit.x)) - REVEAL_PADDING;
    const x1 = Math.max(...family.map((n) => n.hit.x + n.hit.width)) + REVEAL_PADDING;
    const expectedLeft = x1 - x0 > view.width ? (x0 + x1 - view.width) / 2 : 0;
    expect(target.left).toBeCloseTo(Math.min(after.width - view.width, Math.max(0, expectedLeft)));
  });

  it("opening a branch that fits moves the view the least it can", () => {
    const before = layoutOf(PLATFORM_CLOSED, "lr");
    const after = layoutOf(ALL, "lr");
    const platformBefore = before.nodes.find((n) => n.id === "0.0")!;
    const view = { left: 0, top: 0, width: after.width, height: after.height };
    const target = flightScrollTarget({
      viewport: view,
      layout: after,
      anchor: { id: "0.0", x: platformBefore.x, y: platformBefore.y },
      align: "start",
    });
    // Everything fits: nothing to scroll.
    expect(target).toEqual({ left: 0, top: 0 });
  });

  it("never scrolls past the new layout's edges", () => {
    const after = layoutOf(PLATFORM_CLOSED, "lr");
    const target = flightScrollTarget({
      viewport: { left: 500, top: 500, width: 50, height: 50 },
      layout: after,
      anchor: null,
      align: "start",
    });
    expect(target.left).toBeLessThanOrEqual(after.width - 50);
    expect(target.top).toBeLessThanOrEqual(after.height - 50);
    expect(target.left).toBeGreaterThanOrEqual(0);
    expect(target.top).toBeGreaterThanOrEqual(0);
  });

  it("align center keeps the root centred across the growth axis", () => {
    const after = layoutOf(ALL, "tb", cardBox);
    const root = after.nodes.find((n) => n.parentId === null)!;
    const target = flightScrollTarget({
      viewport: { left: 0, top: 0, width: 200, height: 200 },
      layout: after,
      anchor: null,
      root: { x: root.x, y: root.y },
      align: "center",
    });
    expect(target.left).toBeCloseTo(Math.min(after.width - 200, Math.max(0, root.x - 100)));
    expect(target.top).toBe(0);
  });
});

describe("linkPath", () => {
  it("matches d3's horizontal and vertical link shapes at the ends of the blend", () => {
    expect(linkPath(0, 0, 100, 50, 0)).toBe("M0,0C50,0,50,50,100,50");
    expect(linkPath(0, 0, 100, 50, 1)).toBe("M0,0C0,25,100,25,100,50");
  });

  it("reproduces the layout's own link path at rest", () => {
    const layout = layoutOf(ALL);
    const link = layout.links[0]!;
    const [sx, sy] = link.source;
    const [tx, ty] = link.target;
    expect(linkPath(sx, sy, tx, ty, 0)).toBe(link.d);
  });
});
