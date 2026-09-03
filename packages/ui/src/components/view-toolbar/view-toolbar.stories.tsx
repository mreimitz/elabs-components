import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Download, Plus, SlidersHorizontal } from "lucide-react";
import { expect, userEvent, waitFor } from "storybook/test";
import { FilterChip, ResultCount, ViewToolbar, ViewToolbarFilters } from "./view-toolbar";
import { Button } from "../button";
import { StatePanel } from "../state-panel";
import { StatusBadge } from "../status-badge";

const meta = {
  title: "Layout/ViewToolbar",
  component: ViewToolbar,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "The row above a list, table or board — filters and context on the left, actions on the right. Its controls are ordinary tab stops on purpose: a dense secondary control row that should cost ONE tab stop with arrow-key roving is `Layout/Toolbar`, the component that actually claims the `toolbar` ARIA role. See [Choosing between similar components](?path=/docs/docs-choosing-between-similar-components--docs) and [Docs / View Toolbar Contract](?path=/docs/docs-view-toolbar-contract--docs) (rule R10) for the filter-chip, result-count and control-height rules of this row.",
      },
    },
  },
  argTypes: {
    info: {
      description: "What this view is — shown in a tooltip on the ⓘ trigger.",
      control: "text",
      table: { category: "Content" },
    },
    children: {
      description: "Left cluster — status/context, ViewToolbarFilters, ResultCount.",
      control: false,
      table: { category: "Content" },
    },
    actions: {
      description: "Right cluster — the view's actions. Never clipped at narrow widths.",
      control: false,
      table: { category: "Content" },
    },
    className: {
      description: "Extra Tailwind classes merged via cn() — e.g. the sticky-bar recipe.",
      control: "text",
      table: { category: "Appearance" },
    },
  },
} satisfies Meta<typeof ViewToolbar>;
export default meta;
type Story = StoryObj<typeof meta>;

const VIEW_INFO =
  "Every pipeline run in this workspace from the last 30 days, newest first. Runs are removed after 90 days.";

function ViewActions() {
  return (
    <>
      <Button variant="outline" size="sm">
        <SlidersHorizontal aria-hidden="true" />
        Filters
      </Button>
      <Button variant="outline" size="sm">
        <Download aria-hidden="true" />
        Export
      </Button>
      <Button size="sm">
        <Plus aria-hidden="true" />
        New run
      </Button>
    </>
  );
}

/** Two chips, statically rendered — used by the read-only theme stories. */
function StaticFilters() {
  return (
    <ViewToolbarFilters onClearAll={() => undefined}>
      <FilterChip label="Status: Failed" onRemove={() => undefined} />
      <FilterChip label="Owner: Data platform" onRemove={() => undefined} />
    </ViewToolbarFilters>
  );
}

/**
 * The whole grammar in one row: ⓘ info · status · active filters · result count
 * on the left, actions on the right. The count reads "24 of 128" because a
 * filter is active — a bare "24" would misrepresent the view.
 */
export const Default: Story = {
  render: function DefaultToolbar() {
    const [filters, setFilters] = useState(["Status: Failed", "Owner: Data platform"]);
    const filtered = filters.length > 0;

    return (
      <ViewToolbar info={VIEW_INFO} actions={<ViewActions />} className="w-full max-w-4xl">
        <StatusBadge status="running" size="sm" />
        {filtered ? (
          <ViewToolbarFilters onClearAll={() => setFilters([])}>
            {filters.map((filter) => (
              <FilterChip
                key={filter}
                label={filter}
                onRemove={() => setFilters((current) => current.filter((f) => f !== filter))}
              />
            ))}
          </ViewToolbarFilters>
        ) : null}
        <ResultCount count={filtered ? 24 : 128} total={filtered ? 128 : undefined}>
          runs
        </ResultCount>
      </ViewToolbar>
    );
  },
};

/**
 * The minimum viable row: actions only. No info, no filters, no count — the row
 * still holds its `min-h-9` floor so it lines up with a populated sibling view.
 */
export const ActionsOnly: Story = {
  render: () => <ViewToolbar actions={<ViewActions />} className="w-full max-w-4xl" />,
};

