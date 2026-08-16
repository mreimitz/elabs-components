// check-timeline-fork.test.mjs — self-test for the Timeline-fork gate (#190).
// -----------------------------------------------------------------------------
// Locks: (1) a local Timeline* runtime declaration flags; (2) re-exports /
// imports / type-only declarations do NOT; (3) the hand-rolled rail signature
// (absolute w-px connector + status-keyed style map) flags; (4) a @elabs-ai/components-ui
// TimelineItem consumer does NOT; (5) commented-out code never flags; (6) the
// exemption covers the canonical dirs ONLY (the chain-of-thought allowlist
// entry was removed when #192 converged it onto AgentTimeline).
// Per quality-gates.md "Self-tested gates".
//
// Run: node --test scripts/check-timeline-fork.test.mjs   (pnpm timeline-fork:check:test)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  findTimelineForkViolations,
  isExempt,
  CONNECTOR_STRING_RE,
  STATUS_MAP_RE,
} from "./check-timeline-fork.mjs";

// ── Class 1: name forks ───────────────────────────────────────────────────────

test("local Timeline* runtime declarations flag", () => {
  const cases = [
    "export const TimelineFancy = forwardRef(function TimelineFancy(p, ref) { return null; });",
    "export function TimelineRail() { return null; }",
    "const Timeline = () => null;",
    "class TimelineView {}",
  ];
  for (const src of cases) {
    const v = findTimelineForkViolations(src);
    assert.equal(v.length >= 1, true, `should flag: ${src}`);
    assert.equal(v[0].kind, "name");
  }
});

test("imports, re-exports, and type-only declarations do NOT flag", () => {
  const cases = [
    'import { Timeline, TimelineItem } from "@elabs-ai/components-ui";',
    'export { Timeline, type TimelineProps } from "@elabs-ai/components-ui";',
    'export { Timeline, type TimelineEntry as TimelineItem } from "@elabs-ai/components-ui";',
    "export type TimelineThing = { id: string };",
    "export interface TimelineConfig { dense?: boolean }",
    "const items: TimelineEntry[] = [];", // usage of a Timeline-prefixed TYPE
  ];
  for (const src of cases) {
    assert.deepEqual(findTimelineForkViolations(src), [], `should NOT flag: ${src}`);
  }
});

// ── Class 2: rail forks ───────────────────────────────────────────────────────

const HAND_ROLLED_RAIL = `
const railStatusStyles: Record<MyStatus, string> = {
  done: "bg-success",
  pending: "bg-border",
};
export function StepList({ steps }) {
  return steps.map((s) => (
    <div key={s.id}>
      <span className="absolute top-7 bottom-0 left-1/2 w-px bg-border" />
      <span className={railStatusStyles[s.status]} />
    </div>
  ));
}
`;

test("the hand-rolled rail signature (connector + status map) flags", () => {
  const v = findTimelineForkViolations(HAND_ROLLED_RAIL);
  assert.equal(v.length, 1);
  assert.equal(v[0].kind, "rail");
  assert.ok(v[0].line > 0);
});

test("a @elabs-ai/components-ui rail consumer with extra absolute w-px decoration does NOT flag", () => {
  const consumer = `import { TimelineRoot, TimelineItem } from "@elabs-ai/components-ui";\n${HAND_ROLLED_RAIL}`;
  assert.deepEqual(findTimelineForkViolations(consumer), []);
});

test("one rail-signature half alone does NOT flag", () => {
  // connector only (e.g. a resizable handle)
  assert.deepEqual(
    findTimelineForkViolations(
      'const handle = "relative flex w-px items-center bg-border after:absolute after:w-1";',
    ),
    [],
  );
  // status map only (e.g. StatusBadge-style variants)
  assert.deepEqual(
    findTimelineForkViolations(
      'const statusStyles: Record<Status, string> = { pending: "bg-secondary" };',
    ),
    [],
  );
});

test("commented-out code never flags", () => {
  const commented = HAND_ROLLED_RAIL.split("\n")
    .map((l) => `// ${l}`)
    .join("\n");
  assert.deepEqual(findTimelineForkViolations(commented), []);
  assert.deepEqual(findTimelineForkViolations(`/*${HAND_ROLLED_RAIL}*/`), []);
});

test("regex calibration: real-tree friends and foes", () => {
  // the chain-of-thought connector string (the legacy idiom) matches…
  assert.match('"absolute top-7 bottom-0 left-1/2 -mx-px w-px bg-border"', CONNECTOR_STRING_RE);
  // …and its status map shape matches…
  assert.match("const stepStatusStyles = {", STATUS_MAP_RE);
  assert.match('Record<NonNullable<Props["status"]>, Status>', STATUS_MAP_RE);
  // …but a plain border hairline without `absolute` does not.
  assert.doesNotMatch('"h-full w-px bg-border"', CONNECTOR_STRING_RE);
});

// ── Exemptions ────────────────────────────────────────────────────────────────

test("only the canonical dirs are exempt; the #192-converged files are locked", () => {
  const root = "/repo";
  assert.ok(isExempt("/repo/packages/ui/src/components/timeline/timeline.tsx", root));
  assert.ok(isExempt("/repo/packages/editor/src/timeline/index.ts", root));
  // chain-of-thought converged onto AgentTimeline in #192 — no longer allowlisted.
  assert.ok(!isExempt("/repo/packages/ai/src/chain-of-thought.tsx", root));
  assert.ok(!isExempt("/repo/packages/ai/src/agent-timeline.tsx", root));
  assert.ok(!isExempt("/repo/packages/ai/src/task.tsx", root));
  assert.ok(!isExempt("/repo/packages/flow/src/inspector-panel.tsx", root));
});
