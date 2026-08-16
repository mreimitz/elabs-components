import { normalizeFileSource } from "@elabs/components-ui";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import type { ResolvedHighlight } from "../../core/highlight";
import { SAMPLE_XLSX_BASE64 } from "../office-fixture";
import xlsxModule, { type XlsxDocument } from "./xlsx-adapter";

const MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function fixtureSource(name = "quarter.xlsx") {
  const bytes = Uint8Array.from(atob(SAMPLE_XLSX_BASE64), (char) => char.charCodeAt(0));
  return normalizeFileSource({
    kind: "buffer",
    buffer: bytes.buffer as ArrayBuffer,
    name,
    mediaType: MEDIA_TYPE,
  });
}

const load = () => xlsxModule.create().load(fixtureSource(), {}) as Promise<XlsxDocument>;

describe("xlsx adapter — a real workbook through SheetJS", () => {
  it("reads every sheet, keeping the tab names the author gave them", async () => {
    const doc = await load();
    expect(doc.sheets.map((sheet) => sheet.name)).toEqual(["Revenue", "Headcount"]);
    expect(doc.pageCount).toBe(2);
  });

  it("takes the first row as headers and the rest as rows", async () => {
    const [revenue] = (await load()).sheets;
    expect(revenue?.columns).toEqual(["Region", "Revenue", "Closed"]);
    expect(revenue?.rows[0]?.slice(0, 2)).toEqual(["EMEA", "4200000"]);
    expect(revenue?.rows).toHaveLength(3);
  });

  it("shows a date as a date, not as Excel's serial day number", async () => {
    const [revenue] = (await load()).sheets;
    // Without `cellDates` this cell reads "46112", which means nothing to a reader.
    expect(revenue?.rows[0]?.[2]).toBe("2026-03-31");
  });

  it("does not claim truncation when every row fits", async () => {
    for (const sheet of (await load()).sheets) expect(sheet.totalRows).toBeUndefined();
  });

  it("projects the whole workbook to text so search and copy cross sheets", async () => {
    const doc = await load();
    expect(doc.text).toContain("Headcount");
    expect(doc.text).toContain("Engineering\t34");
  });

  it("reports a file that is not a workbook as parse-failed", async () => {
    const source = normalizeFileSource({
      kind: "text",
      text: "not a workbook",
      name: "broken.xlsx",
      mediaType: MEDIA_TYPE,
    });
    await expect(xlsxModule.create().load(source, {})).rejects.toMatchObject({
      code: "parse-failed",
    });
  });
});

describe("xlsx renderer", () => {
  it("renders a real table, and offers the sheets as tabs", async () => {
    const doc = await load();
    render(<xlsxModule.Renderer document={doc} source={fixtureSource()} />);

    expect(screen.getByRole("tablist", { name: "Sheets" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Region" })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "4200000" })).toBeInTheDocument();
  });

  it("switches sheets without reloading the file", async () => {
    const doc = await load();
    render(<xlsxModule.Renderer document={doc} source={fixtureSource()} />);

    await userEvent.click(screen.getByRole("tab", { name: "Headcount" }));
    expect(await screen.findByRole("columnheader", { name: "Team" })).toBeInTheDocument();
  });

  it("drops the tab strip for a single-sheet workbook — chrome that decides nothing", async () => {
    const doc = await load();
    const single: XlsxDocument = { ...doc, sheets: doc.sheets.slice(0, 1), pageCount: 1 };
    render(<xlsxModule.Renderer document={single} source={fixtureSource()} />);

    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
  });
});

describe("xlsx renderer — highlighting", () => {
  const cite = (id: string, range: [number, number], active = false): ResolvedHighlight => ({
    id,
    source: "citation",
    status: "resolved",
    address: { kind: "range", start: range[0], end: range[1] },
    active,
    range,
  });

  /** Offsets of a passage in the workbook's own projection. */
  const rangeOf = (doc: XlsxDocument, passage: string): [number, number] => {
    const start = doc.text?.indexOf(passage) ?? -1;
    expect(start).toBeGreaterThanOrEqual(0);
    return [start, start + passage.length];
  };

  const renderWith = async (
    pick: (doc: XlsxDocument) => ResolvedHighlight[],
    activeHighlightId?: string,
  ) => {
    const doc = await load();
    return render(
      <xlsxModule.Renderer
        document={doc}
        source={fixtureSource()}
        highlights={pick(doc)}
        activeHighlightId={activeHighlightId}
      />,
    );
  };

  it("declares the address kinds it can actually honour", () => {
    expect(xlsxModule.manifest.capabilities?.highlight).toEqual(["quote", "range"]);
  });

  it("marks one cell of the sheet on screen", async () => {
    const { container } = await renderWith((doc) => [cite("a", rangeOf(doc, "4200000"))]);
    const marks = Array.from(container.querySelectorAll("mark"));
    expect(marks).toHaveLength(1);
    expect(marks[0]?.closest("td")?.textContent).toBe("4200000");
  });

  it("turns to the cited SHEET, the way the PDF turns to the cited page", async () => {
    // "Engineering" is on Headcount, which is not the tab that opens.
    const { container } = await renderWith(
      (doc) => [cite("a", rangeOf(doc, "Engineering"), true)],
      "a",
    );
    expect(await screen.findByRole("columnheader", { name: "Team" })).toBeInTheDocument();
    expect(container.querySelector("mark")?.textContent).toBe("Engineering");
  });

  it("flags the current passage for assistive tech, not by colour alone", async () => {
    const { container } = await renderWith((doc) => [cite("a", rangeOf(doc, "EMEA"), true)], "a");
    const active = container.querySelector('mark[data-active][data-slot="match-highlight-mark"]');
    expect(active?.getAttribute("aria-current")).toBe("true");
    expect(active?.textContent).toBe("EMEA");
  });

  it("draws nothing when no highlight is passed", async () => {
    const { container } = await renderWith(() => []);
    expect(container.querySelectorAll("mark")).toHaveLength(0);
  });
});
