import type { Meta, StoryObj } from "@storybook/react-vite";
import { useCallback, useMemo, useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { activityColorScale } from "../core/activity-color-scale";
import { discoverGraph } from "../core/discover-graph";
import { extractVariants } from "../core/extract-variants";
import { generateBpi2012Subset } from "../core/fixtures/generate-bpi-2012-subset";
import { generateSyntheticLog } from "../core/fixtures/synthetic-log";
import type { Variant } from "../core/types";
import {
  VariantExplorer,
  type VariantExplorerProps,
  type VariantSelectMode,
} from "./variant-explorer";

const log = generateSyntheticLog({ cases: 400, seed: 42 });
const graph = discoverGraph(log);
const variants = extractVariants(log);
const colorScale = activityColorScale(graph);

const loanLog = generateBpi2012Subset({ cases: 300, seed: 3 });
const loanVariants = extractVariants(loanLog);
const loanColorScale = activityColorScale(discoverGraph(loanLog));

/** 2 000 synthetic variants — the virtualization acceptance size. */
const manyVariants: Variant[] = (() => {
  const total = 2000;
  const cases = (total * (total + 1)) / 2;
  let cumulative = 0;
  return Array.from({ length: total }, (_, i) => {
    const base = variants[i % variants.length]!;
    const count = total - i;
    cumulative += count;
    return {
      ...base,
      id: `${base.id}-${i}`,
      count,
      share: count / cases,
      cumulativeShare: cumulative / cases,
    };
  });
})();

/** Owns the selection a playbook would own, so the stories are interactive. */
function Stateful(
  props: Omit<VariantExplorerProps, "onSelect" | "selectionStates"> & {
    initialSelected?: string[];
  },
) {
  const { initialSelected = [], ...rest } = props;
  const [selected, setSelected] = useState<string[]>(initialSelected);
  const onSelect = useCallback((ids: string[], mode: VariantSelectMode) => {
    setSelected((current) => {
      if (mode === "replace") return ids;
      const next = new Set(current);
      for (const id of ids) {
        if (next.has(id)) next.delete(id);
        else next.add(id);
      }
      return [...next];
    });
  }, []);
  const selectionStates = useMemo(
    () => ({ variants: Object.fromEntries(selected.map((id) => [id, "selected" as const])) }),
    [selected],
  );
  return <VariantExplorer {...rest} selectionStates={selectionStates} onSelect={onSelect} />;
}

const meta = {
  title: "Process/VariantExplorer",
  component: VariantExplorer,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "The ranked list of activity sequences in an event log. Each row shows the sequence as " +
          "colour-keyed chips (the same colours `ProcessMap` paints when it gets the same " +
          "`colorScale`), the number of cases, the share of cases covered and the median " +
          "duration. It only emits `onSelect` — a playbook turns that into a variant filter. " +
          "Rows are virtualized; the checkboxes form one roving tab stop (arrows, Page Up/Down, " +
          "Home/End move; Space and Enter toggle).",
      },
    },
  },
  args: {
    variants,
    colorScale,
    onSelect: () => {},
  },
  render: (args) => (
    <div className="w-full max-w-4xl">
      <Stateful {...args} />
    </div>
  ),
} satisfies Meta<typeof VariantExplorer>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The ten most frequent paths with every column. */
export const TopTen: Story = {
  args: { variants: variants.slice(0, 10) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const rows = canvasElement.querySelectorAll('[data-slot="variant-explorer-row"]');
    await expect(rows.length).toBe(10);
    // Row click toggles the variant.
    const firstSequence = within(rows[0] as HTMLElement).getByRole("img");
    await userEvent.click(firstSequence);
    await waitFor(() => expect(canvas.getAllByRole("checkbox")[0]).toBeChecked());
  },
};

/**
 * "Variant DNA": two-letter chips so long sequences fit; full names stay in the accessible
 * name. A loan-application log with more than eleven activities, so the rarer activities
 * share the hatched "other" swatch.
 */
export const DnaStrip: Story = {
  args: { variants: loanVariants, colorScale: loanColorScale, abbreviate: true },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[data-pattern="other"]')).not.toBeNull();
  },
};

/** The coverage slider selects the fewest paths that cover the target share of cases. */
export const CoverageSlider: Story = {
  args: { coverageTarget: 0.8, onFilterIntent: () => {} },
};

/** Two variants already selected; keyboard selection with arrows and Space. */
export const WithSelection: Story = {
  render: (args) => (
    <div className="w-full max-w-4xl">
      <Stateful {...args} initialSelected={[variants[0]!.id, variants[2]!.id]} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const boxes = canvas.getAllByRole("checkbox");
    await expect(boxes[0]).toBeChecked();
    await expect(boxes[2]).toBeChecked();

    boxes[0]!.focus();
    await userEvent.keyboard("{ArrowDown}");
    const second = canvasElement.querySelector<HTMLElement>(
      '[data-index="1"] [data-slot="checkbox"]',
    );
    await waitFor(() => expect(second).toHaveFocus());
    await userEvent.keyboard(" ");
    await waitFor(() => expect(second).toBeChecked());
  },
};

/** The accessible table twin — the same numbers as the list, as a real table. */
export const TableView: Story = {
  args: { variants: variants.slice(0, 12), tableView: true },
};

/** Waiting for variants. */
export const Loading: Story = {
  args: { variants: [], loading: true },
};

/** A filter left no cases. */
export const Empty: Story = {
  args: { variants: [] },
};

/**
 * 2 000 variants. The play test scrolls the list and asserts the number of mounted rows
 * stays bounded — the virtualization that keeps scrolling smooth. It does not time frames,
 * which is too noisy to gate CI on.
 */
export const TwoThousandVariants: Story = {
  args: { variants: manyVariants, abbreviate: true },
  play: async ({ canvasElement }) => {
    const rows = () => canvasElement.querySelectorAll('[data-slot="variant-explorer-row"]').length;
    await waitFor(() => expect(rows()).toBeGreaterThan(0));
    const initial = rows();
    await expect(initial).toBeLessThan(60);

    const viewport = canvasElement.querySelector<HTMLElement>(
      '[data-slot="variant-explorer-viewport"]',
    )!;
    for (const top of [8_000, 40_000, 79_000]) {
      viewport.scrollTop = top;
      await waitFor(() =>
        expect(
          canvasElement.querySelector(`[data-index="${Math.floor(top / 40) + 1}"]`),
        ).not.toBeNull(),
      );
      await expect(rows()).toBeLessThan(60);
    }
  },
};

/** Decoration dial at 10 — chips and bars are marks inside a control-like row, so they stay put. */
export const HighDecoration: Story = {
  tags: ["!dev"],
  globals: { decoration: "10" },
  args: { variants: variants.slice(0, 10), coverageTarget: 0.5 },
};
