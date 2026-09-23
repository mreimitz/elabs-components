import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { ChartFrame } from "../../chart-frame/chart-frame";
import { Bar } from "../bar";
import { BarChart } from "../bar-chart";
import { BarValueAxis } from "../bar-value-axis";
import { BarXAxis } from "../bar-x-axis";
import { Grid } from "../grid";
import { Scatter } from "../scatter";
import { ScatterChart } from "../scatter-chart";
import { XAxis } from "../x-axis";
import { YAxis } from "../y-axis";
import type {
  ChartSelectionConfirm,
  ChartSelectionGesture,
  ChartSelectionIntent,
  ChartSelectionIntentHandler,
} from "./types";

/**
 * **Selection session & toolbar** (RM-145, ADR 0040 §4).
 *
 * A chart that lists `selectionGestures` gets a **toolbar**: Pointer plus the
 * listed tools (Range, Rectangle, Lasso), the live count and — with
 * `selectionConfirm="explicit"` — ✓ / ✕.
 *
 * - **`immediate`** (default): every gesture emits one `ChartSelectionIntent`.
 * - **`explicit`** (the associative BI suite's confirm model): gestures build a
 *   **provisional** set — a click toggles a value, a range / rectangle / lasso
 *   adds — painted through `selectionStates` (selected / associated, nothing
 *   excluded) with `data-selection-provisional="true"` on the chart root, so a
 *   theme styles the preview in CSS. ✓, **Enter** or a press outside the chart
 *   commits ONE `replace` intent with the union; ✕ or **Esc** cancels.
 * - In a `ChartFrame` the toolbar joins the frame's action row; on a raw
 *   container it sits above the plot; `selectionToolbar="none"` hides it (the
 *   keys and click-outside still work).
 * - The live region reads “Range selected: 4 categories. Press Enter to
 *   confirm, Escape to cancel.”
 *
 * Every story logs `onSelectionIntent` to the Actions panel.
 */
const meta = {
  title: "Charts/Selection/Session & toolbar",
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          'The selection chrome: a toolbar that switches between pointer, range, rectangle and lasso, and the confirm modes. `selectionConfirm="immediate"` (default) emits every gesture; `"explicit"` previews the selection until ✓ or Enter commits it and ✕ or Esc cancels.',
      },
    },
  },
  args: { onSelectionIntent: fn() },
} satisfies Meta<{ onSelectionIntent: ChartSelectionIntentHandler }>;

export default meta;
type Story = StoryObj<typeof meta>;

// ---------------------------------------------------------------------------
// Fixtures — deterministic.
// ---------------------------------------------------------------------------

const REGIONS = [
  { region: "North", revenue: 42, margin: 12 },
  { region: "East", revenue: 118, margin: 22 },
  { region: "South", revenue: 67, margin: 9 },
  { region: "West", revenue: 131, margin: 18 },
  { region: "Central", revenue: 96, margin: 15 },
  { region: "Coast", revenue: 154, margin: 26 },
  { region: "Valley", revenue: 31, margin: 6 },
  { region: "Harbor", revenue: 173, margin: 24 },
];

/** Readings on a slow diagonal, for the scatter. */
const READINGS = Array.from({ length: 120 }, (_, i) => ({
  id: i,
  load: 10 + ((i * 37) % 90),
  latency: Math.round(40 + ((i * 37) % 90) * 1.4 + ((i * 53) % 30)),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type IntentFn = ReturnType<typeof fn>;
const calls = (mock: unknown) => (mock as IntentFn).mock.calls.length;
const lastIntent = (mock: unknown) =>
  (mock as IntentFn).mock.calls.at(-1)?.[0] as ChartSelectionIntent | undefined;

function frame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

function fire(
  target: Element,
  type: "pointerdown" | "pointermove" | "pointerup",
  x: number,
  y: number,
  init: PointerEventInit = {},
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
      ...init,
    }),
  );
}

