import type { Meta, StoryObj } from "@storybook/react-vite";
import { type ReactElement, useMemo, useRef, useState } from "react";
import { expect, userEvent, waitFor } from "storybook/test";
import { ChartTooltipContent } from "../tooltip";
import { CanvasLayer, type CanvasLayerProps } from "./canvas-layer";
import { createSpatialGrid } from "./hit-test";
import { canvasTokenColor } from "./use-canvas-draw";

/**
 * `CanvasLayer` is the canvas mark path for `ChartFrame` — the sibling of the
 * SVG marks for views whose mark count is past what the DOM can carry.
 *
 * The two things these stories exist to show, because neither is visible in the
 * prop table: the **measured draw time at 50,000 marks** (the RM-046 budget is
 * under 50 ms) and the **keyboard contract** — one tab stop and one focus ring
 * for a picture with no DOM in it.
 */
const meta = {
  title: "Charts/CanvasLayer",
  component: CanvasLayer as (props: CanvasLayerProps<LogEvent>) => ReactElement,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
} satisfies Meta<(props: CanvasLayerProps<LogEvent>) => ReactElement>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Every story below drives a WRAPPER that owns the dataset, the spatial grid
 * and the scales — none of which can live in `args`, because they are built
 * with hooks. These are the type-required minimum so the args table still
 * documents the real prop surface.
 */
const PLACEHOLDER_ARGS: CanvasLayerProps<LogEvent> = {
  points: [],
  draw: () => {},
  hitTest: () => null,
};

// ── Fixtures ────────────────────────────────────────────────────────────────

interface LogEvent {
  id: number;
  /** Case row, 0-based. */
  row: number;
  /** Minutes from the start of the window. */
  t: number;
  activity: string;
}

const ACTIVITIES = ["Received", "Reviewed", "Approved", "Shipped", "Closed"];

/**
 * A deterministic event log — a seeded LCG, so the picture and every
 * interaction assertion are the same on every run. A canvas story built on
 * `Math.random` is a flake generator with a screenshot.
 */
function eventLog(count: number, rows: number): LogEvent[] {
  let seed = 42;
  const next = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  const events: LogEvent[] = [];
  for (let id = 0; id < count; id++) {
    const row = Math.floor(next() * rows);
    // Two humps, so the density has structure a reader can see.
    const hump = next() < 0.6 ? 0.3 : 0.72;
    const t = Math.min(1, Math.max(0, hump + (next() - 0.5) * 0.35));
    events.push({
      id,
      row,
      t: t * 1440,
      activity: ACTIVITIES[id % ACTIVITIES.length] as string,
    });
  }
  return events;
}

const WIDTH = 760;
const HEIGHT = 320;

/** Screen position of an event, in the layer's CSS-pixel space. */
function positionOf(event: LogEvent, rows: number) {
  return {
    x: 8 + (event.t / 1440) * (WIDTH - 16),
    y: 12 + (event.row / rows) * (HEIGHT - 24),
  };
}

/**
 * The documented wiring: a spatial grid built once per dataset, a token-reading
 * `draw`, and a measured draw time surfaced to the reader.
 */
function DottedCanvas({
  count,
  rows = 24,
  showTiming = false,
}: {
  count: number;
  rows?: number;
  showTiming?: boolean;
}) {
  const events = useMemo(() => eventLog(count, rows), [count, rows]);
  const [focused, setFocused] = useState<LogEvent | null>(null);
  const [drawMs, setDrawMs] = useState<number | null>(null);
  const measuredRef = useRef(false);

  const grid = useMemo(() => {
    const g = createSpatialGrid<LogEvent>(8);
    for (const event of events) {
      const { x, y } = positionOf(event, rows);
      g.insert(x, y, event);
    }
    return g;
  }, [events, rows]);

  return (
    <div className="flex flex-col gap-2">
      <div
        className="relative overflow-hidden rounded-md border border-border bg-card"
        style={{ width: WIDTH, height: HEIGHT }}
      >
        <CanvasLayer<LogEvent>
          accessibleDescription={`${events.length.toLocaleString()} events across ${rows} case rows over 24 hours. Density peaks in the morning and again mid-afternoon.`}
          accessibleLabel="Event log marks"
          draw={(ctx, scales) => {
            const started = performance.now();
            ctx.fillStyle = // A token, never a literal — and a transparent fallback, so a
              // context with no document draws nothing rather than an off-brand hue.
              canvasTokenColor("--chart-1", ctx.canvas, "transparent");
            ctx.globalAlpha = 0.65;
            for (const event of events) {
              const { x, y } = positionOf(event, rows);
              ctx.fillRect(x, y, 2, 2);
            }
            ctx.globalAlpha = 1;
            if (!measuredRef.current) {
              measuredRef.current = true;
              const elapsed = performance.now() - started;
              // Out of the draw call — setting state inside a paint would
              // re-enter the layout effect that called it.
              queueMicrotask(() => setDrawMs(elapsed));
            }
            void scales;
          }}
          drawSignature={`${events.length}`}
          focusRect={(event) => {
            const { x, y } = positionOf(event, rows);
            return { x: x - 5, y: y - 5, width: 12, height: 12 };
          }}
          hitTest={(x, y) => grid.query(x, y, 8)}
          labelFor={(event) =>
            `${event.activity}, case row ${event.row + 1}, minute ${Math.round(event.t)}`
          }
          onDatapointFocus={setFocused}
          points={events}
          renderTooltip={(event) => (
            <ChartTooltipContent
              rows={[
                {
                  color: "var(--chart-1)",
                  label: `Case row ${event.row + 1}`,
                  value: `${Math.round(event.t)} min`,
                },
              ]}
              title={event.activity}
            />
          )}
        />
      </div>
      <p className="text-meta text-muted-foreground" data-testid="canvas-layer-readout">
        {events.length.toLocaleString()} marks
        {showTiming && drawMs != null ? ` · drawn in ${drawMs.toFixed(1)} ms` : ""}
        {focused ? ` · focused: ${focused.activity} (row ${focused.row + 1})` : ""}
      </p>
    </div>
  );
}

