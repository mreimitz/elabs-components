import { describe, expect, it } from "vitest";

import { normalizeLog } from "../event-log";
import { DEFAULT_LIFECYCLE_VALUES, fromFlatRows, normalizeLifecycle } from "./flat";
import type { FlatRow } from "./flat";

const rows: FlatRow[] = [
  {
    case: "1",
    step: "Create Order",
    when: "2026-01-05T09:00:00Z",
    who: "A. Novak",
    region: "North",
  },
  {
    case: "1",
    step: "Check Credit",
    when: "2026-01-05T10:00:00Z",
    who: "Credit Service",
    region: "North",
  },
  {
    case: "2",
    step: "Create Order",
    when: "2026-01-06T09:00:00Z",
    who: "A. Novak",
    region: "South",
  },
];

const mapping = { caseId: "case", activity: "step", timestamp: "when", resource: "who" };

describe("fromFlatRows", () => {
  it("maps the three required columns onto EventRows", () => {
    const log = fromFlatRows(rows, mapping);
    expect(log.events).toHaveLength(3);
    expect(log.events[0]).toEqual({
      caseId: "1",
      activity: "Create Order",
      timestamp: "2026-01-05T09:00:00Z",
      resource: "A. Novak",
    });
  });

  it("skips rows missing a case id, an activity or a timestamp rather than throwing", () => {
    const log = fromFlatRows(
      [
        ...rows,
        { case: "", step: "Ship", when: "2026-01-05T09:00:00Z" },
        { case: "3", step: "", when: "2026-01-05T09:00:00Z" },
        { case: "3", step: "Ship", when: "" },
        { case: "3", step: "Ship", when: null },
        {},
      ],
      mapping,
    );
    expect(log.events).toHaveLength(3);
  });

  it("trims cell values and treats a blank cell as absent", () => {
    const log = fromFlatRows(
      [{ case: "  1  ", step: " Ship ", when: " 2026-01-05T09:00:00Z " }],
      mapping,
    );
    expect(log.events[0]).toMatchObject({ caseId: "1", activity: "Ship" });
    expect(log.events[0]?.resource).toBeUndefined();
  });

  it("passes a Date or an epoch number through without pre-converting it", () => {
    const date = new Date("2026-01-05T09:00:00Z");
    const log = fromFlatRows(
      [
        { case: "1", step: "Ship", when: date },
        { case: "1", step: "Pay", when: 1_767_600_000_000 },
      ],
      mapping,
    );
    expect(log.events[0]?.timestamp).toBe(date);
    expect(log.events[1]?.timestamp).toBe(1_767_600_000_000);
  });

  it("copies the named columns into event attributes", () => {
    const log = fromFlatRows(rows, { ...mapping, attributes: ["region"] });
    expect(log.events[0]?.attributes).toEqual({ region: "North" });
  });

  it("takes the FIRST non-empty value per case for case attributes", () => {
    const log = fromFlatRows(
      [
        { case: "1", step: "A", when: "2026-01-05T09:00:00Z", region: "North" },
        { case: "1", step: "B", when: "2026-01-05T10:00:00Z", region: "Elsewhere" },
      ],
      { ...mapping, caseAttributes: ["region"] },
    );
    expect(log.caseAttributes).toEqual({ "1": { region: "North" } });
  });

  it("omits caseAttributes entirely when none were requested", () => {
    expect(fromFlatRows(rows, mapping).caseAttributes).toBeUndefined();
  });

  it("feeds normalizeLog directly — the adapter's whole reason to exist", () => {
    const normalized = normalizeLog(fromFlatRows(rows, mapping));
    expect(normalized.totals).toEqual({ cases: 2, events: 3 });
    expect(normalized.cases[0]?.events.map((e) => e.activity)).toEqual([
      "Create Order",
      "Check Credit",
    ]);
  });
});

describe("normalizeLifecycle", () => {
  it("recognizes the default spellings, case-insensitively", () => {
    expect(normalizeLifecycle("START")).toBe("start");
    expect(normalizeLifecycle(" Completed ")).toBe("complete");
    expect(normalizeLifecycle("schedule")).toBe("start");
  });

  it("answers undefined for an unknown or empty value", () => {
    expect(normalizeLifecycle("suspend")).toBeUndefined();
    expect(normalizeLifecycle("")).toBeUndefined();
    expect(normalizeLifecycle(undefined)).toBeUndefined();
  });

  it("honours a source that spells the transitions differently", () => {
    expect(normalizeLifecycle("S", { start: ["S"], complete: ["C"] })).toBe("start");
    expect(normalizeLifecycle("C", { start: ["S"], complete: ["C"] })).toBe("complete");
    // An override of one half falls back to the defaults for the other.
    expect(normalizeLifecycle("complete", { start: ["S"] })).toBe("complete");
  });

  it("reaches normalizeLog through fromFlatRows and pairs the two halves", () => {
    const log = fromFlatRows(
      [
        { case: "1", step: "Pick", when: "2026-01-05T09:00:00Z", phase: "S" },
        { case: "1", step: "Pick", when: "2026-01-05T10:00:00Z", phase: "C" },
      ],
      { ...mapping, lifecycle: "phase", lifecycleValues: { start: ["S"], complete: ["C"] } },
    );
    const events = normalizeLog(log).cases[0]?.events ?? [];
    expect(events).toHaveLength(1);
    expect(events[0]?.duration).toBe(3_600_000);
  });

  it("exports the default spellings so a caller can extend rather than replace them", () => {
    expect(DEFAULT_LIFECYCLE_VALUES.start).toContain("start");
    expect(DEFAULT_LIFECYCLE_VALUES.complete).toContain("complete");
  });
});
