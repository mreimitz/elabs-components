/**
 * Rework detection — RM-050.
 *
 * "Rework" is the part of a process that happens more than once inside a single case: a
 * step retried immediately (a SELF-LOOP), or a step the case comes back to after going
 * somewhere else (a LOOP). Both are repeats, and separating them matters — a self-loop is
 * usually a retry or a batch, a loop is usually a rejection sending work backwards, and
 * the two lead to different conversations about the process.
 *
 * Counted per OCCURRENCE, over the normalized trace: the first execution of an activity in
 * a case is never rework, and every later one is exactly one of the two kinds. So
 * `selfLoops + loops` is precisely the number of repeated executions in the log.
 *
 * Deterministic and framework-free, like everything else in `/core`.
 */
import { asNormalizedLog, type AnyLog } from "./event-log";

/** Per-activity rework tallies. */
export interface ActivityRework {
  /** Repeats of this activity immediately after itself. */
  selfLoops: number;
  /** Repeats of this activity later in the same case, with something else in between. */
  loops: number;
}

/** What {@link detectRework} answers. */
export interface ReworkStats {
  /** Adjacent repeats across the whole log. */
  selfLoops: number;
  /** Non-adjacent repeats across the whole log. */
  loops: number;
  /** Fraction of cases carrying at least one self-loop or loop. `0` for an empty log. */
  caseReworkRate: number;
  /**
   * Every activity in the log, in ascending name order, with its own two tallies. An
   * activity that never repeats is present with zeros — a renderer joining this against
   * a graph's activities never has to distinguish "no rework" from "unknown activity".
   */
  perActivity: Record<string, ActivityRework>;
}

/**
 * Count rework in `log`.
 *
 * Accepts a raw or an already-normalized log and normalizes at most once
 * ({@link asNormalizedLog} is idempotent), so a caller that has already normalized for
 * `discoverGraph` pays nothing here.
 */
export function detectRework(log: AnyLog): ReworkStats {
  const normalized = asNormalizedLog(log);

  const tallies = new Map<string, ActivityRework>();
  let selfLoops = 0;
  let loops = 0;
  let casesWithRework = 0;

  const seen = new Set<string>();
  for (const kase of normalized.cases) {
    seen.clear();
    let caseHasRework = false;
    let previous: string | undefined;

    for (const event of kase.events) {
      const name = event.activity;
      let tally = tallies.get(name);
      if (tally === undefined) {
        tally = { selfLoops: 0, loops: 0 };
        tallies.set(name, tally);
      }

      if (seen.has(name)) {
        caseHasRework = true;
        if (name === previous) {
          tally.selfLoops += 1;
          selfLoops += 1;
        } else {
          tally.loops += 1;
          loops += 1;
        }
      } else {
        seen.add(name);
      }
      previous = name;
    }

    if (caseHasRework) casesWithRework += 1;
  }

  const perActivity: Record<string, ActivityRework> = {};
  for (const name of [...tallies.keys()].sort()) {
    perActivity[name] = tallies.get(name) as ActivityRework;
  }

  return {
    selfLoops,
    loops,
    caseReworkRate: normalized.cases.length === 0 ? 0 : casesWithRework / normalized.cases.length,
    perActivity,
  };
}