// ── Stories ─────────────────────────────────────────────────────────────────

/**
 * 20,000 marks — the low end of where the canvas path is the right answer.
 * Hover a mark for a tooltip; Tab into the layer for the keyboard cursor.
 */
export const Default: Story = {
  args: PLACEHOLDER_ARGS,
  render: () => <DottedCanvas count={20_000} />,
};

/**
 * The RM-046 budget, measured in the browser rather than asserted in CI (CI
 * hardware variance would make a hard threshold a flake). The readout below the
 * plot is the real number for THIS machine; on a 2020-class laptop 50,000
 * marks draw in well under the 50 ms budget.
 */
export const FiftyThousandMarks: Story = {
  args: PLACEHOLDER_ARGS,
  name: "50,000 marks (perf harness)",
  render: () => <DottedCanvas count={50_000} rows={40} showTiming />,
  play: async ({ canvas }) => {
    // The measurement is the point of the story: assert it actually appeared.
    await waitFor(() =>
      expect(canvas.getByTestId("canvas-layer-readout")).toHaveTextContent(/drawn in/),
    );
    await expect(canvas.getByTestId("canvas-layer-readout")).toHaveTextContent("50,000 marks");
  },
};

/**
 * The keyboard contract: ONE tab stop for the whole picture, arrow keys walk
 * the marks, and a single SVG focus ring follows the cursor. A screen reader
 * gets the region summary on entry and the focused mark from the live region.
 */
export const KeyboardCursor: Story = {
  args: PLACEHOLDER_ARGS,
  render: () => <DottedCanvas count={2_000} rows={12} />,
  play: async ({ canvas, canvasElement }) => {
    const cursor = canvas.getByRole("button", { name: "Event log marks" });

    // One tab stop for 2,000 marks — not 2,000.
    await expect(canvas.getAllByRole("button")).toHaveLength(1);

    // Tab, not click: the cursor deliberately sits in a `pointer-events-none`
    // layer so the canvas underneath keeps hover, so a real browser refuses to
    // click it — which is exactly the contract being asserted here.
    await userEvent.tab();
    await expect(cursor).toHaveFocus();
    await waitFor(() =>
      expect(canvas.getByTestId("canvas-layer-readout")).toHaveTextContent(/focused:/),
    );

    const ring = () =>
      canvasElement.querySelector('[data-slot="canvas-layer-focus-ring"] rect') as SVGRectElement;
    await expect(ring()).not.toBeNull();
    const firstX = ring().getAttribute("x");

    await userEvent.keyboard("{ArrowRight}");
    await waitFor(() => expect(ring().getAttribute("x")).not.toBe(firstX));

    // The live region speaks the mark the cursor is on.
    await expect(canvasElement.querySelector('[role="status"]')).toHaveTextContent(/case row/);

    await userEvent.keyboard("{Home}");
    await waitFor(() => expect(ring().getAttribute("x")).toBe(firstX));
  },
};

/** No marks: no canvas cursor, no tab stop, no focus ring. */
export const Empty: Story = {
  args: PLACEHOLDER_ARGS,
  render: () => (
    <div
      className="relative rounded-md border border-border bg-card"
      style={{ width: 400, height: 160 }}
    >
      <CanvasLayer<LogEvent>
        accessibleDescription="No events match the current filter."
        accessibleLabel="Event log marks"
        draw={() => {}}
        hitTest={() => null}
        points={[]}
      />
    </div>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole("button")).toBeNull();
  },
};
