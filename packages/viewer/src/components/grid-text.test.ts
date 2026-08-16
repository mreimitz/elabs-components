import { describe, expect, it } from "vitest";

import { chunkOffset } from "../core/text-index";
import { GRID_CELL_SEPARATOR, GRID_HEAD_ROW, GRID_NAME_ROW, gridToText } from "./grid-text";

/** `[the text this span covers, what it points at]` — the pair every test reads. */
const mapped = ({ text, spans }: ReturnType<typeof gridToText>) =>
  spans.map((span) => [text.slice(span.start, span.end), span.ref]);

describe("gridToText", () => {
  it("projects one nameless sheet as a header row and body rows", () => {
    const index = gridToText([{ columns: ["Region", "Revenue"], rows: [["EMEA", "4.2M"]] }]);

    expect(index.text).toBe("Region\tRevenue\nEMEA\t4.2M");
    expect(mapped(index)).toEqual([
      ["Region\tRevenue", { sheet: 0, row: GRID_HEAD_ROW }],
      ["EMEA\t4.2M", { sheet: 0, row: 0 }],
    ]);
  });

  it("separates sheets with a blank line and names each one", () => {
    const index = gridToText([
      { name: "Q3", columns: ["a"], rows: [["1"]] },
      { name: "Q4", columns: ["b"], rows: [["2"]] },
    ]);

    expect(index.text).toBe("Q3\na\n1\n\nQ4\nb\n2");
    expect(mapped(index)).toEqual([
      ["Q3", { sheet: 0, row: GRID_NAME_ROW }],
      ["a", { sheet: 0, row: GRID_HEAD_ROW }],
      ["1", { sheet: 0, row: 0 }],
      ["Q4", { sheet: 1, row: GRID_NAME_ROW }],
      ["b", { sheet: 1, row: GRID_HEAD_ROW }],
      ["2", { sheet: 1, row: 0 }],
    ]);
  });

  it("puts the blank line before whatever the next sheet's FIRST line is", () => {
    // The second sheet has no name, so the separator lands on its header.
    const index = gridToText([
      { columns: ["a"], rows: [] },
      { columns: ["b"], rows: [] },
    ]);
    expect(index.text).toBe("a\n\nb");
  });

  it("skips a sheet with nothing in it rather than shifting every offset after it", () => {
    const index = gridToText([
      { columns: ["a"], rows: [] },
      { columns: [], rows: [] },
      { columns: ["b"], rows: [] },
    ]);
    expect(index.text).toBe("a\n\nb");
    expect(index.spans.map((span) => span.ref.sheet)).toEqual([0, 2]);
  });

  it("keeps an empty cell in its row, so the cells after it stay put", () => {
    const index = gridToText([{ columns: ["a", "b", "c"], rows: [["1", "", "3"]] }]);
    const row = index.spans[1];

    expect(index.text.slice(row?.start, row?.end)).toBe("1\t\t3");
    // The third cell is where the projection says it is — an empty cell is a
    // separator, not a hole (this is why rows, not cells, are the finest ref).
    expect(chunkOffset(["1", "", "3"], 2, row?.start, GRID_CELL_SEPARATOR)).toBe(
      index.text.indexOf("3"),
    );
  });
});
