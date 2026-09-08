/**
 * Shared, framework-free fixtures for `AbstractionControls`' stories AND its co-located
 * test (#376). Lifted into its own module — rather than exported straight from
 * `abstraction-controls.stories.tsx` — because `tsconfig.json` excludes `**\/*.stories.tsx`
 * from the package's typecheck project; importing one from a `.test.tsx` would pull the
 * whole story file (and its pre-existing, Storybook-only `StoryObj` typing) into that
 * project transitively. This module has no such baggage.
 */
import type { ActivityStats, DurationStats, ProcessGraph, TransitionStats } from "../core/types";

const zero: DurationStats = {
  min: 0,
  max: 0,
  mean: 0,
  median: 0,
  p90: 0,
  sum: 0,
  trimmedMean: 0,
};

/**
 * A 60-activity graph shaped like a real process: a 20-step high-frequency BACKBONE plus
 * 40 rare side activities, each hanging off it as `Step[i] -> Detour -> Step[i+1]`.
 *
 * The topology is the point, not the size (#376). `abstractGraph`'s `keepConnected` repair
 * restores reachability to a start/end activity, so on a strict unbranched CHAIN — the
 * shape the `Interaction` story's fixture used to be — dropping any suffix forces the whole
 * remainder back in and no slider position hides anything (measured; see
 * `auto-abstraction.test.ts`'s "known limitation" block and #343, which owns that runtime
 * behaviour). Dropping a rare detour here leaves the backbone connected, so a narrowing is a
 * real narrowing: at the "Auto" fraction for a 25-activity budget this fixture keeps exactly
 * the 20-step backbone plus 5 detours (25 total), locked in
 * `abstraction-controls.test.tsx`.
 */
export function backboneGraph(backbone = 20, sides = 40): ProcessGraph {
  const spine = Array.from(
    { length: backbone },
    (_, i) => `Step ${String(i + 1).padStart(2, "0")}`,
  );
  const side = Array.from({ length: sides }, (_, i) => `Detour ${String(i + 1).padStart(2, "0")}`);
  const activities: ActivityStats[] = [
    ...spine.map((id, i) => ({
      id,
      label: id,
      instances: 1000 - i,
      cases: 1000 - i,
      isStart: i === 0,
      isEnd: i === backbone - 1,
      duration: { ...zero, median: (i + 1) * 900_000 },
    })),
    ...side.map((id, i) => ({
      id,
      label: id,
      instances: 40 - i,
      cases: 40 - i,
      isStart: false,
      isEnd: false,
      duration: { ...zero, median: (i + 1) * 300_000 },
    })),
  ];
  const transitions: TransitionStats[] = [];
  const push = (source: string, target: string, count: number) => {
    transitions.push({
      source,
      target,
      count,
      caseCount: Math.max(1, Math.round(count * 0.8)),
      duration: { ...zero, median: count * 60_000 },
      isSelfLoop: source === target,
      isBackEdge: false,
    });
  };
  for (let i = 0; i < backbone - 1; i += 1) push(spine[i]!, spine[i + 1]!, 900 - i * 5);
  side.forEach((id, i) => {
    const anchor = i % (backbone - 1);
    push(spine[anchor]!, id, 40 - i);
    push(id, spine[anchor + 1]!, 40 - i);
  });
  return {
    activities,
    transitions,
    startActivities: { [spine[0]!]: 1000 },
    endActivities: { [spine[backbone - 1]!]: 1000 },
    totals: { cases: 1000, events: 6000, variants: 41 },
  };
}
