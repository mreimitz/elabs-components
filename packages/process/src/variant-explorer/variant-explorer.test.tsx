import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { activityColorScale } from "../core/activity-color-scale";
import { discoverGraph } from "../core/discover-graph";
import { extractVariants } from "../core/extract-variants";
import { generateSyntheticLog } from "../core/fixtures/synthetic-log";
import type { Variant } from "../core/types";
import { ProcessMap } from "../process-map/process-map";
import { VariantExplorer } from "./variant-explorer";
import { selectVariantsByCoverage } from "./variant-explorer-model";

// React Flow's transform math needs these under jsdom — see `process-map.test.tsx`.
if (typeof globalThis.DOMMatrixReadOnly === "undefined") {
  class DOMMatrixReadOnlyPolyfill {
    m22 = 1;
    constructor(_init?: unknown) {}
  }
  globalThis.DOMMatrixReadOnly = DOMMatrixReadOnlyPolyfill as unknown as typeof DOMMatrixReadOnly;
}
if (typeof globalThis.DOMMatrix === "undefined") {
  globalThis.DOMMatrix = globalThis.DOMMatrixReadOnly as unknown as typeof DOMMatrix;
}

// jsdom has no layout, so the virtualizer would see a 0px viewport. Give the explorer's
// viewport a real height; everything else keeps jsdom's zero box.
const VIEWPORT_HEIGHT = 400;
// `@tanstack/virtual-core` reads the scroll element's `offsetWidth`/`offsetHeight`.
const originalOffsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetHeight");
const originalOffsetWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetWidth");
const isViewport = (el: HTMLElement) => el.dataset?.slot === "variant-explorer-viewport";
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
    configurable: true,
    get(this: HTMLElement) {
      return isViewport(this) ? VIEWPORT_HEIGHT : 0;
    },
  });
  Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
    configurable: true,
    get(this: HTMLElement) {
      return isViewport(this) ? 800 : 0;
    },
  });
});
afterAll(() => {
  if (originalOffsetHeight)
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", originalOffsetHeight);
  if (originalOffsetWidth)
    Object.defineProperty(HTMLElement.prototype, "offsetWidth", originalOffsetWidth);
});
afterEach(cleanup);

const log = generateSyntheticLog({ cases: 120, seed: 5 });
const graph = discoverGraph(log);
const variants = extractVariants(log);
const scale = activityColorScale(graph);

function manyVariants(count: number): Variant[] {
  const base = variants[0]!;
  return Array.from({ length: count }, (_, i) => ({
    ...base,
    id: `v-${i}`,
    count: count - i,
    share: 1 / count,
    cumulativeShare: (i + 1) / count,
  }));
}

describe("selectVariantsByCoverage", () => {
  it("selects the smallest prefix whose cumulative share reaches the target", () => {
    const ids = selectVariantsByCoverage(variants, 0.5);
    const lastIndex = ids.length - 1;
    expect(variants[lastIndex]!.cumulativeShare).toBeGreaterThanOrEqual(0.5);
    if (lastIndex > 0) expect(variants[lastIndex - 1]!.cumulativeShare).toBeLessThan(0.5);
    expect(ids).toEqual(variants.slice(0, ids.length).map((v) => v.id));
  });

  it("is deterministic — same target, same id list", () => {
    expect(selectVariantsByCoverage(variants, 0.8)).toEqual(
      selectVariantsByCoverage(variants, 0.8),
    );
  });

  it("selects nothing at 0 and everything at 1", () => {
    expect(selectVariantsByCoverage(variants, 0)).toEqual([]);
    expect(selectVariantsByCoverage(variants, 1)).toHaveLength(variants.length);
  });
});

