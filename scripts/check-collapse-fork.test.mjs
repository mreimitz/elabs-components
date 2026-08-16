// check-collapse-fork.test.mjs — self-test for the collapse-fork gate (#190).
// -----------------------------------------------------------------------------
// Locks: (1) a hand-rolled gap-spacer + fixed-slide width tween flags; (2) a
// useCollapsiblePanel consumer with the same literals does NOT flag (reuse, not
// drift); (3) either signature half alone does NOT flag; (4) commented-out code
// never flags. Per quality-gates.md "Self-tested gates".
//
// Run: node --test scripts/check-collapse-fork.test.mjs   (pnpm collapse-fork:check:test)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  findCollapseForkViolations,
  isCanonical,
  stripComments,
  TRANSITION_WIDTH_RE,
  OFFSCREEN_SLIDE_RE,
} from "./check-collapse-fork.mjs";

const HAND_ROLLED_FORK = `
export function MyPanel({ open }: { open: boolean }) {
  return (
    <div data-state={open ? "expanded" : "collapsed"} className="group">
      <div className="relative w-(--my-panel-width) bg-transparent transition-[width] duration-base ease-linear group-data-[state=collapsed]:w-0" />
      <div className="fixed inset-y-0 z-10 hidden h-svh w-(--my-panel-width) transition-[left,right,width] duration-base ease-linear md:flex right-0 group-data-[state=collapsed]:right-[calc(var(--my-panel-width)*-1)]" />
    </div>
  );
}
`;

const HOOK_CONSUMER = `
import { useCollapsiblePanel } from "../collapsible-panel";
export function MyPanel() {
  const panel = useCollapsiblePanel({
    side: "right",
    widthClassName: "w-(--my-panel-width)",
    containerSlideClassNames: {
      left: "left-0 group-data-[state=collapsed]:left-[calc(var(--my-panel-width)*-1)]",
      right: "right-0 group-data-[state=collapsed]:right-[calc(var(--my-panel-width)*-1)]",
    },
  });
  return <div {...panel.attrs}><div className={panel.spacerClassName} /></div>;
}
`;

test("a hand-rolled spacer + fixed-slide width tween flags", () => {
  const violations = findCollapseForkViolations(HAND_ROLLED_FORK);
  assert.equal(violations.length, 1);
  assert.match(violations[0].transition, /transition-\[/);
  assert.match(violations[0].slide, /calc\(var\(--my-panel-width\)\*-1\)/);
  assert.ok(violations[0].transitionLine > 0);
});

test("a useCollapsiblePanel consumer with the same literals does NOT flag", () => {
  assert.deepEqual(findCollapseForkViolations(HOOK_CONSUMER), []);
});

test("one signature half alone does NOT flag", () => {
  // width tween only (a chart progress bar)
  assert.deepEqual(
    findCollapseForkViolations(
      'const bar = "h-full rounded-full transition-[width] duration-slow";',
    ),
    [],
  );
  // off-screen slide only
  assert.deepEqual(
    findCollapseForkViolations(
      'const slide = "right-0 group-data-[state=collapsed]:right-[calc(var(--x)*-1)]";',
    ),
    [],
  );
});

test("commented-out code never flags", () => {
  const commented = HAND_ROLLED_FORK.split("\n")
    .map((l) => `// ${l}`)
    .join("\n");
  assert.deepEqual(findCollapseForkViolations(commented), []);
  assert.deepEqual(findCollapseForkViolations(`/*${HAND_ROLLED_FORK}*/`), []);
});

test("regex calibration: real-tree friends and foes", () => {
  // sidebar's old fragments (now hook-emitted) would match both halves…
  assert.match(
    "fixed inset-y-0 z-10 hidden h-svh w-(--sidebar-width) transition-[left,right,width] duration-base ease-linear md:flex",
    TRANSITION_WIDTH_RE,
  );
  assert.match(
    "left-0 group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)]",
    OFFSCREEN_SLIDE_RE,
  );
  // …but tokened transitions / plain positioning do not.
  assert.doesNotMatch("transition-transform duration-base", TRANSITION_WIDTH_RE);
  assert.doesNotMatch("left-0 -translate-x-1/2", OFFSCREEN_SLIDE_RE);
});

test("isCanonical exempts only the collapsible-panel folder", () => {
  const root = "/repo";
  assert.ok(
    isCanonical(
      "/repo/packages/ui/src/components/collapsible-panel/use-collapsible-panel.ts",
      root,
    ),
  );
  assert.ok(!isCanonical("/repo/packages/ui/src/components/sidebar/sidebar.tsx", root));
  assert.ok(!isCanonical("/repo/packages/ai/src/context-panel.tsx", root));
});

test("stripComments removes block and line comments but keeps URLs", () => {
  assert.equal(stripComments("a /* b */ c").includes("b"), false);
  assert.equal(stripComments("x // y\nz").includes("y"), false);
  assert.ok(stripComments('fetch("https://x.test/path")').includes("https://x.test/path"));
});
