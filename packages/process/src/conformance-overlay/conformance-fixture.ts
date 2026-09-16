/**
 * The conformance fixture RM-062's components, tests and stories share — a small,
 * hand-built purchase-approval log replayed against its happy path, so every number a
 * story shows can be checked by hand.
 *
 * Happy path: Register → Check credit → Approve → Pay (every step required).
 *
 * | cases     | trace                                          | deviation    |
 * | --------- | ---------------------------------------------- | ------------ |
 * | c01 … c06 | Register, Check credit, Approve, Pay           | none         |
 * | c07, c08  | Register, Approve, Pay                         | `skipped`    |
 * | c09       | Register, Check credit, Escalate, Approve, Pay | `undesired`  |
 * | c10       | Register, Check credit, Approve                | `incomplete` |
 *
 * Cases start one per fortnight from 2026-01-05 (UTC), so a monthly
 * `conformanceRateSeries` has more than one point.
 *
 * Framework-free: no React, so a unit test and a story import the same data.
 */
import type { HappyPath } from "../core/reference-model";
import type { EventLog, EventRow } from "../core/types";

/** The fixture's prescribed process. */
export const CONFORMANCE_FIXTURE_PATH: HappyPath = {
  id: "purchase-approval",
  label: "Purchase approval",
  steps: [
    { activity: "Register" },
    { activity: "Check credit" },
    { activity: "Approve" },
    { activity: "Pay" },
  ],
};

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const FIRST_START = Date.UTC(2026, 0, 5, 9);

const TRACES: ReadonlyArray<readonly [string, readonly string[]]> = [
  ["c01", ["Register", "Check credit", "Approve", "Pay"]],
  ["c02", ["Register", "Check credit", "Approve", "Pay"]],
  ["c03", ["Register", "Check credit", "Approve", "Pay"]],
  ["c04", ["Register", "Check credit", "Approve", "Pay"]],
  ["c05", ["Register", "Check credit", "Approve", "Pay"]],
  ["c06", ["Register", "Check credit", "Approve", "Pay"]],
  ["c07", ["Register", "Approve", "Pay"]],
  ["c08", ["Register", "Approve", "Pay"]],
  ["c09", ["Register", "Check credit", "Escalate", "Approve", "Pay"]],
  ["c10", ["Register", "Check credit", "Approve"]],
];

function rows(caseId: string, start: number, trace: readonly string[]): EventRow[] {
  return trace.map((activity, i) => ({ caseId, activity, timestamp: start + i * HOUR }));
}

/** The fixture event log. */
export const CONFORMANCE_FIXTURE_LOG: EventLog = {
  events: TRACES.flatMap(([caseId, trace], i) => rows(caseId, FIRST_START + i * 14 * DAY, trace)),
};
