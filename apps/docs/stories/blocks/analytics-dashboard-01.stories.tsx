import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { createLocalSelectionDriver, type LocalSelectionDriver } from "@elabs-ai/components-charts";
import { AnalyticsDashboard } from "@/components/analytics-dashboard-01/analytics-dashboard";
import { stores } from "@/components/analytics-dashboard-01/data/analytics-dashboard";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: AnalyticsDashboard,
  title: "Patterns/Blocks/Command Centers/Analytics Dashboard",
  parameters: {
    layout: "padded",
    docs: {
      subtitle: "Where is revenue heading, and which stores carry it?",
      description: {
        component:
          'The three chart-interaction vocabularies together, on one retail use case. A `MetricGrid` of four KPIs; a `LineChart` of 36 months with `analytics={[{ kind: "line", value: "mean" }, { kind: "trend" }, { kind: "forecast", horizon: 6, season: 12 }]}`; a horizontal `BarChart` ranking 60 stores with `scrollbar="auto"` and `maxVisibleItems={16}` (the strip appears because the stores overflow sixteen rows) and an average line; and a `ScatterChart` of margin against revenue with `selectionGestures={["lasso", "rect"]}` in `explicit` confirm. Every chart reads ONE `createLocalSelectionDriver()` through `useSelectionDriver`: a confirmed lasso dims the stores it missed in the ranking and the selection-share KPI restates what was picked. Pass `driver` to link more charts or a host engine with the same `select` / `clear` / `getSnapshot` shape.\n\nCopy-own it: `npx shadcn add analytics-dashboard-01`.',
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof AnalyticsDashboard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** In a dashboard column: the charts stack, the same block. */
export const Narrow: Story = {
  render: (args) => (
    <div className="w-full max-w-md">
      <AnalyticsDashboard {...args} />
    </div>
  ),
};

// ---------------------------------------------------------------------------
// The linked selection, driven for real
// ---------------------------------------------------------------------------

/** The driver the last render used — the play function reads its snapshot. */
let currentDriver: LocalSelectionDriver | null = null;

function WithDriver() {
  const [driver] = useState(createLocalSelectionDriver);
  currentDriver = driver;
  return <AnalyticsDashboard driver={driver} />;
}

function fire(
  target: Element,
  type: "pointerdown" | "pointermove" | "pointerup",
  x: number,
  y: number,
) {
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      composed: true,
      clientX: x,
      clientY: y,
      pointerId: 1,
      pointerType: "mouse",
      isPrimary: true,
      button: 0,
      buttons: type === "pointerup" ? 0 : 1,
    }),
  );
}

const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

/** The chart root that holds `text` in its accessible label. */
function chartRoot(canvasElement: HTMLElement, label: RegExp): HTMLElement {
  const root = [...canvasElement.querySelectorAll<HTMLElement>("[aria-label]")].find((el) =>
    label.test(el.getAttribute("aria-label") ?? ""),
  );
  if (!root) throw new Error(`no chart labelled ${label}`);
  return root.closest<HTMLElement>('[data-slot="card"]') ?? root;
}

/** The painted selection state of every rendered bar in the ranking. */
const barStates = (card: HTMLElement) =>
  [...card.querySelectorAll('[data-slot="chart-selection-mark"]')].map((mark) =>
    mark.getAttribute("data-selection"),
  );

/**
 * **A lasso in the scatter focuses the ranking.** The play function lassoes the high-revenue
 * stores (the right of the scatter), confirms with ✓, and checks that the driver holds them,
 * the KPI restates the share, the ranking paints them `selected`, and — after the strip's end
 * handle is moved with the keyboard (End) to reveal the long tail — the stores outside the
 * lasso paint `excluded`. Clear empties the driver.
 */
export const LassoFocusesTheRanking: Story = {
  render: () => <WithDriver />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const scatter = chartRoot(canvasElement, /^Operating margin against revenue/);
    const ranking = chartRoot(canvasElement, /^Trailing-twelve-month revenue by store/);

    // Nothing selected: every rendered bar is `associated`, and the strip is up (60 > 16).
    await waitFor(() => expect(barStates(ranking).length).toBeGreaterThan(0));
    await expect(barStates(ranking).every((state) => state === "associated")).toBe(true);
    await expect(ranking.querySelector('[data-slot="chart-navigator"]')).not.toBeNull();
    await expect(barStates(ranking).length).toBeLessThan(stores.length);

    // Lasso the right 40 % of the scatter — the biggest stores.
    await waitFor(() =>
      expect(scatter.querySelector('[data-slot="chart-selection-gesture"]')).not.toBeNull(),
    );
    await new Promise((resolve) => setTimeout(resolve, 150));
    const plot = scatter.querySelector('[data-slot="chart-selection-gesture"]')!.parentElement!;
    const box = (plot.firstElementChild ?? plot).getBoundingClientRect();
    const at = (fx: number, fy: number) =>
      [box.left + box.width * fx, box.top + box.height * fy] as const;
    const path = [at(0.6, 0.01), at(0.99, 0.01), at(0.99, 0.99), at(0.6, 0.99), at(0.601, 0.02)];
    fire(plot, "pointerdown", path[0]![0], path[0]![1]);
    for (const [x, y] of path.slice(1)) {
      fire(plot, "pointermove", x, y);
      await frame();
    }
    fire(plot, "pointerup", path.at(-1)![0], path.at(-1)![1]);

    // Explicit confirm: nothing reaches the driver until ✓.
    await expect(currentDriver!.getSnapshot().count()).toBe(0);
    await userEvent.click(within(scatter).getByRole("button", { name: "Confirm selection" }));
    await waitFor(() => expect(currentDriver!.getSnapshot().count("store")).toBeGreaterThan(0));

    const picked = currentDriver!.getSnapshot().fields.store!.values.map(String);
    await expect(picked.length).toBeLessThan(stores.length);
    // The biggest store is in the lasso; the smallest is not.
    await expect(picked).toContain(stores[0]!.store);
    await expect(picked).not.toContain(stores.at(-1)!.store);

    // The KPI and the summary restate the selection.
    await waitFor(() =>
      expect(canvas.getByTestId("selection-kpi")).toHaveTextContent(
        `${picked.length} stores selected`,
      ),
    );
    await expect(canvas.getByTestId("selection-summary")).toHaveTextContent(stores[0]!.store);

    // The ranking leads with the biggest stores, so its first bar is `selected`.
    await waitFor(() => expect(barStates(ranking)[0]).toBe("selected"));

    // Keyboard: the strip's end handle to its maximum shows the long tail, which is `excluded`.
    const endHandle = within(ranking).getAllByRole("slider").at(-1)!;
    endHandle.focus();
    await userEvent.keyboard("{End}");
    await waitFor(() => expect(barStates(ranking)).toContain("excluded"));
    await expect(barStates(ranking)).toContain("selected");

    // Clear empties the driver; every bar is `associated` again.
    await userEvent.click(canvas.getByRole("button", { name: "Clear selection" }));
    await waitFor(() =>
      expect(barStates(ranking).every((state) => state === "associated")).toBe(true),
    );
    await expect(currentDriver!.getSnapshot().count()).toBe(0);
    await expect(canvas.getByTestId("selection-kpi")).toHaveTextContent("All stores");
  },
};
