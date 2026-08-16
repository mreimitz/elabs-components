import { normalizeFileSource } from "@qlik-coe-emea/qlabs-components-ui";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ResolvedHighlight } from "../../core/highlight";
import csvModule, { CSV_ROW_LIMIT, type CsvDocument } from "./csv-adapter";

const parse = (text: string, name = "rows.csv") =>
  csvModule
    .create()
    .load(normalizeFileSource({ kind: "text", text, name }), {}) as Promise<CsvDocument>;

describe("csv adapter — parsing", () => {
  it("keeps a quoted comma in one cell (the bug the split-on-comma parser had)", async () => {
    const doc = await parse('name,address\nAda,"12 High St, London"\n');
    expect(doc.columns).toEqual(["name", "address"]);
    expect(doc.rows).toEqual([["Ada", "12 High St, London"]]);
  });

  it("handles escaped quotes and embedded newlines", async () => {
    const doc = await parse('quote,note\n"She said ""hi""","line one\nline two"\n');
    expect(doc.rows[0]).toEqual(['She said "hi"', "line one\nline two"]);
  });

  it("detects a semicolon delimiter rather than trusting the extension", async () => {
    const doc = await parse("a;b\n1;2\n");
    expect(doc.columns).toEqual(["a", "b"]);
    expect(doc.rows).toEqual([["1", "2"]]);
  });

  it("reads a tab-separated file", async () => {
    const doc = await parse("a\tb\n1\t2\n", "rows.tsv");
    expect(doc.columns).toEqual(["a", "b"]);
    expect(doc.rows).toEqual([["1", "2"]]);
  });

  it("reports truncation instead of silently dropping rows", async () => {
    const rows = Array.from({ length: CSV_ROW_LIMIT + 10 }, (_, i) => `${String(i)},x`).join("\n");
    const doc = await parse(`a,b\n${rows}\n`);
    expect(doc.rows).toHaveLength(CSV_ROW_LIMIT);
    expect(doc.totalRows).toBe(CSV_ROW_LIMIT + 10);
  });

  it("does not claim truncation when the file fits", async () => {
    const doc = await parse("a,b\n1,2\n");
    expect(doc.totalRows).toBeUndefined();
  });

  it("projects the PARSED grid as its text, not the raw file", async () => {
    // Deliberate change: a citation has to address what the reader sees. The
    // raw bytes carry quoting, escapes and whatever delimiter the exporter
    // chose, so an offset into them lands nowhere in the rendered table.
    const doc = await parse('name,address\nAda,"12 High St, London"\n');
    expect(doc.text).toBe("name\taddress\nAda\t12 High St, London");
  });

  it("maps each row back to its place in the projection", async () => {
    const doc = await parse("a,b\n1,2\n3,4\n");
    const spans = doc.textIndex?.spans ?? [];
    expect(spans.map((span) => [doc.text?.slice(span.start, span.end), span.ref])).toEqual([
      ["a\tb", { sheet: 0, row: -1 }],
      ["1\t2", { sheet: 0, row: 0 }],
      ["3\t4", { sheet: 0, row: 1 }],
    ]);
  });
});

describe("csv adapter — rendering", () => {
  it("renders a real table with the file's own headers", async () => {
    const doc = await parse('name,address\nAda,"12 High St, London"\n');
    const source = normalizeFileSource({ kind: "text", text: "", name: "rows.csv" });
    render(<csvModule.Renderer document={doc} source={source} />);

    expect(screen.getByRole("columnheader", { name: "name" })).toBeInTheDocument();
    // One cell, not two — proof the quoted comma survived to the DOM.
    expect(screen.getByRole("cell", { name: "12 High St, London" })).toBeInTheDocument();
  });

  it("gives the grid an accessible summary", async () => {
    const doc = await parse("a,b\n1,2\n");
    const source = normalizeFileSource({ kind: "text", text: "", name: "rows.csv" });
    render(<csvModule.Renderer document={doc} source={source} />);
    expect(screen.getByRole("table", { name: /1 rows, 2 columns/ })).toBeInTheDocument();
  });

  it("announces truncation as a status, not an error", async () => {
    const rows = Array.from({ length: CSV_ROW_LIMIT + 1 }, () => "x,y").join("\n");
    const doc = await parse(`a,b\n${rows}\n`);
    const source = normalizeFileSource({ kind: "text", text: "", name: "rows.csv" });
    render(<csvModule.Renderer document={doc} source={source} />);

    expect(screen.getByRole("status")).toHaveTextContent(/Showing the first/);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    // Parsing and rendering CSV_ROW_LIMIT+1 rows is genuinely slow on a
    // 2-core CI runner — 7232ms observed against the 5000ms default. The cost
    // is the fixture, not a hang, so raise the margin rather than shrink the
    // fixture (the limit is what this test exists to cross).
  }, 15_000);
});

describe("csv renderer — highlighting", () => {
  const FILE = "region,revenue\nEMEA,4.2M\nAPAC,3.1M\n";

  const cite = (id: string, range: [number, number], active = false): ResolvedHighlight => ({
    id,
    source: "citation",
    status: "resolved",
    address: { kind: "range", start: range[0], end: range[1] },
    active,
    range,
  });

  /** Offsets of a passage in the document's own projection. */
  const rangeOf = (doc: CsvDocument, passage: string): [number, number] => {
    const start = doc.text?.indexOf(passage) ?? -1;
    expect(start).toBeGreaterThanOrEqual(0);
    return [start, start + passage.length];
  };

  const renderWith = async (
    pick: (doc: CsvDocument) => ResolvedHighlight[],
    activeHighlightId?: string,
  ) => {
    const doc = await parse(FILE);
    const source = normalizeFileSource({ kind: "text", text: "", name: "rows.csv" });
    return render(
      <csvModule.Renderer
        document={doc}
        source={source}
        highlights={pick(doc)}
        activeHighlightId={activeHighlightId}
      />,
    );
  };

  it("declares the address kinds it can actually honour", () => {
    expect(csvModule.manifest.capabilities?.highlight).toEqual(["quote", "range"]);
  });

  it("marks one cell, not the whole row it shares a span with", async () => {
    const { container } = await renderWith((doc) => [cite("a", rangeOf(doc, "4.2M"))]);
    const marks = Array.from(container.querySelectorAll("mark"));
    expect(marks).toHaveLength(1);
    expect(marks[0]?.closest("td")?.textContent).toBe("4.2M");
  });

  it("marks a header cell too — the header is part of the projection", async () => {
    const { container } = await renderWith((doc) => [cite("a", rangeOf(doc, "revenue"))]);
    expect(container.querySelector("mark")?.closest("th")?.textContent).toBe("revenue");
  });

  it("marks in both cells when a citation spans the separator", async () => {
    const { container } = await renderWith((doc) => [cite("a", rangeOf(doc, "EMEA\t4.2M"))]);
    const marks = Array.from(container.querySelectorAll("mark"));
    expect(marks.map((mark) => mark.textContent)).toEqual(["EMEA", "4.2M"]);
  });

  it("flags the current passage for assistive tech, not by colour alone", async () => {
    const { container } = await renderWith((doc) => [cite("a", rangeOf(doc, "3.1M"), true)], "a");
    const active = container.querySelector('mark[data-active][data-slot="match-highlight-mark"]');
    expect(active?.getAttribute("aria-current")).toBe("true");
    expect(active?.textContent).toBe("3.1M");
  });

  it("draws nothing when no highlight is passed", async () => {
    const { container } = await renderWith(() => []);
    expect(container.querySelectorAll("mark")).toHaveLength(0);
  });
});