/**
 * **No filters applied** — the filters region is ABSENT, not an empty box, and
 * the count is a bare total ("128 runs"), because "128 of 128" is noise.
 */
export const NoFiltersApplied: Story = {
  render: () => (
    <ViewToolbar info={VIEW_INFO} actions={<ViewActions />} className="w-full max-w-4xl">
      <StatusBadge status="complete" size="sm" />
      <ResultCount count={128}>runs</ResultCount>
    </ViewToolbar>
  ),
};

/**
 * **Empty results.** The count still tells the truth ("0 of 128") and the chips
 * STAY, so the filter that emptied the view is the thing the user can undo. The
 * toolbar does not own the empty state itself — that is a `StatePanel` below it.
 */
export const EmptyResults: Story = {
  render: function EmptyResultsToolbar() {
    const [filters, setFilters] = useState(["Status: Denied", "Owner: Platform SRE"]);

    return (
      <div className="flex w-full max-w-4xl flex-col gap-4">
        <ViewToolbar info={VIEW_INFO} actions={<ViewActions />}>
          {filters.length > 0 ? (
            <ViewToolbarFilters onClearAll={() => setFilters([])}>
              {filters.map((filter) => (
                <FilterChip
                  key={filter}
                  label={filter}
                  onRemove={() => setFilters((current) => current.filter((f) => f !== filter))}
                />
              ))}
            </ViewToolbarFilters>
          ) : null}
          <ResultCount count={0} total={128}>
            runs
          </ResultCount>
        </ViewToolbar>
        <StatePanel
          kind="empty"
          title="No runs match these filters"
          description="Remove a filter above to widen the search."
        />
      </div>
    );
  },
};

/**
 * **Not ready.** `ResultCount loading` renders a layout-shaped placeholder
 * instead of a "0" that lies while the first page is in flight, and announces
 * the wait once at the region rather than per skeleton box.
 */
export const ResultCountLoading: Story = {
  render: () => (
    <ViewToolbar info={VIEW_INFO} actions={<ViewActions />} className="w-full max-w-4xl">
      <StatusBadge status="running" size="sm" />
      <ResultCount count={0} total={128} loading />
    </ViewToolbar>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("status")).toBeInTheDocument();
    await expect(canvas.queryByText("0 of 128")).toBeNull();
  },
};

/**
 * **Overflowing content at a narrow width.** Long chip labels truncate, the chip
 * run wraps inside the filters group, and the two clusters stack instead of the
 * left one being squeezed to nothing. The play function asserts the AC directly:
 * the last action is still inside the toolbar's box, and nothing in the row
 * clips it.
 */
export const Overflowing: Story = {
  render: function OverflowingToolbar() {
    const [filters, setFilters] = useState([
      "Status: Failed",
      "Owner: Data platform engineering",
      "Environment: Production (eu-west-1)",
      "Trigger: Scheduled — nightly full refresh",
      "Tag: needs-review",
    ]);

    return (
      <div className="w-full max-w-sm rounded-lg border border-border p-3">
        <ViewToolbar info={VIEW_INFO} actions={<ViewActions />}>
          {filters.length > 0 ? (
            <ViewToolbarFilters onClearAll={() => setFilters([])}>
              {filters.map((filter) => (
                <FilterChip
                  key={filter}
                  label={filter}
                  onRemove={() => setFilters((current) => current.filter((f) => f !== filter))}
                />
              ))}
            </ViewToolbarFilters>
          ) : null}
          <ResultCount count={3} total={128}>
            runs
          </ResultCount>
        </ViewToolbar>
      </div>
    );
  },
  play: async ({ canvas }) => {
    const action = canvas.getByRole("button", { name: "New run" });
    const toolbar = action.closest("[data-slot='view-toolbar']") as HTMLElement | null;

    await expect(action).toBeVisible();
    await expect(toolbar).not.toBeNull();

    /** The AC in geometric terms: the last action is inside the row's own box. */
    const assertActionInsideRow = () => {
      const toolbarBox = toolbar!.getBoundingClientRect();
      const actionBox = action.getBoundingClientRect();
      expect(actionBox.width).toBeGreaterThan(0);
      expect(actionBox.right).toBeLessThanOrEqual(Math.ceil(toolbarBox.right) + 1);
      expect(actionBox.left).toBeGreaterThanOrEqual(Math.floor(toolbarBox.left) - 1);
      expect(actionBox.bottom).toBeLessThanOrEqual(Math.ceil(toolbarBox.bottom) + 1);
    };

    assertActionInsideRow();

    // Nothing between the action and the row may clip it away.
    for (
      let node: HTMLElement | null = action;
      node && node !== toolbar!.parentElement;
      node = node.parentElement
    ) {
      await expect(getComputedStyle(node).overflow).not.toBe("hidden");
    }

    /*
     * Squeeze the row to a phone width, INSIDE the test, because the runner's
     * viewport is wide enough to hide the bug this locks: with a `shrink-0`
     * action cluster whose buttons could not wrap, the cluster overflowed the
     * row's right edge by ~8px at a 320px viewport — the action was "reachable"
     * only because nothing happened to clip it. It now wraps instead.
     */
    const frame = toolbar!.parentElement as HTMLElement;
    const restore = frame.style.maxWidth;
    frame.style.maxWidth = "260px";
    await waitFor(() => expect(toolbar!.getBoundingClientRect().width).toBeLessThan(260));
    assertActionInsideRow();
    frame.style.maxWidth = restore;
  },
};

