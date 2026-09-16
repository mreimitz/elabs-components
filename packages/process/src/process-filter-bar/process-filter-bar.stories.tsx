import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useMemo, useRef } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { generateSyntheticLog } from "../core/fixtures/synthetic-log";
import type { AbstractionOptions } from "../core/abstract-graph";
import type { FilterIntent } from "../use-process-explorer";
import { useProcessExplorer } from "../use-process-explorer";
import { ProcessFilterBar } from "./process-filter-bar";

const log = generateSyntheticLog({ cases: 300, seed: 7 });

const SINGLE_INTENT: FilterIntent[] = [{ kind: "with", activity: "Reject Order" }];

const CHAIN_INTENTS: FilterIntent[] = [
  { kind: "without", activity: "Cancel Order" },
  { kind: "with", activity: "Amend Order" },
  { kind: "endsWith", activity: "Receive Payment" },
];

/**
 * Real `useProcessExplorer` state, seeded once with `initialIntents` — this is the same
 * hook `ProcessFilterBar` is meant to sit beside (RM-056, #205), so every number the bar
 * renders (per-chip excluded counts, the filtered/total split, hidden-by-abstraction) is
 * the hook's own live output, not a hand-typed stand-in.
 */
function ProcessFilterBarDemo({
  initialIntents = [],
  abstraction,
}: {
  initialIntents?: FilterIntent[];
  abstraction?: Partial<AbstractionOptions>;
}) {
  const explorer = useProcessExplorer(log, { abstraction });
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    for (const intent of initialIntents) explorer.applyIntent(intent);
  }, [explorer, initialIntents]);

  const totalCases = useMemo(() => new Set(log.events.map((event) => event.caseId)).size, []);

  return (
    <div className="max-w-2xl">
      <ProcessFilterBar
        intents={explorer.intents}
        excludedByIntent={explorer.excludedByIntent}
        totalCases={totalCases}
        filteredCases={explorer.kpis.cases}
        hiddenCounts={explorer.hiddenCounts}
        onRemove={explorer.clearIntent}
        onClearAll={() => {
          for (let index = explorer.intents.length - 1; index >= 0; index -= 1) {
            explorer.clearIntent(index);
          }
        }}
      />
    </div>
  );
}

const meta = {
  title: "Process/ProcessFilterBar",
  component: ProcessFilterBar,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Filter chain breadcrumbs (§4 R13): one removable chip per active " +
          "`useProcessExplorer` intent, each carrying how many cases that intent ALONE " +
          "excludes (`excludedByIntent`, the hook's own additive field), plus a summary " +
          "line stating what filtering and abstraction currently hide. Composes " +
          "`@elabs-ai/components-data`'s `FilterBar`/`FilterChip` — no chip markup of its " +
          "own (`pnpm check --rule process-reuse`).",
      },
    },
  },
} satisfies Meta<typeof ProcessFilterBar>;
export default meta;
type Story = StoryObj<typeof meta>;

/** One active intent — the simplest non-empty chain. */
export const SingleFilter: Story = {
  render: () => <ProcessFilterBarDemo initialIntents={SINGLE_INTENT} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() =>
      expect(canvas.getByRole("button", { name: /Contains Reject Order/ })).toBeInTheDocument(),
    );
  },
};

/**
 * A three-intent chain — the breadcrumb reading this component exists for. Each chip's
 * "excluded N" is the MARGINAL count that one intent removes on top of the ones before it,
 * never the whole chain's total.
 */
export const FilterChain: Story = {
  render: () => <ProcessFilterBarDemo initialIntents={CHAIN_INTENTS} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => expect(canvas.getAllByRole("button").length).toBeGreaterThan(1));

    // Removing the middle chip by CLICK drops it, and only it.
    const beforeCount = canvas.getAllByRole("button", { name: /^Remove filter:/ }).length;
    await userEvent.click(canvas.getByRole("button", { name: /Contains Amend Order/ }));
    await waitFor(() =>
      expect(canvas.getAllByRole("button", { name: /^Remove filter:/ }).length).toBe(
        beforeCount - 1,
      ),
    );
    expect(canvas.queryByRole("button", { name: /Contains Amend Order/ })).not.toBeInTheDocument();

    // Keyboard: Tab lands on a chip (a real <button>), Enter removes it — no new
    // interaction pattern, the same contract `FilterChip` already ships.
    const remaining = canvas.getByRole("button", { name: /Excludes Cancel Order/ });
    remaining.focus();
    await userEvent.keyboard("{Enter}");
    await waitFor(() =>
      expect(canvas.getAllByRole("button", { name: /^Remove filter:/ }).length).toBe(
        beforeCount - 2,
      ),
    );
  },
};

/** The chain plus a busy abstraction — the summary line states both clauses at once. */
export const WithAbstractionHidden: Story = {
  render: () => (
    <ProcessFilterBarDemo
      initialIntents={CHAIN_INTENTS}
      abstraction={{ activities: 0.4, paths: 0.4 }}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() =>
      expect(canvas.getByText(/activit(?:y|ies) hidden by abstraction/)).toBeInTheDocument(),
    );
  },
};

/**
 * No active intents: the chip row and its "Clear all" action render nothing at all — the
 * summary line is the only thing left, and it reads as "showing everything".
 */
export const Empty: Story = {
  render: () => <ProcessFilterBarDemo />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.queryByRole("group")).not.toBeInTheDocument();
    expect(canvas.queryByRole("button")).not.toBeInTheDocument();
    await waitFor(() => expect(canvas.getByText(/^Showing all /)).toBeInTheDocument());
  },
};
