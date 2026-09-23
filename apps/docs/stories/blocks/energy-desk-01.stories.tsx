import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { EnergyDesk } from "@/components/energy-desk-01/energy-desk";
import { hourlyReadings } from "@/components/energy-desk-01/data/energy-desk";

/**
 * Renders the SHIPPED registry block, not a copy of it — see `.claude/rules/registry.md`.
 */
const meta = {
  component: EnergyDesk,
  title: "Patterns/Blocks/Command Centers/Energy Desk",
  parameters: {
    layout: "padded",
    docs: {
      subtitle: "What did the site draw, what did the market charge — and what did a period cost?",
      description: {
        component:
          'One window, two hourly series. The spot-price `LineChart` owns the navigator (`scrollbar="miniChart"`, a controlled `window` + `onWindowChange`) and the consumption `AreaChart` follows it through `xDomain` / `xDomainSlotCount` — 2 880 hours condensed in the strip, the window on screen in both plots. `analytics={[{ kind: "window", k: 24, reduce: "mean" }, { kind: "band", spread: { stddev: 1 } }]}` draws the day\'s running average and its corridor on the consumption. Presets (24 h / 7 days / 30 days / All) set the window; a `range` gesture on the consumption chart\'s time axis picks a period, and the KPIs price it hour by hour (consumption × spot price), so the effective $/MWh sits beside the simple average.\n\nCopy-own it: `npx shadcn add energy-desk-01`.',
      },
    },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof EnergyDesk>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Opens on the whole series — four months in each plot, the strip's window at full width. */
export const WholeSeries: Story = {
  args: { defaultSpan: "all" },
};

/** In a dashboard column: the same block, the plots taller than wide. */
export const Narrow: Story = {
  render: (args) => (
    <div className="w-full max-w-md">
      <EnergyDesk {...args} />
    </div>
  ),
};

const HOUR = 3_600_000;
const LAST = hourlyReadings[hourlyReadings.length - 1]!.hour.getTime();

/** The chart root that holds `text` in its accessible label. */
function chartRoot(canvasElement: HTMLElement, label: RegExp): HTMLElement {
  const root = [...canvasElement.querySelectorAll<HTMLElement>("[aria-label]")].find((el) =>
    label.test(el.getAttribute("aria-label") ?? ""),
  );
  if (!root) throw new Error(`no chart labelled ${label}`);
  return root.closest<HTMLElement>('[data-slot="card"]') ?? root;
}

const valueNow = (slider: HTMLElement) => Number(slider.getAttribute("aria-valuenow"));

/**
 * **Presets, the strip and a period all speak the same window.** A preset moves the price
 * chart's strip handles to the last 24 hours; the strip's start handle, moved with the
 * keyboard, deselects the preset; a keyboard range on the consumption chart's time axis picks
 * a period and the cost KPI reprices it; Clear period returns the KPIs to the window.
 */
export const PresetsStripAndPeriod: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const consumption = chartRoot(canvasElement, /^Site consumption per hour/);
    const price = chartRoot(canvasElement, /^Spot price per hour/);

    // The default window is the last seven days: the strip's end handle sits on the last hour.
    const sliders = await within(price).findAllByRole("slider");
    const [start, end] = sliders as [HTMLElement, HTMLElement];
    await waitFor(() => expect(valueNow(end)).toBe(LAST));
    await expect(valueNow(start)).toBe(LAST - (7 * 24 - 1) * HOUR);
    await expect(canvas.getByRole("radio", { name: "7 days" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    const costBefore = canvas.getByTestId("kpi-cost").textContent;

    // 1. A preset: 24 h → the strip's start handle jumps, the scope reads 24 h.
    await userEvent.click(canvas.getByRole("radio", { name: "24 h" }));
    await waitFor(() => expect(valueNow(start)).toBe(LAST - 23 * HOUR));
    await waitFor(() => expect(canvas.getByTestId("scope")).toHaveTextContent("· 24 h"));
    await waitFor(() => expect(canvas.getByTestId("kpi-cost").textContent).not.toBe(costBefore));
    const cost24 = canvas.getByTestId("kpi-cost").textContent;

    // 2. The strip: the start handle a step earlier → wider window, no preset checked.
    start.focus();
    await userEvent.keyboard("{Shift>}{ArrowLeft}{/Shift}");
    await waitFor(() => expect(valueNow(start)).toBeLessThan(LAST - 23 * HOUR));
    await waitFor(() =>
      expect(canvas.getByRole("radio", { name: "24 h" })).toHaveAttribute("aria-checked", "false"),
    );
    await waitFor(() => expect(canvas.getByTestId("kpi-cost").textContent).not.toBe(cost24));
    const costWindow = canvas.getByTestId("kpi-cost").textContent;

    // 3. A period on the consumption chart's time axis, by keyboard.
    const trigger = await within(consumption).findByRole("button", {
      name: "Select a range on the X axis",
    });
    trigger.focus();
    await userEvent.keyboard("{Enter}");
    const rangeStart = await within(consumption).findByRole("slider", {
      name: /Range start, hour/,
    });
    await waitFor(() => expect(rangeStart).toHaveFocus());
    await userEvent.keyboard("{Home}");
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(canvas.getByTestId("scope")).toHaveTextContent(/^Period/));
    await waitFor(() => expect(canvas.getByTestId("kpi-cost").textContent).not.toBe(costWindow));

    // 4. Clear period → the KPIs price the window again.
    await userEvent.click(canvas.getByRole("button", { name: "Clear period" }));
    await waitFor(() => expect(canvas.getByTestId("scope")).toHaveTextContent(/^Showing/));
    await waitFor(() => expect(canvas.getByTestId("kpi-cost").textContent).toBe(costWindow));
  },
};
