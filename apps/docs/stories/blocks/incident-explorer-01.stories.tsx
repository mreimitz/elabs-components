import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { createLocalSelectionDriver, type LocalSelectionDriver } from "@elabs-ai/components-charts";
import { IncidentExplorer } from "@/components/incident-explorer-01/incident-explorer";
import { incidents } from "@/components/incident-explorer-01/data/incident-explorer";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: IncidentExplorer,
  title: "Patterns/Blocks/Command Centers/Incident Explorer",
  parameters: {
    layout: "padded",
    docs: {
      subtitle: "Which service pages, on which days — and what did it cost the on-call?",
      description: {
        component:
          'Two selection FIELDS on one `createLocalSelectionDriver()`. An `AreaChart` of incidents per day with `selectionGestures={["range"]}` on its time axis writes the `day` field (every day in the range, as dates); its `analytics` draw the running average and a one-sigma corridor. A horizontal `BarChart` of incidents by service writes the `service` field by click, Ctrl/Cmd+click or an axis range, with a mean line of its own and `scrollbar="auto"` for a longer service list. Each chart paints its OWN field through `useSelectionDriver(driver, { field })`, while the `DataTable` of the pager log and the four `MetricCard`s show the INTERSECTION — a row passes a field when the field carries no selection or holds its value. Severity is a `StatusBadge` mapped once (`SEV1` → destructive + glyph), so colour is never the only channel.\n\nCopy-own it: `npx shadcn add incident-explorer-01`.',
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof IncidentExplorer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** In a dashboard column: the charts stack, the table flips to cards, the same block. */
export const Narrow: Story = {
  render: (args) => (
    <div className="w-full max-w-md">
      <IncidentExplorer {...args} />
    </div>
  ),
};

// ---------------------------------------------------------------------------
// The two-field selection, driven for real
// ---------------------------------------------------------------------------

/** The driver the last render used — the play function reads its snapshot. */
let currentDriver: LocalSelectionDriver | null = null;

function WithDriver() {
  const [driver] = useState(createLocalSelectionDriver);
  currentDriver = driver;
  return <IncidentExplorer driver={driver} />;
}

/** The chart root that holds `text` in its accessible label. */
function chartRoot(canvasElement: HTMLElement, label: RegExp): HTMLElement {
  const root = [...canvasElement.querySelectorAll<HTMLElement>("[aria-label]")].find((el) =>
    label.test(el.getAttribute("aria-label") ?? ""),
  );
  if (!root) throw new Error(`no chart labelled ${label}`);
  return root.closest<HTMLElement>('[data-slot="card"]') ?? root;
}

/** The painted selection state of every rendered mark in a chart. */
const markStates = (card: HTMLElement) =>
  [...card.querySelectorAll('[data-slot="chart-selection-mark"]')].map((mark) =>
    mark.getAttribute("data-selection"),
  );

/**
 * **A range of days AND a service narrow the log together.** Keyboard first: the daily chart's
 * range button, Home on the start thumb, Enter — the `day` field now holds the first days of
 * the window and the count KPI drops. Then the service ranking's range button, Home, Enter —
 * the busiest service joins as the `service` field, the ranking paints the rest `excluded`,
 * and the table lists only rows that pass BOTH fields. Clear empties both.
 */
export const DaysAndServiceTogether: Story = {
  render: () => <WithDriver />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const dailyCard = chartRoot(canvasElement, /^Incidents opened per day/);
    const rankingCard = chartRoot(canvasElement, /^Incidents by service/);
    const total = incidents.length;

    await waitFor(() => expect(canvas.getByTestId("kpi-count")).toHaveTextContent(String(total)));
    await waitFor(() => expect(markStates(rankingCard).length).toBeGreaterThan(0));

    // 1. A run of days on the time axis, by keyboard.
    const dayTrigger = await within(dailyCard).findByRole("button", {
      name: "Select a range on the X axis",
    });
    dayTrigger.focus();
    await userEvent.keyboard("{Enter}");
    const dayStart = await within(dailyCard).findByRole("slider", { name: /Range start, day/ });
    await waitFor(() => expect(dayStart).toHaveFocus());
    await userEvent.keyboard("{Home}");
    await userEvent.keyboard("{Enter}");

    await waitFor(() => expect(currentDriver!.getSnapshot().count("day")).toBeGreaterThan(0));
    const days = currentDriver!.getSnapshot().fields.day!.values;
    await expect(days[0]).toBeInstanceOf(Date);
    const inDays = incidents.filter((row) =>
      days.some((d) => (d as Date).getTime() === row.day.getTime()),
    ).length;
    await expect(inDays).toBeGreaterThan(0);
    await expect(inDays).toBeLessThan(total);
    await waitFor(() => expect(canvas.getByTestId("kpi-count")).toHaveTextContent(String(inDays)));
    await expect(canvas.getByTestId("selection-summary")).toHaveTextContent(
      `${inDays} of ${total} incidents`,
    );
    // The ranking is untouched by the `day` field: every bar still `associated`.
    await expect(markStates(rankingCard).every((s) => s === "associated")).toBe(true);

    // 2. The busiest service on the category axis, by keyboard (horizontal bars → Y axis).
    const serviceTrigger = await within(rankingCard).findByRole("button", {
      name: "Select a range on the Y axis",
    });
    serviceTrigger.focus();
    await userEvent.keyboard("{Enter}");
    const serviceStart = await within(rankingCard).findByRole("slider", {
      name: /Range start, service/,
    });
    await waitFor(() => expect(serviceStart).toHaveFocus());
    await userEvent.keyboard("{Home}");
    await userEvent.keyboard("{Enter}");

    await waitFor(() => expect(currentDriver!.getSnapshot().count("service")).toBeGreaterThan(0));
    const services = currentDriver!.getSnapshot().fields.service!.values.map(String);
    await expect(services.length).toBeLessThan(8);
    await waitFor(() => expect(markStates(rankingCard)).toContain("excluded"));
    await expect(markStates(rankingCard)).toContain("selected");

    // The intersection: rows in the picked days AND the picked services.
    const both = incidents.filter(
      (row) =>
        services.includes(row.service) &&
        days.some((d) => (d as Date).getTime() === row.day.getTime()),
    ).length;
    await expect(both).toBeLessThan(inDays);
    await waitFor(() => expect(canvas.getByTestId("kpi-count")).toHaveTextContent(String(both)));
    // The table shows only those rows (one page at most, eight per page).
    await waitFor(() => {
      const rows = canvasElement.querySelectorAll("tbody tr");
      expect(rows.length).toBe(Math.min(both, 8));
    });
    for (const cell of canvasElement.querySelectorAll("tbody tr td:nth-child(3)")) {
      await expect(services).toContain(cell.textContent?.trim());
    }

    // 3. Clear empties both fields.
    await userEvent.click(canvas.getByRole("button", { name: "Clear selection" }));
    await waitFor(() => expect(currentDriver!.getSnapshot().count()).toBe(0));
    await waitFor(() => expect(canvas.getByTestId("kpi-count")).toHaveTextContent(String(total)));
    await expect(markStates(rankingCard).every((s) => s === "associated")).toBe(true);
  },
};
