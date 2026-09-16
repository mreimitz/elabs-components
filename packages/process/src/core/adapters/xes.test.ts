import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { normalizeLog } from "../event-log";
import { fromXes } from "./xes";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "../fixtures");
const sampleXes = readFileSync(join(fixturesDir, "sample.xes"), "utf8");

describe("fromXes", () => {
  it("parses the 3-trace fixture to the hand-computed EventLog", () => {
    const result = fromXes(sampleXes);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok: true");

    expect(result.log.events).toEqual([
      {
        caseId: "case-1",
        activity: "Create Order",
        timestamp: "2026-01-05T09:00:00.000Z",
        resource: "A. Novak",
      },
      {
        caseId: "case-1",
        activity: "Check Credit",
        timestamp: "2026-01-05T09:15:00.000Z",
        resource: "Credit Service",
        attributes: { "cost:total": 120.5 },
      },
      {
        caseId: "case-2",
        activity: "Register",
        timestamp: "2026-01-06T09:00:00.000Z",
        resource: "System",
        lifecycle: "start",
      },
      {
        caseId: "case-2",
        activity: "Register",
        timestamp: "2026-01-06T09:10:00.000Z",
        resource: "System",
        lifecycle: "complete",
      },
      {
        caseId: "case-2",
        activity: "Approve",
        timestamp: "2026-01-06T09:10:00.000Z",
        resource: "B. Kowalski",
        lifecycle: "start",
      },
      {
        caseId: "case-2",
        activity: "Approve",
        timestamp: "2026-01-06T09:30:00.000Z",
        resource: "B. Kowalski",
        lifecycle: "complete",
      },
      {
        caseId: "case-3",
        activity: "Create Order",
        timestamp: "2026-01-07T09:00:00.000Z",
        resource: "Unassigned",
      },
      {
        caseId: "case-3",
        activity: "Ship Order",
        timestamp: "2026-01-07T09:20:00.000Z",
        resource: "Courier",
      },
    ]);

    expect(result.log.caseAttributes).toEqual({
      "case-1": { channel: "web" },
      "case-2": { channel: "mobile" },
      "case-3": { channel: "phone" },
    });
  });

  it("feeds normalizeLog end to end, lifecycle pairing included", () => {
    const result = fromXes(sampleXes);
    if (!result.ok) throw new Error("expected ok: true");

    const normalized = normalizeLog(result.log);
    expect(normalized.totals).toEqual({ cases: 3, events: 6 });

    const register = normalized.cases
      .find((c) => c.caseId === "case-2")
      ?.events.find((e) => e.activity === "Register");
    expect(register).toMatchObject({ duration: 10 * 60 * 1000, isOpen: false });
  });

  it('defaults org:resource for an event from a <global scope="event"> element', () => {
    const result = fromXes(sampleXes);
    if (!result.ok) throw new Error("expected ok: true");

    const defaulted = result.log.events.find(
      (event) => event.caseId === "case-3" && event.activity === "Create Order",
    );
    expect(defaulted?.resource).toBe("Unassigned");
  });

  it("returns { ok: false, errors } for a trace with no events, rather than throwing", () => {
    const xml = [
      '<?xml version="1.0"?>',
      "<log>",
      "<trace>",
      '<string key="concept:name" value="empty-case"/>',
      "</trace>",
      "</log>",
    ].join("");

    const result = fromXes(xml);
    expect(result).toEqual({
      ok: false,
      errors: [{ type: "missing_trace", message: "trace has no events", traceIndex: 0 }],
    });
  });

  it("returns { ok: false, errors } for an event missing time:timestamp, rather than throwing", () => {
    const xml = [
      '<?xml version="1.0"?>',
      "<log>",
      "<trace>",
      '<string key="concept:name" value="case-1"/>',
      "<event>",
      '<string key="concept:name" value="Create Order"/>',
      "</event>",
      "</trace>",
      "</log>",
    ].join("");

    const result = fromXes(xml);
    expect(result).toEqual({
      ok: false,
      errors: [
        {
          type: "missing_timestamp",
          message: "event is missing time:timestamp",
          traceIndex: 0,
          eventIndex: 0,
        },
      ],
    });
  });

  it("returns { ok: false, errors } for an event missing its classifier key, rather than throwing", () => {
    const xml = [
      '<?xml version="1.0"?>',
      "<log>",
      "<trace>",
      '<string key="concept:name" value="case-1"/>',
      "<event>",
      '<date key="time:timestamp" value="2026-01-05T09:00:00.000Z"/>',
      "</event>",
      "</trace>",
      "</log>",
    ].join("");

    const result = fromXes(xml);
    expect(result).toEqual({
      ok: false,
      errors: [
        {
          type: "missing_concept_name",
          message: "event is missing its classifier key(s)",
          traceIndex: 0,
          eventIndex: 0,
        },
      ],
    });
  });

  it("returns a single malformed_xml error for unparsable XML, rather than throwing", () => {
    const result = fromXes("<log><trace><event></trace></log>");
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected ok: false");
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.type).toBe("malformed_xml");
  });

  it("collects errors across more than one trace instead of stopping at the first", () => {
    const xml = [
      '<?xml version="1.0"?>',
      "<log>",
      "<trace>",
      '<string key="concept:name" value="case-1"/>',
      "</trace>",
      "<trace>",
      '<string key="concept:name" value="case-2"/>',
      "<event>",
      '<string key="concept:name" value="Ship"/>',
      "</event>",
      "</trace>",
      "</log>",
    ].join("");

    const result = fromXes(xml);
    expect(result).toEqual({
      ok: false,
      errors: [
        { type: "missing_trace", message: "trace has no events", traceIndex: 0 },
        {
          type: "missing_timestamp",
          message: "event is missing time:timestamp",
          traceIndex: 1,
          eventIndex: 0,
        },
      ],
    });
  });

  it("decodes XML entities in attribute values", () => {
    const xml = [
      '<?xml version="1.0"?>',
      "<log>",
      "<trace>",
      '<string key="concept:name" value="case-1"/>',
      "<event>",
      '<string key="concept:name" value="Ship &amp; Invoice"/>',
      '<date key="time:timestamp" value="2026-01-05T09:00:00.000Z"/>',
      "</event>",
      "</trace>",
      "</log>",
    ].join("");

    const result = fromXes(xml);
    if (!result.ok) throw new Error("expected ok: true");
    expect(result.log.events[0]?.activity).toBe("Ship & Invoice");
  });

  it('maps every non-"start" lifecycle value to "complete" under the default model', () => {
    const xml = [
      '<?xml version="1.0"?>',
      "<log>",
      "<trace>",
      '<string key="concept:name" value="case-1"/>',
      "<event>",
      '<string key="concept:name" value="Review"/>',
      '<date key="time:timestamp" value="2026-01-05T09:00:00.000Z"/>',
      '<string key="lifecycle:transition" value="schedule"/>',
      "</event>",
      "</trace>",
      "</log>",
    ].join("");

    const result = fromXes(xml);
    if (!result.ok) throw new Error("expected ok: true");
    expect(result.log.events[0]?.lifecycle).toBe("complete");
  });

  it('drops lifecycle to undefined under lifecycleModel: "none"', () => {
    const xml = [
      '<?xml version="1.0"?>',
      "<log>",
      "<trace>",
      '<string key="concept:name" value="case-1"/>',
      "<event>",
      '<string key="concept:name" value="Review"/>',
      '<date key="time:timestamp" value="2026-01-05T09:00:00.000Z"/>',
      '<string key="lifecycle:transition" value="start"/>',
      "</event>",
      "</trace>",
      "</log>",
    ].join("");

    const result = fromXes(xml, { lifecycleModel: "none" });
    if (!result.ok) throw new Error("expected ok: true");
    expect(result.log.events[0]?.lifecycle).toBeUndefined();
  });

  it("honours an explicit options.classifiers over concept:name", () => {
    const xml = [
      '<?xml version="1.0"?>',
      "<log>",
      "<trace>",
      '<string key="concept:name" value="case-1"/>',
      "<event>",
      '<string key="concept:name" value="Ship"/>',
      '<string key="activity:name" value="Ship Order"/>',
      '<date key="time:timestamp" value="2026-01-05T09:00:00.000Z"/>',
      "</event>",
      "</trace>",
      "</log>",
    ].join("");

    const result = fromXes(xml, { classifiers: ["activity:name"] });
    if (!result.ok) throw new Error("expected ok: true");
    expect(result.log.events[0]?.activity).toBe("Ship Order");
  });
});