describe("VariantExplorer — rows", () => {
  it("names each row with its rank, activity count, cases and coverage", () => {
    render(<VariantExplorer variants={variants} colorScale={scale} onSelect={() => {}} />);
    const first = variants[0]!;
    const checkbox = screen.getAllByRole("checkbox")[0]!;
    expect(checkbox).toHaveAccessibleName(
      `Variant 1, ${first.sequence.length} activities, ${first.count} cases, ${Math.round(first.share * 100)} percent coverage`,
    );
  });

  it("prints activity labels on chips, and two-letter codes in the DNA strip", () => {
    const { rerender } = render(
      <VariantExplorer variants={variants} colorScale={scale} onSelect={() => {}} />,
    );
    const firstRow = document.querySelector('[data-slot="variant-explorer-row"]')!;
    const firstActivity = variants[0]!.sequence[0]!;
    const chip = firstRow.querySelector('[data-slot="variant-explorer-chip"]')!;
    expect(chip).toHaveTextContent(scale.labelFor(firstActivity));

    rerender(
      <VariantExplorer variants={variants} colorScale={scale} onSelect={() => {}} abbreviate />,
    );
    const abbreviated = document
      .querySelector('[data-slot="variant-explorer-row"]')!
      .querySelector('[data-slot="variant-explorer-chip"]')!;
    expect(abbreviated).toHaveTextContent(scale.codeFor(firstActivity));
    // The strip's accessible name still carries full labels, never the codes.
    expect(document.querySelector('[data-slot="variant-explorer-sequence"]')).toHaveAccessibleName(
      expect.stringContaining(scale.labelFor(firstActivity)),
    );
  });

  it("reflects selectionStates.variants on the checkbox and the row", () => {
    const id = variants[0]!.id;
    render(
      <VariantExplorer
        variants={variants}
        colorScale={scale}
        selectionStates={{ variants: { [id]: "selected" } }}
        onSelect={() => {}}
      />,
    );
    const row = document.querySelector(`[data-variant="${id}"]`)!;
    expect(row).toHaveAttribute("data-selection", "selected");
    expect(within(row as HTMLElement).getByRole("checkbox")).toBeChecked();
  });

  it("shows a loading panel and a real empty state", () => {
    const { rerender } = render(
      <VariantExplorer variants={[]} colorScale={scale} onSelect={() => {}} loading />,
    );
    expect(screen.getByRole("status")).toBeInTheDocument();
    rerender(<VariantExplorer variants={[]} colorScale={scale} onSelect={() => {}} />);
    expect(screen.getByText("No variants")).toBeInTheDocument();
  });

  it("renders the table twin with one row per variant", () => {
    render(
      <VariantExplorer variants={variants} colorScale={scale} onSelect={() => {}} tableView />,
    );
    // header row + one per variant
    expect(screen.getAllByRole("row")).toHaveLength(variants.length + 1);
  });
});