/**
 * **Keyboard removal (AC).** The whole chip is one `<button>`, so Enter and
 * Space both remove it and there is exactly one tab stop per active filter.
 */
export const KeyboardRemoval: Story = {
  render: function KeyboardToolbar() {
    const [filters, setFilters] = useState(["Status: Failed", "Owner: Data platform"]);
    const filtered = filters.length > 0;

    return (
      <ViewToolbar actions={<ViewActions />} className="w-full max-w-4xl">
        {filtered ? (
          <ViewToolbarFilters onClearAll={() => setFilters([])}>
            {filters.map((filter) => (
              <FilterChip
                key={filter}
                label={filter}
                onRemove={() => setFilters((current) => current.filter((f) => f !== filter))}
              />
            ))}
          </ViewToolbarFilters>
        ) : null}
        <ResultCount count={filtered ? 24 : 128} total={filtered ? 128 : undefined}>
          runs
        </ResultCount>
      </ViewToolbar>
    );
  },
  play: async ({ canvas }) => {
    const first = canvas.getByRole("button", { name: "Remove filter: Status: Failed" });
    await expect(first.tagName).toBe("BUTTON");
    first.focus();
    await expect(first).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await waitFor(() =>
      expect(canvas.queryByRole("button", { name: "Remove filter: Status: Failed" })).toBeNull(),
    );

    const second = canvas.getByRole("button", { name: "Remove filter: Owner: Data platform" });
    second.focus();
    await userEvent.keyboard(" ");
    await waitFor(() =>
      expect(
        canvas.queryByRole("button", { name: "Remove filter: Owner: Data platform" }),
      ).toBeNull(),
    );

    // With no filters left the region disappears and the count drops "of M".
    await expect(canvas.queryByRole("group", { name: "Active filters" })).toBeNull();
    await expect(canvas.getByText("128 runs")).toBeInTheDocument();
  },
};

/** The same row on `dark`. */
export const DarkTheme: Story = {
  globals: { theme: "dark" },
  render: () => (
    <ViewToolbar info={VIEW_INFO} actions={<ViewActions />} className="w-full max-w-4xl">
      <StatusBadge status="complete" size="sm" />
      <StaticFilters />
      <ResultCount count={24} total={128}>
        runs
      </ResultCount>
    </ViewToolbar>
  ),
};

/** The same row at decoration 10 — drawn, not filled. */
export const HighDecoration: Story = {
  globals: { decoration: "10" },
  render: () => (
    <ViewToolbar info={VIEW_INFO} actions={<ViewActions />} className="w-full max-w-4xl">
      <StatusBadge status="complete" size="sm" />
      <StaticFilters />
      <ResultCount count={24} total={128}>
        runs
      </ResultCount>
    </ViewToolbar>
  ),
};