/** The plot `<g>` the engine binds to, and the box of its background rect. */
async function plotOf(root: HTMLElement): Promise<{ plot: Element; box: DOMRect }> {
  await waitFor(() =>
    expect(root.querySelector('[data-slot="chart-selection-gesture"]')).not.toBeNull(),
  );
  // Let a debounced `ParentSize` settle before the first press.
  await new Promise((resolve) => setTimeout(resolve, 150));
  const plot = root.querySelector('[data-slot="chart-selection-gesture"]')!.parentElement!;
  return { plot, box: (plot.firstElementChild ?? plot).getBoundingClientRect() };
}

const at = (box: DOMRect, fx: number, fy: number) =>
  [box.left + box.width * fx, box.top + box.height * fy] as const;

/** A click (press + release in place) at a fraction of the plot. */
async function clickAt(plot: Element, box: DOMRect, fx: number, fy: number, init = {}) {
  const [x, y] = at(box, fx, fy);
  fire(plot, "pointerdown", x, y, init);
  fire(plot, "pointerup", x, y, init);
  await frame();
}

/** Drags through fractions of the plot. */
async function drawPath(
  plot: Element,
  box: DOMRect,
  points: ReadonlyArray<readonly [number, number]>,
) {
  const [first, ...rest] = points.map(([fx, fy]) => at(box, fx, fy));
  if (!first) return;
  fire(plot, "pointerdown", first[0], first[1]);
  for (const [x, y] of rest) {
    fire(plot, "pointermove", x, y);
    await frame();
  }
  const end = rest.at(-1) ?? first;
  fire(plot, "pointerup", end[0], end[1]);
  await frame();
}

/** Centre of category `i` of `n` bands along x. */
const bandCentre = (i: number, n = REGIONS.length) => (i + 0.5) / n;

function RegionBars({
  onSelectionIntent,
  gestures = ["range", "rect", "lasso"],
  confirm,
  toolbar,
  testId = "chart",
}: {
  onSelectionIntent: ChartSelectionIntentHandler;
  gestures?: ChartSelectionGesture[];
  confirm?: ChartSelectionConfirm;
  toolbar?: "auto" | "none";
  testId?: string;
}) {
  return (
    <div className="w-full max-w-[720px]" data-testid={testId}>
      <BarChart
        accessibleLabel="Revenue by region"
        animationDuration={0}
        data={REGIONS}
        onSelectionIntent={onSelectionIntent}
        selectionConfirm={confirm}
        selectionGestures={gestures}
        selectionToolbar={toolbar}
        xDataKey="region"
      >
        <Grid horizontal />
        <Bar dataKey="revenue" />
        <BarXAxis />
        <BarValueAxis />
      </BarChart>
    </div>
  );
}

const statusOf = (root: HTMLElement) =>
  root.querySelector('[data-slot="chart-selection-status"]')?.textContent ?? "";

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------

/**
 * **Explicit** on bars: click North, click East, then switch to **Range** and
 * drag across Central–Coast — the count reads “4 selected” and the bars paint
 * the provisional set. ✓ commits ONE `replace` intent with the union. A second
 * session (click Valley) is cancelled with ✕: no intent, paint restored.
 */