describe("VariantExplorer — selection", () => {
  it("toggles a variant on row click", async () => {
    const onSelect = vi.fn();
    render(<VariantExplorer variants={variants} colorScale={scale} onSelect={onSelect} />);
    const row = document.querySelector('[data-slot="variant-explorer-row"]') as HTMLElement;
    await userEvent.click(within(row).getByRole("img"));
    expect(onSelect).toHaveBeenCalledWith([variants[0]!.id], "toggle");
  });

  it("moves focus with arrow keys and toggles with Space and Enter", async () => {
    const onSelect = vi.fn();
    render(<VariantExplorer variants={variants} colorScale={scale} onSelect={onSelect} />);
    const user = userEvent.setup();
    await user.tab();
    const first = screen.getAllByRole("checkbox")[0]!;
    expect(first).toHaveFocus();

    await user.keyboard("{ArrowDown}");
    const second = document.querySelector('[data-index="1"] [data-slot="checkbox"]');
    await waitFor(() => expect(second).toHaveFocus());

    await user.keyboard(" ");
    expect(onSelect).toHaveBeenLastCalledWith([variants[1]!.id], "toggle");

    await user.keyboard("{Enter}");
    expect(onSelect).toHaveBeenLastCalledWith([variants[1]!.id], "toggle");
    expect(onSelect).toHaveBeenCalledTimes(2);
  });

  it("emits a variant filter intent for the selected ids", async () => {
    const onFilterIntent = vi.fn();
    const ids = [variants[0]!.id, variants[2]!.id];
    render(
      <VariantExplorer
        variants={variants}
        colorScale={scale}
        selectionStates={{ variants: Object.fromEntries(ids.map((id) => [id, "selected"])) }}
        onSelect={() => {}}
        onFilterIntent={onFilterIntent}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Show only selected variants" }));
    expect(onFilterIntent).toHaveBeenCalledWith({ kind: "variant", ids });
  });

  it("selects the coverage prefix with mode replace when the slider commits", async () => {
    const onSelect = vi.fn();
    render(
      <VariantExplorer
        variants={variants}
        colorScale={scale}
        onSelect={onSelect}
        coverageTarget={0.5}
      />,
    );
    const thumb = screen.getByRole("slider", { name: "Coverage target" });
    act(() => thumb.focus());
    fireEvent.keyDown(thumb, { key: "ArrowRight" });
    expect(onSelect).toHaveBeenLastCalledWith(selectVariantsByCoverage(variants, 0.51), "replace");
  });
});

describe("VariantExplorer — virtualization (2 000 variants)", () => {
  it("mounts a bounded window of rows, and still a bounded window after scrolling", async () => {
    const big = manyVariants(2000);
    render(<VariantExplorer variants={big} colorScale={scale} onSelect={() => {}} />);
    const rowCount = () => document.querySelectorAll('[data-slot="variant-explorer-row"]').length;
    const bound = Math.ceil(VIEWPORT_HEIGHT / 40) + 2 * 6 + 2;
    await waitFor(() => expect(rowCount()).toBeGreaterThan(0));
    expect(rowCount()).toBeLessThanOrEqual(bound);

    const viewport = document.querySelector<HTMLElement>(
      '[data-slot="variant-explorer-viewport"]',
    )!;
    act(() => {
      viewport.scrollTop = 40 * 1500;
      fireEvent.scroll(viewport);
    });
    await waitFor(() => expect(document.querySelector('[data-index="1500"]')).toBeInTheDocument());
    expect(rowCount()).toBeLessThanOrEqual(bound);
    expect(document.querySelector('[data-index="0"]')).not.toBeInTheDocument();
    // The roving tab stop follows the window, so Tab can still reach the list.
    expect(document.querySelectorAll('[data-slot="checkbox"][tabindex="0"]')).toHaveLength(1);
  });
});

describe("VariantExplorer + ProcessMap — one colour per activity", () => {
  it("paints every shared activity's chip exactly like its map node accent", async () => {
    render(
      <>
        <ProcessMap
          graph={graph}
          metric={{ node: "absolute_case", edge: "absolute" }}
          colorScale={scale}
        />
        <VariantExplorer variants={variants} colorScale={scale} onSelect={() => {}} />
      </>,
    );

    await waitFor(() =>
      expect(document.querySelectorAll('[data-slot="process-activity-node-accent"]').length).toBe(
        graph.activities.length,
      ),
    );

    const chips = document.querySelectorAll<HTMLElement>('[data-slot="variant-explorer-chip"]');
    expect(chips.length).toBeGreaterThan(0);
    const checked = new Set<string>();
    for (const chip of chips) {
      const activity = chip.dataset.activity!;
      const node = document.querySelector(`.react-flow__node[data-id="${CSS.escape(activity)}"]`);
      expect(node).toBeTruthy();
      const accent = node!.querySelector<HTMLElement>(
        '[data-slot="process-activity-node-accent"]',
      )!;
      const swatch = chip.querySelector<HTMLElement>('[data-slot="variant-explorer-chip-swatch"]')!;
      expect(swatch.dataset.colorToken).toBe(accent.dataset.colorToken);
      expect(swatch.dataset.colorToken).toBe(scale.colorFor(activity).token);
      // Guard against a vacuous pass: jsdom must have kept the token-backed fill.
      expect(swatch.style.backgroundColor).toContain(`var(${scale.colorFor(activity).token})`);
      expect(swatch.style.backgroundColor).toBe(accent.style.backgroundColor);
      expect(swatch.style.backgroundImage).toBe(accent.style.backgroundImage);
      checked.add(activity);
    }
    expect(checked.size).toBeGreaterThan(1);
  });
});
