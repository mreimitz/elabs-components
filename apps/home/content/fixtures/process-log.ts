/**
 * Ashgrove's order-to-cash event log (RM-095, concept §4.2 "an ops analyst finding why 12 %
 * of cases take twice as long"). Six activities, ~2 000 cases, two variants: the standard
 * path, and a manual-review path (one extra `Credit Check`) that runs a documented multiplier
 * slower. `PROCESS_LOG_CASE_COUNT` and `PROCESS_LOG_SLOW_VARIANT_SHARE` (exactly 12 %, not a
 * converging probability — see `seededShuffledIndices`) are the two numbers the process
 * explorer tab's use-case sentence quotes, so the copy can never drift from the data.
 *
 * `EventRow`/`EventLog` come from `@elabs-ai/components-process/core` — the framework-free
 * process-mining data model (no React, no engine) — as a TYPE-ONLY import, so this fixture
 * carries none of the package's runtime weight.
 */
import type { EventLog, EventRow } from "@elabs-ai/components-process/core";
import { REGIONS } from "./company";
import { mulberry32, pick, seededShuffledIndices } from "./lib/prng";

const MINUTE = 60_000;

/** The six-activity vocabulary — the manual-review variant reuses these, never a 7th name. */
export const PROCESS_LOG_ACTIVITIES = [
  "Order Received",
  "Credit Check",
  "Provisioning",
  "Invoice Sent",
  "Payment Received",
  "Renewal Confirmed",
] as const;
export type ProcessLogActivity = (typeof PROCESS_LOG_ACTIVITIES)[number];

export const PROCESS_LOG_CASE_COUNT = 2_000;
/** Exactly 12 % of cases — the concept's own phrasing (§4.2). */
export const PROCESS_LOG_SLOW_VARIANT_SHARE = 0.12;

/**
 * The manual-review trace runs one extra `Credit Check` (7 steps, not 6). Scaling each
 * step's duration by `12/7` makes the 7-step trace's EXPECTED total exactly `12/7 × 7 = 12`
 * step-equivalents — precisely double the fast trace's `6` — so "twice as long" is the
 * designed expectation, not a coincidence of the per-step jitter.
 */
const SLOW_STEP_MULTIPLIER = 12 / 7;

const RESOURCES = [
  "Credit Service",
  "Billing Queue",
  "Provisioning Robot",
  "Priya Ramanathan",
  "Owen Lindqvist",
  "Fatima Haddad",
  "Support Desk",
] as const;

/** Epoch ms for 2026-07-01T08:00:00.000Z — Q3 FY26's first business morning. */
const EPOCH_MS = Date.UTC(2026, 6, 1, 8, 0, 0);

function buildTrace(isSlow: boolean): ProcessLogActivity[] {
  return isSlow
    ? [
        "Order Received",
        "Credit Check",
        "Credit Check",
        "Provisioning",
        "Invoice Sent",
        "Payment Received",
        "Renewal Confirmed",
      ]
    : [
        "Order Received",
        "Credit Check",
        "Provisioning",
        "Invoice Sent",
        "Payment Received",
        "Renewal Confirmed",
      ];
}

/**
 * A deterministic order-to-cash log. `slowSet` is an EXACT count (`seededShuffledIndices`),
 * not a per-case probability, so `PROCESS_LOG_SLOW_VARIANT_SHARE × cases` is the real slow-case
 * count on every run, not just its long-run average (`fixtures.test.ts`).
 */
export function generateProcessLog(cases = PROCESS_LOG_CASE_COUNT, seed = 41): EventLog {
  const total = Math.max(0, Math.floor(cases));
  const slowCount = Math.round(total * PROCESS_LOG_SLOW_VARIANT_SHARE);
  const slowSet = new Set(seededShuffledIndices(total, seed).slice(0, slowCount));
  const rnd = mulberry32(seed + 1);

  const events: EventRow[] = [];
  const caseAttributes: Record<string, Record<string, unknown>> = {};
  const pad = String(total).length;

  for (let index = 0; index < total; index += 1) {
    const caseId = `case-${String(index + 1).padStart(Math.max(5, pad), "0")}`;
    const isSlow = slowSet.has(index);
    const trace = buildTrace(isSlow);
    const multiplier = isSlow ? SLOW_STEP_MULTIPLIER : 1;

    caseAttributes[caseId] = {
      region: pick(REGIONS, rnd()),
      variant: isSlow ? "manual-review" : "standard",
    };

    // Cases arrive roughly every 27 minutes, jittered, across the whole quarter.
    let cursor = EPOCH_MS + index * 27 * MINUTE + Math.floor(rnd() * 20) * MINUTE;

    for (const activity of trace) {
      const idle = Math.floor(rnd() * 60 * multiplier) * MINUTE;
      const work = Math.floor((2 + rnd() * 22) * multiplier) * MINUTE;
      const start = cursor + idle;
      const end = start + work;
      events.push({
        caseId,
        activity,
        timestamp: end,
        startTimestamp: start,
        resource: pick(RESOURCES, rnd()),
      });
      cursor = end;
    }
  }

  return { events, caseAttributes };
}

/** The event log the process explorer tab renders. */
export const PROCESS_LOG: EventLog = generateProcessLog();