export const ExplicitSessionOnBars: Story = {
  render: ({ onSelectionIntent }) => (
    <RegionBars confirm="explicit" onSelectionIntent={onSelectionIntent} />
  ),
  play: async ({ args, canvasElement }) => {
    const root = within(canvasElement).getByTestId("chart");
    const chrome = within(root);
    const { plot, box } = await plotOf(root);

    await clickAt(plot, box, bandCentre(0), 0.97); // North
    await clickAt(plot, box, bandCentre(1), 0.97); // East
    await waitFor(() => expect(chrome.getByText("2 selected")).toBeVisible());

    await userEvent.click(chrome.getByRole("radio", { name: "Range" }));
    await waitFor(() =>
      expect(root.querySelector('[data-slot="chart-selection-gesture"]')).toHaveAttribute(
        "data-gesture-mode",
        "range-x",
      ),
    );
    // Central (4) and Coast (5): press inside Central's band, release inside Coast's.
    await drawPath(plot, box, [
      [bandCentre(4), 0.5],
      [bandCentre(4) + 0.03, 0.5],
      [bandCentre(5) - 0.02, 0.5],
      [bandCentre(5), 0.5],
    ]);
    await waitFor(() => expect(chrome.getByText("4 selected")).toBeVisible());
    await expect(args.onSelectionIntent).not.toHaveBeenCalled();
    const session = root.querySelector('[data-slot="chart-selection-root"]');
    await expect(session).toHaveAttribute("data-selection-provisional", "true");
    await expect(root.querySelectorAll('[data-selection="selected"]')).toHaveLength(4);
    await expect(root.querySelector('[data-selection="excluded"]')).toBeNull();
    await expect(statusOf(root)).toBe(
      "Range selected: 4 categories. Press Enter to confirm, Escape to cancel.",
    );

    await userEvent.click(chrome.getByRole("button", { name: "Confirm selection" }));
    await waitFor(() => expect(args.onSelectionIntent).toHaveBeenCalledTimes(1));
    const intent = lastIntent(args.onSelectionIntent);
    await expect(intent?.mode).toBe("replace");
    await expect(intent?.field).toBe("region");
    await expect(intent?.values).toEqual(["North", "East", "Central", "Coast"]);
    await expect(intent?.gesture.kind).toBe("range");
    await expect(session).not.toHaveAttribute("data-selection-provisional");

    // A second session, cancelled: nothing emitted, paint restored.
    await userEvent.click(chrome.getByRole("radio", { name: "Pointer" }));
    await clickAt(plot, box, bandCentre(6), 0.97); // Valley
    await waitFor(() => expect(chrome.getByText("1 selected")).toBeVisible());
    await userEvent.click(chrome.getByRole("button", { name: "Cancel selection" }));
    await waitFor(() => expect(root.querySelector("[data-selection]")).toBeNull());
    await expect(args.onSelectionIntent).toHaveBeenCalledTimes(1);
    await expect(statusOf(root)).toBe("Selection cancelled");
  },
};

