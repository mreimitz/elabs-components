/**
 * `CaseTimeline`'s model — RM-055.
 *
 * Maps ONE case's raw `EventRow[]` to a flat, chronologically-ordered `CaseTimelineInstance[]`:
 * one entry per activity EXECUTION (not per activity name — a repeated activity gets one
 * instance per occurrence), each carrying the resolved start/end `normalizeLog` (RM-049)
 * already knows how to pair from `lifecycle: "start"`/`"complete"` rows.
 *
 * Two things this module adds on top of `normalizeLog`'s own trace:
 *
 * - **Waiting-time gaps** — the idle time between the END of one instance and the START of
 *   the NEXT in the case's own chronological order (not "next occurrence of the same
 *   activity" — a case has no natural per-activity lane once instances interleave). Surfaced
 *   as `gap` on the LATER instance, ready to become one `Gantt` `row.gaps` entry (RM-047).
 * - **Parallel flags** — any pair of instances whose intervals overlap by more than
 *   `parallelismThreshold` (default `0`: any genuine overlap) are both marked `isParallel`.
 *   O(n²) over one case's own instance count, which is small enough that this never needs
 *   the interval-tree machinery a whole-log analysis would.
 *
 * Plain `.ts` (no JSX, no `@elabs-ai/components-charts` import) — `case-timeline.tsx` is the
 * one place that turns an instance into a `Gantt` `GanttTask`, because that is also where the
 * parallel flag's localized text channel (WCAG 1.4.1 — colour is never the only channel) is
 * built, and `useLocale()` is only available from a component.
 */
import { normalizeLog } from "../core/event-log";
import type { EventRow } from "../core/types";

export interface CaseTimelineGap {
  start: number;
  end: number;
  durationMs: number;
}

/** One activity EXECUTION in the case's trace. */
export interface CaseTimelineInstance {
  /** Stable within one model build — the instance's position in chronological order. */
  id: string;
  activity: string;
  start: number;
  end: number;
  resource?: string;
  /** True for a `lifecycle: "start"` row that never got a matching `"complete"`. */
  isOpen: boolean;
  /** True when this instance's interval overlaps another by more than `parallelismThreshold`. */
  isParallel: boolean;
  /** Waiting time since the previous instance ended, when there was a gap. */
  gap?: CaseTimelineGap;
}

export interface CaseTimelineModelOptions {
  /**
   * Ms of overlap below which two instances are NOT flagged parallel. Default `0` — any
   * genuine overlap (however small) counts.
   */
  parallelismThreshold?: number;
}

/**
 * One case's trace as `CaseTimelineInstance[]`, in ascending `start` order — empty when
 * `events` resolves to no case (e.g. every row has an empty `caseId`/`activity`).
 */
export function buildCaseTimelineInstances(
  events: EventRow[],
  options: CaseTimelineModelOptions = {},
): CaseTimelineInstance[] {
  const threshold = options.parallelismThreshold ?? 0;
  const normalized = normalizeLog({ events });
  const kase = normalized.cases[0];
  if (!kase) return [];

  const instances: CaseTimelineInstance[] = kase.events.map((event, index) => {
    const instance: CaseTimelineInstance = {
      id: `${index}`,
      activity: event.activity,
      start: event.start,
      end: event.end,
      isOpen: event.isOpen,
      isParallel: false,
    };
    if (event.resource !== undefined) instance.resource = event.resource;
    return instance;
  });

  // Waiting-time gaps: chronological order, not "same activity" — `kase.events` is already
  // sorted by resolved start (`normalizeLog`'s own contract).
  for (let i = 1; i < instances.length; i += 1) {
    const previous = instances[i - 1] as CaseTimelineInstance;
    const current = instances[i] as CaseTimelineInstance;
    if (current.start > previous.end) {
      current.gap = {
        start: previous.end,
        end: current.start,
        durationMs: current.start - previous.end,
      };
    }
  }

  // Parallel flags: every pair whose intervals overlap by more than `threshold`.
  for (let i = 0; i < instances.length; i += 1) {
    for (let j = i + 1; j < instances.length; j += 1) {
      const a = instances[i] as CaseTimelineInstance;
      const b = instances[j] as CaseTimelineInstance;
      const overlap = Math.min(a.end, b.end) - Math.max(a.start, b.start);
      if (overlap > threshold) {
        a.isParallel = true;
        b.isParallel = true;
      }
    }
  }

  return instances;
}
