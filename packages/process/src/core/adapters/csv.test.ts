import { describe, expect, it } from "vitest";

import { normalizeLog } from "../event-log";
import { fromCsv, parseDelimited } from "./csv";

const mapping = { caseId: "case", activity: "activity", timestamp: "timestamp" };

describe("parseDelimited", () => {
  it("parses a plain comma-separated table", () => {
    expect(parseDelimited("a,b,c\n1,2,3")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("does not emit a phantom record for a trailing newline", () => {
    expect(parseDelimited("a,b\n1,2\n")).toHaveLength(2);
    expect(parseDelimited("a,b\r\n1,2\r\n")).toHaveLength(2);
  });

  it("keeps a delimiter, a newline and a CRLF inside a quoted field", () => {
    expect(parseDelimited('a,b\n"x,y","line1\nline2"')[1]).toEqual(["x,y", "line1\nline2"]);
    expect(parseDelimited('a\n"line1\r\nline2"')[1]).toEqual(["line1\r\nline2"]);
  });

  it("reads a doubled quote inside a quoted field as one literal quote", () => {
    expect(parseDelimited('a\n"say ""hi"""')[1]).toEqual(['say "hi"']);
  });

  it("strips a UTF-8 BOM from the first field", () => {
    expect(parseDelimited("﻿case,activity\n1,Ship")[0]).toEqual(["case", "activity"]);
  });

  it("preserves empty fields, including a trailing one", () => {
    expect(parseDelimited("a,b,c\n1,,3")[1]).toEqual(["1", "", "3"]);
    expect(parseDelimited("a,b\n1,")[1]).toEqual(["1", ""]);
  });

  it("does not trim field values — trimming is the mapping's decision", () => {
    expect(parseDelimited("a\n  spaced  ")[1]).toEqual(["  spaced  "]);
  });

  it("tolerates an unterminated quote by running the field to the end", () => {
    expect(parseDelimited('a\n"never closed')[1]).toEqual(["never closed"]);
  });

  it("honours a non-comma delimiter", () => {
    expect(parseDelimited("a\tb\n1\t2", "\t")[1]).toEqual(["1", "2"]);
    expect(parseDelimited("a;b\n1;2", ";")[1]).toEqual(["1", "2"]);
  });

  it("answers empty text with no records", () => {
    expect(parseDelimited("")).toEqual([]);
  });
});

describe("fromCsv", () => {
  const text = [
    "case,activity,timestamp,resource",
    "1,Create Order,2026-01-05T09:00:00Z,A. Novak",
    "1,Check Credit,2026-01-05T10:00:00Z,Credit Service",
    "2,Create Order,2026-01-06T09:00:00Z,A. Novak",
    "",
  ].join("\n");

  it("reads the header row and maps the columns", () => {
    const log = fromCsv(text, { ...mapping, resource: "resource" });
    expect(log.events).toHaveLength(3);
    expect(log.events[0]).toEqual({
      caseId: "1",
      activity: "Create Order",
      timestamp: "2026-01-05T09:00:00Z",
      resource: "A. Novak",
    });
  });

  it("trims header names so a hand-edited export still matches", () => {
    const log = fromCsv("case , activity ,timestamp\n1,Ship,2026-01-05T09:00:00Z", mapping);
    expect(log.events).toHaveLength(1);
  });

  it("accepts a headerless source when the caller names the columns", () => {
    const log = fromCsv("1,Ship,2026-01-05T09:00:00Z", {
      ...mapping,
      header: ["case", "activity", "timestamp"],
    });
    expect(log.events[0]?.activity).toBe("Ship");
  });

  it("handles a quoted activity name containing the delimiter", () => {
    const log = fromCsv(
      'case,activity,timestamp\n1,"Approve, then ship",2026-01-05T09:00:00Z',
      mapping,
    );
    expect(log.events[0]?.activity).toBe("Approve, then ship");
  });

  it("reads a semicolon-delimited European export", () => {
    const log = fromCsv("case;activity;timestamp\n1;Ship;2026-01-05T09:00:00Z", {
      ...mapping,
      delimiter: ";",
    });
    expect(log.events[0]?.caseId).toBe("1");
  });

  it("answers empty text with an empty log rather than throwing", () => {
    expect(fromCsv("", mapping)).toEqual({ events: [] });
  });

  it("delegates skipping to fromFlatRows — a short row does not become an event", () => {
    const log = fromCsv("case,activity,timestamp\n1,Ship\n2,Pay,2026-01-05T09:00:00Z", mapping);
    expect(log.events).toHaveLength(1);
    expect(log.events[0]?.caseId).toBe("2");
  });

  it("feeds normalizeLog end to end, lifecycle pairing included", () => {
    const csv = [
      "case,activity,timestamp,phase",
      "1,Pick,2026-01-05T09:00:00Z,start",
      "1,Pack,2026-01-05T10:00:00Z,start",
      "1,Pick,2026-01-05T11:00:00Z,complete",
      "1,Pack,2026-01-05T12:00:00Z,complete",
    ].join("\n");
    const normalized = normalizeLog(fromCsv(csv, { ...mapping, lifecycle: "phase" }));
    expect(normalized.totals).toEqual({ cases: 1, events: 2 });
    expect(normalized.cases[0]?.events.map((e) => [e.activity, e.duration])).toEqual([
      ["Pick", 7_200_000],
      ["Pack", 7_200_000],
    ]);
  });
});