/** **Immediate** on a scatter: every lasso emits its own intent at once (plain = replace). */
export const ImmediateOnScatter: Story = {
  render: ({ onSelectionIntent }) => (
    <div className="w-full max-w-[720px]" data-testid="chart">
      <ScatterChart
        accessibleLabel="Latency by load"
        animationDuration={0}
        data={READINGS}
        onSelectionIntent={onSelectionIntent}
        selectionField="id"
        selectionGestures={["lasso"]}
        xDataKey="load"
        xScale="linear"
      >
        <Grid horizontal />
        <Scatter dataKey="latency" />
        <XAxis />
        <YAxis />
      </ScatterChart>
    </div>
  ),
  play: async ({ args, canvasElement }) => {
    const root = within(canvasElement).getByTestId("chart");
    const chrome = within(root);
    const { plot, box } = await plotOf(root);
    await expect(chrome.getByRole("radio", { name: "Lasso" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await expect(chrome.queryByRole("button", { name: "Confirm selection" })).toBeNull();

    const lasso = (x0: number, x1: number) =>
      drawPath(plot, box, [
        [x0, 0.02],
        [x1, 0.02],
        [x1, 0.98],
        [x0, 0.98],
        [x0 + 0.002, 0.03],
      ]);
    await lasso(0.02, 0.4);
    await waitFor(() => expect(args.onSelectionIntent).toHaveBeenCalledTimes(1));
    const first = lastIntent(args.onSelectionIntent);
    await expect(first?.mode).toBe("replace");
    await expect(first?.gesture.kind).toBe("lasso");
    await expect(first?.values.length).toBeGreaterThan(0);
    await waitFor(() => expect(chrome.getByText(`${first?.values.length} selected`)).toBeVisible());

    await lasso(0.6, 0.98);
    await waitFor(() => expect(args.onSelectionIntent).toHaveBeenCalledTimes(2));
    const second = lastIntent(args.onSelectionIntent);
    await expect(second?.mode).toBe("replace");
    await expect(second?.values.some((v) => first?.values.includes(v))).toBe(false);
  },
};

/**
 * The toolbar is keyboard-operable: Tab to the tool group, arrows move between
 * tools, Space picks one — the engine's mode follows (Rectangle draws a
 * rectangle in the plot).
 */
export const ToolbarModes: Story = {
  render: ({ onSelectionIntent }) => <RegionBars onSelectionIntent={onSelectionIntent} />,
  play: async ({ args, canvasElement }) => {
    const root = within(canvasElement).getByTestId("chart");
    const chrome = within(root);
    const { plot, box } = await plotOf(root);
    const layer = () => root.querySelector('[data-slot="chart-selection-gesture"]');
    const pointer = chrome.getByRole("radio", { name: "Pointer" });
    await expect(pointer).toHaveAttribute("aria-checked", "true");

    pointer.focus();
    await userEvent.keyboard("{ArrowRight}{ArrowRight}");
    const rect = chrome.getByRole("radio", { name: "Rectangle" });
    await expect(rect).toHaveFocus();
    await userEvent.keyboard(" ");
    await waitFor(() => expect(rect).toHaveAttribute("aria-checked", "true"));
    await waitFor(() => expect(layer()).toHaveAttribute("data-gesture-mode", "rect"));

    await drawPath(plot, box, [
      [0.01, 0.02],
      [0.2, 0.5],
      [0.37, 0.98],
    ]);
    await waitFor(() => expect(args.onSelectionIntent).toHaveBeenCalledTimes(1));
    await expect(lastIntent(args.onSelectionIntent)?.gesture.kind).toBe("rect");
    await expect(lastIntent(args.onSelectionIntent)?.values).toEqual(["North", "East", "South"]);

    await userEvent.keyboard("{ArrowRight} ");
    await waitFor(() => expect(layer()).toHaveAttribute("data-gesture-mode", "lasso"));
    await expect(chrome.getByRole("radio", { name: "Lasso" })).toHaveFocus();
  },
};

/**
 * In a `ChartFrame` the toolbar joins the frame's action row beside the table
 * flip and exports. The frame's `selection={{ confirm: "explicit" }}` flips the
 * default (a brand theme may ask for it); Escape anywhere in the frame cancels.
 */
export const FramedChart: Story = {
  render: ({ onSelectionIntent }) => (
    <div className="w-full max-w-[760px]" data-testid="frame">
      <ChartFrame
        data={REGIONS}
        description="Click bars or switch to Range, then confirm with ✓ or Enter."
        selection={{ confirm: "explicit" }}
        title="Revenue by region"
      >
        <BarChart
          animationDuration={0}
          data={REGIONS}
          onSelectionIntent={onSelectionIntent}
          selectionGestures={["range", "lasso"]}
          xDataKey="region"
        >
          <Grid horizontal />
          <Bar dataKey="revenue" />
          <BarXAxis />
          <BarValueAxis />
        </BarChart>
      </ChartFrame>
    </div>
  ),
  play: async ({ args, canvasElement }) => {
    const frameRoot = within(canvasElement).getByTestId("frame");
    const toolbar = frameRoot.querySelector<HTMLElement>('[data-slot="chart-selection-toolbar"]');
    await expect(toolbar).not.toBeNull();
    // In the header, not above the plot.
    await expect(toolbar?.closest('[data-slot="card-header"]')).not.toBeNull();
    await expect(toolbar?.closest('[data-slot="chart-selection-root"]')).toBeNull();
    const bar = within(toolbar!);
    const { plot, box } = await plotOf(frameRoot);

    await clickAt(plot, box, bandCentre(2), 0.97); // South
    await waitFor(() => expect(bar.getByText("1 selected")).toBeVisible());
    // Escape from the frame's own table-flip control still cancels. Focus opens
    // that control's tooltip, and the first Escape is the tooltip's (layered
    // dismissal: an Escape another layer handled is never the session's).
    within(frameRoot).getByRole("button", { name: /table/i }).focus();
    await userEvent.keyboard("{Escape}");
    await expect(bar.getByText("1 selected")).toBeVisible();
    await waitFor(() => expect(document.querySelector('[role="tooltip"]')).toBeNull());
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(bar.queryByText("1 selected")).toBeNull());
    await expect(args.onSelectionIntent).not.toHaveBeenCalled();

    await clickAt(plot, box, bandCentre(3), 0.97); // West
    await clickAt(plot, box, bandCentre(5), 0.97); // Coast
    await userEvent.click(bar.getByRole("button", { name: "Confirm selection" }));
    await waitFor(() => expect(args.onSelectionIntent).toHaveBeenCalledTimes(1));
    await expect(lastIntent(args.onSelectionIntent)?.values).toEqual(["West", "Coast"]);
  },
};

/**
 * `selectionToolbar="none"` on a raw container: no chrome, the gestures and
 * keys stay — a rectangle builds the provisional set, Enter commits it.
 */
export const RawContainerToolbarNone: Story = {
  render: ({ onSelectionIntent }) => (
    <RegionBars
      confirm="explicit"
      gestures={["rect"]}
      onSelectionIntent={onSelectionIntent}
      toolbar="none"
    />
  ),
  play: async ({ args, canvasElement }) => {
    const root = within(canvasElement).getByTestId("chart");
    await expect(root.querySelector('[data-slot="chart-selection-toolbar"]')).toBeNull();
    const { plot, box } = await plotOf(root);
    await drawPath(plot, box, [
      [0.51, 0.02],
      [0.75, 0.5],
      [0.99, 0.98],
    ]);
    await waitFor(() =>
      expect(root.querySelector('[data-slot="chart-selection-root"]')).toHaveAttribute(
        "data-selection-provisional",
        "true",
      ),
    );
    await expect(args.onSelectionIntent).not.toHaveBeenCalled();
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(args.onSelectionIntent).toHaveBeenCalledTimes(1));
    await expect(lastIntent(args.onSelectionIntent)?.values).toEqual([
      "Central",
      "Coast",
      "Valley",
      "Harbor",
    ]);
  },
};

/**
 * The provisional paint under a shipped brand theme (`acme`): the preview is
 * the shared selection outline in the theme's own `--chart-foreground` /
 * `--chart-background` tokens, and `data-selection-provisional` is the one
 * hook a theme needs to restyle it — no product code in the library.
 */
export const ExplicitBrandTheme: Story = {
  parameters: { themes: { themeOverride: "acme" } },
  render: ({ onSelectionIntent }) => (
    <RegionBars confirm="explicit" onSelectionIntent={onSelectionIntent} />
  ),
  play: async ({ args, canvasElement }) => {
    await waitFor(() => expect(document.documentElement).toHaveAttribute("data-theme", "acme"));
    const root = within(canvasElement).getByTestId("chart");
    const { plot, box } = await plotOf(root);
    await clickAt(plot, box, bandCentre(5), 0.97); // Coast
    await clickAt(plot, box, bandCentre(7), 0.97); // Harbor
    await waitFor(() =>
      expect(root.querySelectorAll('[data-selection="selected"]')).toHaveLength(2),
    );
    // Token-driven: the preview's compound outline strokes are theme variables.
    const strokes = [
      ...root.querySelectorAll(
        '[data-selection="selected"] [data-slot$="-outline"], [data-selection="selected"] [data-slot$="-outline-core"]',
      ),
    ].map((el) => el.getAttribute("stroke"));
    await expect(strokes).toHaveLength(4);
    await expect(strokes.every((stroke) => stroke?.startsWith("var(--chart-"))).toBe(true);
    await expect(root.querySelector('[data-slot="chart-selection-root"]')).toHaveAttribute(
      "data-selection-provisional",
      "true",
    );
    await userEvent.keyboard("{Enter}");
    await waitFor(() => expect(calls(args.onSelectionIntent)).toBe(1));
    await expect(lastIntent(args.onSelectionIntent)?.values).toEqual(["Coast", "Harbor"]);
  },
};
