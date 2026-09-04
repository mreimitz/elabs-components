/**
 * Seeded synthetic event-log generator — RM-049.
 *
 * Produces an order-to-cash shaped log — a happy path, two exception branches, a rework
 * loop back to an earlier activity, an occasional repeat of one step, and a step-order
 * swap — at any size, from a seed. That is what lets tests, stories and benchmarks work
 * with a realistically messy log without this repo ever shipping a large binary fixture,
 * and without any of them depending on a wall clock.
 *
 * Determinism is the whole contract: `generateSyntheticLog({ cases: n, seed: s })` returns
 * a byte-identical log on every run, in every engine, forever. Downstream items snapshot
 * against it.
 */
import type { EventLog, EventRow } from "../types";

/** Epoch ms the first case starts at: 2026-01-05T08:00:00.000Z, a Monday morning. */
export const SYNTHETIC_LOG_EPOCH = 1767600000000;

const MINUTE = 60_000;

/** Options for {@link generateSyntheticLog}. */
export interface SyntheticLogOptions {
  /** How many cases to generate. Values below 1 yield an empty log. */
  cases: number;
  /** PRNG seed. The same seed always produces the same log. */
  seed?: number;
  /** Epoch ms the first case starts at. Defaults to {@link SYNTHETIC_LOG_EPOCH}. */
  startTime?: number;
}

/**
 * A deterministic 32-bit PRNG (mulberry32).
 *
 * Deliberately its own copy rather than one shared with the core's duration sampler: this
 * generator's output is a FIXTURE that tests assert exact numbers against, so it must not
 * shift because an unrelated internal in `duration-stats.ts` was retuned.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const RESOURCES = [
  "A. Novak",
  "B. Ferreira",
  "C. Okafor",
  "D. Lindqvist",
  "E. Haddad",
  "Credit Service",
  "Warehouse Robot",
] as const;

const REGIONS = ["North", "South", "East", "West"] as const;
const SEGMENTS = ["Enterprise", "Mid-market", "SMB"] as const;

/** Activity vocabulary. Exported so a story can label or colour by name without guessing. */
export const SYNTHETIC_ACTIVITIES = [
  "Create Order",
  "Check Credit",
  "Amend Order",
  "Approve Order",
  "Reject Order",
  "Reserve Stock",
  "Cancel Order",
  "Pick Items",
  "Ship Order",
  "Send Invoice",
  "Receive Payment",
] as const;

/** One activity name from {@link SYNTHETIC_ACTIVITIES}. */
export type SyntheticActivity = (typeof SYNTHETIC_ACTIVITIES)[number];

/** Build the activity sequence of a single case. Pure given `random`. */
function buildTrace(random: () => number): SyntheticActivity[] {
  const trace: SyntheticActivity[] = ["Create Order", "Check Credit"];

  // Rework: an amendment sends the order back through the credit check, at most twice.
  let reworks = 0;
  while (reworks < 2 && random() < 0.14) {
    trace.push("Amend Order", "Check Credit");
    reworks += 1;
  }

  if (random() < 0.09) {
    trace.push("Reject Order");
    return trace;
  }

  trace.push("Approve Order", "Reserve Stock");

  if (random() < 0.05) {
    trace.push("Cancel Order");
    return trace;
  }

  trace.push("Pick Items");
  // A short-picked order is picked again — the log's only self-loop.
  if (random() < 0.07) trace.push("Pick Items");

  // Roughly a third of orders are invoiced before they ship.
  if (random() < 0.32) trace.push("Send Invoice", "Ship Order");
  else trace.push("Ship Order", "Send Invoice");

  trace.push("Receive Payment");
  return trace;
}

/**
 * Generate a synthetic order-to-cash log.
 *
 * Every event is an INTERVAL event: it carries both a `startTimestamp` and a `timestamp`,
 * so activity durations and edge idle times are both non-zero and a performance view has
 * something real to show. Timestamps are epoch numbers rather than ISO strings — a
 * 13 000-case log is a quarter of a million rows, and making a benchmark of the discovery
 * pass mostly measure `Date.parse` would be measuring the wrong thing.
 *
 * Cases are emitted in order, one per `caseId` of the form `case-00001`, zero-padded so
 * lexical and numeric order agree.
 */
export function generateSyntheticLog(options: SyntheticLogOptions): EventLog {
  const total = Math.max(0, Math.floor(options.cases));
  const random = mulberry32(options.seed ?? 1);
  const epoch = options.startTime ?? SYNTHETIC_LOG_EPOCH;

  const events: EventRow[] = [];
  const caseAttributes: Record<string, Record<string, unknown>> = {};
  const pad = String(total).length;

  for (let index = 0; index < total; index += 1) {
    const caseId = `case-${String(index + 1).padStart(Math.max(5, pad), "0")}`;
    const trace = buildTrace(random);

    caseAttributes[caseId] = {
      region: REGIONS[Math.floor(random() * REGIONS.length)] as string,
      segment: SEGMENTS[Math.floor(random() * SEGMENTS.length)] as string,
      // Whole euros, so a table can render the value without a rounding decision.
      orderValue: 250 + Math.floor(random() * 9750),
    };

    // Cases arrive about an hour apart, with a jitter that keeps them from lining up.
    let cursor = epoch + index * 61 * MINUTE + Math.floor(random() * 40) * MINUTE;

    for (const activity of trace) {
      const idle = Math.floor(random() * 180) * MINUTE;
      const work = (2 + Math.floor(random() * 44)) * MINUTE;
      const start = cursor + idle;
      const end = start + work;
      events.push({
        caseId,
        activity,
        timestamp: end,
        startTimestamp: start,
        resource: RESOURCES[Math.floor(random() * RESOURCES.length)] as string,
      });
      cursor = end;
    }
  }

  return { events, caseAttributes };
}
