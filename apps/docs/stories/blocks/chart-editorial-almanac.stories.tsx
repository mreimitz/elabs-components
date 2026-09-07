import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, within } from "storybook/test";
import { ChartEditorialAlmanac } from "@/components/chart-editorial-almanac/chart-editorial-almanac";
import { ACTIVITY_MATRIX } from "@/components/chart-editorial-almanac/data/activity-matrix";

const meta = {
  title: "Patterns/Blocks/Chart Editorial — Bubble Almanac",
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "A category × category matrix drawn as hand-irregular blob bubbles on ruled ledger paper, with a margin note calling out the busiest cell (PeakRing + Marginalia). Adapted from lieflat-charts' 'L9 Bubble Almanac'. Copy-own it: `npx shadcn add chart-editorial-almanac`.",
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <ChartEditorialAlmanac />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await canvas.findByRole("figure");

    // One rendered blob per non-zero cell in the source data.
    const nonZero = ACTIVITY_MATRIX.filter((cell) => cell.value > 0);
    const blobs = Array.from(
      canvasElement.querySelectorAll<SVGPathElement>('[data-slot="chart-editorial-almanac-blob"]'),
    );
    await expect(blobs).toHaveLength(nonZero.length);

    // The blob whose data-value matches the true dataset max carries the
    // largest data-radius among all rendered blobs — a property check, not
    // a restated formula (radiusFor is never called from the test).
    const trueMax = Math.max(...nonZero.map((cell) => cell.value));
    const radii = blobs.map((blob) => Number(blob.getAttribute("data-radius")));
    const maxRadius = Math.max(...radii);
    const peakBlob = blobs.find((blob) => Number(blob.getAttribute("data-value")) === trueMax);
    await expect(peakBlob).toBeDefined();
    await expect(Number(peakBlob?.getAttribute("data-radius"))).toBe(maxRadius);

    // Exactly one margin note, naming the true peak value.
    const notes = canvasElement.querySelectorAll('[data-slot="marginalia"]');
    await expect(notes).toHaveLength(1);
    await expect(notes[0]?.textContent).toContain(String(trueMax));

    // #294 — every value a blob encodes must also be reachable as text, with its
    // row and column identifiable. Derive the expectation from the DOM, not a
    // literal, so it cannot pass on a stale or partial table.
    const table = canvasElement.querySelector("table");
    await expect(table).not.toBeNull();
    // Header cells, so a screen reader can announce "Support, W2, 47".
    const columnCount = new Set(ACTIVITY_MATRIX.map((cell) => cell.x)).size;
    const rowCount = new Set(ACTIVITY_MATRIX.map((cell) => cell.y)).size;
    await expect(table!.querySelectorAll('th[scope="col"]').length).toBe(columnCount + 1);
    await expect(table!.querySelectorAll('th[scope="row"]').length).toBe(rowCount);

    // Each value must sit at its OWN row/column intersection — not merely
    // appear somewhere in the table. A transposed x/y comparison or two
    // swapped cells must fail this, unlike a check against a flattened set
    // of values (review finding #409/3).
    const columnLabels = Array.from(table!.querySelectorAll('thead th[scope="col"]'))
      .slice(1) // drop the "Row" corner header
      .map((th) => th.textContent?.trim());
    const bodyRows = Array.from(table!.querySelectorAll("tbody tr"));
    await expect(bodyRows).toHaveLength(rowCount);
    for (const row of bodyRows) {
      const rowLabel = row.querySelector('th[scope="row"]')?.textContent?.trim();
      const cells = Array.from(row.querySelectorAll("td"));
      await expect(cells).toHaveLength(columnLabels.length);
      for (let i = 0; i < cells.length; i += 1) {
        const td = cells[i];
        const colLabel = columnLabels[i];
        const expected = ACTIVITY_MATRIX.find((cell) => cell.x === colLabel && cell.y === rowLabel);
        await expect(td?.textContent?.trim()).toBe(expected ? String(expected.value) : "");
      }
    }

    // The row/column digest is announced exactly once — as the table's
    // caption, not also as a duplicate standalone sr-only summary (review
    // finding #409/4).
    const peakCell = ACTIVITY_MATRIX.reduce<(typeof ACTIVITY_MATRIX)[number] | undefined>(
      (best, cell) => (!best || cell.value > best.value ? cell : best),
      undefined,
    );
    const expectedSummary = `${rowCount} rows, ${columnCount} columns. Busiest: ${peakCell?.y ?? ""} in ${peakCell?.x ?? ""} at ${peakCell?.value ?? 0}.`;
    const summaryNodes = Array.from(canvasElement.querySelectorAll<HTMLElement>("*")).filter(
      (el) => el.textContent?.trim() === expectedSummary,
    );
    await expect(summaryNodes).toHaveLength(1);
    await expect(summaryNodes[0]?.tagName.toLowerCase()).toBe("caption");

    // The digest stays the region's name — this fix must not lengthen it.
    const figure = await canvas.findByRole("figure");
    await expect(figure).toHaveAccessibleName("Weekly ticket volume by team");

    // The table is sr-only, not interactive: no new focusable element enters
    // the page from this fix.
    await expect(canvasElement.querySelectorAll("button")).toHaveLength(0);
  },
};
