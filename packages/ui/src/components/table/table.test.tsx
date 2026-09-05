import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Table, TableBody, TableCell, TableRow } from "./table";

describe("Table", () => {
  it("renders cells", () => {
    render(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell>Alpha</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    expect(screen.getByText("Alpha")).toBeInTheDocument();
  });
});

/**
 * jsdom reports 0 for every layout metric, so overflow has to be simulated —
 * same idiom as `packages/data/src/data-table/data-table.test.tsx`. Metrics
 * are (re-)applied and the component's own `onScroll` handler is fired so the
 * re-measurement runs through the real code path, not by poking at state.
 */
function setScrollMetrics(
  el: HTMLElement,
  { scrollWidth, clientWidth, scrollHeight, clientHeight }: Record<string, number>,
) {
  Object.defineProperty(el, "scrollWidth", { configurable: true, value: scrollWidth });
  Object.defineProperty(el, "clientWidth", { configurable: true, value: clientWidth });
  Object.defineProperty(el, "scrollHeight", { configurable: true, value: scrollHeight });
  Object.defineProperty(el, "clientHeight", { configurable: true, value: clientHeight });
  fireEvent.scroll(el);
}

function scrollRegionOf(container: HTMLElement): HTMLElement {
  const el = container.querySelector<HTMLElement>('[data-slot="table-scroll-region"]');
  if (!el) throw new Error('no [data-slot="table-scroll-region"] in the rendered output');
  return el;
}

describe("Table — #366 the scroll wrapper's tab stop exists only while it measurably overflows", () => {
  it("adds NO tab stop and NO accessible name to a table that fits its container", () => {
    const { container } = render(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell>Alpha</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    const scrollRegion = scrollRegionOf(container);
    setScrollMetrics(scrollRegion, {
      scrollWidth: 300,
      clientWidth: 300,
      scrollHeight: 100,
      clientHeight: 100,
    });
    // A table that doesn't scroll must not gain a focus stop that does
    // nothing, nor announce itself as "scrollable" — axe's
    // `scrollable-region-focusable` only fires the other way round, so this
    // is the locking assertion for it.
    expect(scrollRegion).not.toHaveAttribute("tabindex");
    expect(scrollRegion).not.toHaveAttribute("aria-label");
    expect(screen.queryByLabelText("Table contents, scrollable")).toBeNull();
  });

  it("gains the tab stop + accessible name once the region measurably overflows vertically", () => {
    const { container } = render(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell>Alpha</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    const scrollRegion = scrollRegionOf(container);
    setScrollMetrics(scrollRegion, {
      scrollWidth: 300,
      clientWidth: 300,
      scrollHeight: 800,
      clientHeight: 200,
    });
    expect(scrollRegion).toHaveAttribute("tabindex", "0");
    expect(screen.getByLabelText("Table contents, scrollable")).toBe(scrollRegion);
  });

  it("gains the tab stop + accessible name once the region measurably overflows horizontally", () => {
    const { container } = render(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell>Alpha</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    const scrollRegion = scrollRegionOf(container);
    setScrollMetrics(scrollRegion, {
      scrollWidth: 900,
      clientWidth: 300,
      scrollHeight: 100,
      clientHeight: 100,
    });
    expect(scrollRegion).toHaveAttribute("tabindex", "0");
    expect(screen.getByLabelText("Table contents, scrollable")).toBe(scrollRegion);
  });

  it("drops the tab stop again when the overflow goes away (e.g. the container grows)", () => {
    const { container } = render(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell>Alpha</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    const scrollRegion = scrollRegionOf(container);
    setScrollMetrics(scrollRegion, {
      scrollWidth: 300,
      clientWidth: 300,
      scrollHeight: 800,
      clientHeight: 200,
    });
    expect(scrollRegion).toHaveAttribute("tabindex", "0");
    setScrollMetrics(scrollRegion, {
      scrollWidth: 300,
      clientWidth: 300,
      scrollHeight: 800,
      clientHeight: 900,
    });
    expect(scrollRegion).not.toHaveAttribute("tabindex");
  });

  it('never adds a redundant role="region" landmark', () => {
    const { container } = render(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell>Alpha</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    const scrollRegion = scrollRegionOf(container);
    setScrollMetrics(scrollRegion, {
      scrollWidth: 300,
      clientWidth: 300,
      scrollHeight: 800,
      clientHeight: 200,
    });
    expect(scrollRegion).not.toHaveAttribute("role");
  });
});
