import { describe, expect, it } from "vitest";

import { OCEL_SAMPLE } from "../fixtures/ocel-sample";
import { normalizeLog } from "../event-log";
import { fromOcel, readObjectRefs, type OcelJson } from "./ocel";

/** `[caseId, activity]` per row — the hand-verified table in `ocel-sample.ts`. */
function rowsOf(result: ReturnType<typeof fromOcel>, type: string) {
  if (!result.ok) throw new Error("expected ok: true");
  return result.logs[type]!.events.map((row) => [row.caseId, row.activity]);
}

describe("fromOcel", () => {
  it("projects the 3-type, 4-event fixture into one log per object type", () => {
    const result = fromOcel(OCEL_SAMPLE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.objectTypes).toEqual(["order", "item", "package"]);
    expect(result.activities).toEqual(["Place Order", "Pick Item", "Pack", "Ship"]);

    //  type    | rows | caseId assignment
    //  order   |  3   | o1 ×3
    //  item    |  5   | i1 ×3, i2 ×2
    //  package |  2   | p1 ×2
    expect(rowsOf(result, "order")).toEqual([
      ["o1", "Place Order"],
      ["o1", "Pack"],
      ["o1", "Ship"],
    ]);
    expect(rowsOf(result, "item")).toEqual([
      ["i1", "Place Order"],
      ["i2", "Place Order"],
      ["i1", "Pick Item"],
      ["i1", "Pack"],
      ["i2", "Pack"],
    ]);
    expect(rowsOf(result, "package")).toEqual([
      ["p1", "Pack"],
      ["p1", "Ship"],
    ]);
  });

  it("keeps the event id, the object map and scalar event attributes on every row", () => {
    const result = fromOcel(OCEL_SAMPLE);
    if (!result.ok) throw new Error("expected ok: true");
    const [first] = result.logs.item!.events;
    expect(first!.timestamp).toBe("2026-01-05T09:00:00.000Z");
    expect(first!.attributes).toMatchObject({ channel: "web", __ocelEventId: "e1" });
    expect(readObjectRefs(first!)).toEqual({ order: ["o1"], item: ["i1", "i2"] });
    // The same object under two qualifiers is one reference, not two rows.
    const pack = result.logs.item!.events.filter((row) => row.activity === "Pack");
    expect(pack.map((row) => row.caseId)).toEqual(["i1", "i2"]);
    expect(readObjectRefs({ caseId: "x", activity: "y", timestamp: 0 })).toBeUndefined();
  });

  it("uses an object's latest attribute values as its case attributes", () => {
    const result = fromOcel(OCEL_SAMPLE);
    if (!result.ok) throw new Error("expected ok: true");
    expect(result.logs.order!.caseAttributes).toEqual({ o1: { value: 95 } });
    expect(result.logs.item!.caseAttributes).toBeUndefined();
  });

  it("projects only the requested object types, in the requested order", () => {
    const result = fromOcel(OCEL_SAMPLE, { objectTypes: ["package", "order"] });
    if (!result.ok) throw new Error("expected ok: true");
    expect(Object.keys(result.logs)).toEqual(["package", "order"]);
  });

  it("accepts a JSON string and feeds normalizeLog unchanged", () => {
    const result = fromOcel(JSON.stringify(OCEL_SAMPLE));
    if (!result.ok) throw new Error("expected ok: true");
    expect(normalizeLog(result.logs.order!).cases).toHaveLength(1);
  });

  it("rejects malformed JSON and non-OCEL documents", () => {
    const malformed = fromOcel("{ nope");
    expect(malformed.ok).toBe(false);
    if (!malformed.ok) expect(malformed.errors[0]!.type).toBe("malformed_json");

    const invalid = fromOcel(JSON.stringify({ events: [] }));
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) expect(invalid.errors[0]!.type).toBe("invalid_document");
  });

  it("collects every per-event problem instead of stopping at the first", () => {
    const broken: OcelJson = {
      objectTypes: [{ name: "order" }],
      objects: [
        { id: "o1", type: "order" },
        { id: "x1", type: "ghost" },
      ],
      events: [
        { id: "", type: "A", time: "2026-01-01T00:00:00Z" },
        { id: "e2", type: "", time: "2026-01-01T00:00:00Z" },
        { id: "e3", type: "C", time: "not a date" },
        { id: "e4", type: "D", time: "2026-01-01T00:00:00Z", relationships: [{ objectId: "zz" }] },
      ],
    };
    const result = fromOcel(broken, { objectTypes: ["order", "nope"] });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.map((error) => error.type)).toEqual([
      "unknown_object_type",
      "unknown_object_type",
      "missing_event_id",
      "missing_event_type",
      "missing_timestamp",
      "unknown_object",
    ]);
  });
});
