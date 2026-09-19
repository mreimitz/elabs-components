import { useRef, useState } from "react";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "@elabs-ai/components-ui";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { cellRect } from "../core/layout";
import type { DashboardActions } from "../core/store";
import type { DashboardSpec, TileSpec } from "../core/spec";
import { decodeDashboardState } from "../core/url";
import { opsFlowSpec } from "../fixtures/ops-flow";
import { salesOverviewSpec } from "../fixtures/sales-overview";
import {
  DashboardProvider,
  DashboardSheet,
  createPlaceholderTileKind,
  useDashboard,
  useDashboardActions,
  useDashboardUrlState,
} from "./index";

const TILES = ["kpi", "chart", "text", "placeholder"].map((kind) =>
  createPlaceholderTileKind(kind),
);
// RM-077's typed fixtures (`../fixtures/*`) — the same RM-070 golden layouts, but with real
// 24-row seeded datasets on every `chart` tile instead of the raw JSON's 2-point placeholder
// arrays (`withRealRows`, `../fixtures/apply-rows.ts`).
const SALES: DashboardSpec = salesOverviewSpec;
const OPS: DashboardSpec = opsFlowSpec;

const LAZY: DashboardSpec = {
  version: 1,
  id: "lazy-40",
  title: "Forty tiles mount as they scroll into view",
  grid: { mode: "flow", columns: 24, rowHeight: 30, gap: 8 },
  tiles: Array.from(
    { length: 40 },
    (_, i): TileSpec => ({
      id: `tile-${i + 1}`,
      kind: "placeholder",
      title: `Tile ${i + 1}`,
      layout: { x: (i % 4) * 6, y: Math.floor(i / 4) * 6, w: 6, h: 6 },
      content: {},
    }),
  ),
};

const meta = {
  title: "Dashboard/Sheet",
  component: DashboardSheet,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
} satisfies Meta<typeof DashboardSheet>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Fit24x12: Story = {
  name: "Fit 24×12",
  render: (args) => (
    <div data-testid="host" className="h-[480px] max-h-[80vh] w-full">
      <DashboardProvider spec={SALES} tiles={TILES}>
        <DashboardSheet {...args} />
      </DashboardProvider>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const host = within(canvasElement).getByTestId("host");
    const sheet = await within(canvasElement).findByRole("region", { name: SALES.title });
    await waitFor(() => expect(sheet.querySelectorAll("[data-tile-id]").length).toBe(8));
    // A definite host height is divided into rows: the sheet fills it and nothing scrolls.
    await expect(sheet).toHaveAttribute("data-fill", "host");
    const box = sheet.getBoundingClientRect();
    await expect(Math.abs(box.height - host.getBoundingClientRect().height)).toBeLessThanOrEqual(1);
    await expect(host.scrollHeight).toBeLessThanOrEqual(host.clientHeight + 1);
    const size = { width: box.width, height: box.height };
    const visibleTiles = SALES.tiles.filter((t) => !t.visibleWhen);
    for (const tile of visibleTiles) {
      const el = sheet.querySelector(`[data-tile-id="${tile.id}"]`) as HTMLElement;
      const want = cellRect(tile.layout, SALES.grid, size);
      await waitFor(() => {
        const got = el.getBoundingClientRect();
        expect(Math.abs(got.left - box.left - want.x)).toBeLessThanOrEqual(1);
        expect(Math.abs(got.top - box.top - want.y)).toBeLessThanOrEqual(1);
        expect(Math.abs(got.width - want.width)).toBeLessThanOrEqual(1);
        expect(Math.abs(got.height - want.height)).toBeLessThanOrEqual(1);
      });
    }
    // The lowest tile reaches the sheet's bottom edge when the layout spans every row.
    const rows = SALES.grid.rows ?? 12;
    if (visibleTiles.some((t) => t.layout.y + t.layout.h === rows)) {
      const bottom = Math.max(
        ...Array.from(sheet.querySelectorAll("[data-tile-id]")).map(
          (el) => el.getBoundingClientRect().bottom,
        ),
      );
      await expect(Math.abs(bottom - box.bottom)).toBeLessThanOrEqual(1);
    }

    const tiles = Array.from(sheet.querySelectorAll<HTMLElement>("[data-tile-id]"));
    tiles[0]!.focus();
    await userEvent.keyboard("{ArrowRight}");
    await expect(tiles[1]).toHaveFocus();
    // Full screen through the kebab menu: the inline expand button hides at xs/sm density,
    // and the test browser's width decides the density.
    const owner = tiles[1]!;
    within(owner).getByRole("button", { name: "More actions" }).focus();
    await userEvent.keyboard("{Enter}");
    const item = await within(document.body).findByRole("menuitem", { name: "Full screen" });
    await waitFor(() => expect(item).toHaveFocus());
    await userEvent.keyboard("{Enter}");
    await within(document.body).findByRole("dialog");
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(owner).toHaveFocus());
    // Again, closing before the menu has finished closing. The menu's close-focus runs after
    // its exit animation and used to land on "More actions" when the modal closed first (it
    // failed on CI under load). userEvent's pacing gives the menu time to finish, so select
    // and close in one task, with plain DOM events. `findByRole` waits for the first modal to
    // finish closing: until then the rest of the page is `aria-hidden`.
    (await within(owner).findByRole("button", { name: "More actions" })).focus();
    await userEvent.keyboard("{Enter}");
    const again = await within(document.body).findByRole("menuitem", { name: "Full screen" });
    await waitFor(() => expect(again).toHaveFocus());
    again.click();
    within(document.body)
      .getByRole("dialog")
      .dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await waitFor(() => expect(within(document.body).queryByRole("dialog")).toBeNull());
    // Let the menu's own close-focus run, then read where focus settled.
    await new Promise((resolve) => setTimeout(resolve, 500));
    await expect(owner).toHaveFocus();
  },
};

export const Flow24Columns: Story = {
  name: "Flow 24 columns",
  render: (args) => (
    <DashboardProvider spec={OPS} tiles={TILES}>
      <DashboardSheet {...args} />
    </DashboardProvider>
  ),
};

export const LazyRender: Story = {
  name: "Lazy render (40 tiles)",
  render: (args) => (
    <div data-testid="scroller" className="h-[600px] w-full overflow-auto">
      <DashboardProvider spec={LAZY} tiles={TILES}>
        <DashboardSheet {...args} />
      </DashboardProvider>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const scroller = within(canvasElement).getByTestId("scroller");
    await waitFor(() => expect(scroller.querySelectorAll("[data-tile-id]").length).toBe(40));
    await waitFor(() =>
      expect(scroller.querySelectorAll("[data-tile-body-mounted]").length).toBeGreaterThan(0),
    );
    const root = scroller.getBoundingClientRect();
    const band = { top: root.top - root.height, bottom: root.bottom + root.height };
    const inBand = Array.from(scroller.querySelectorAll("[data-tile-id]")).filter((el) => {
      const r = el.getBoundingClientRect();
      return r.bottom >= band.top && r.top <= band.bottom;
    }).length;
    const mounted = scroller.querySelectorAll("[data-tile-body-mounted]").length;
    await expect(mounted).toBeLessThanOrEqual(inBand);
    await expect(mounted).toBeLessThan(40);
  },
};

export const RenderAll: Story = {
  name: "Lazy render, renderAll",
  args: { renderAll: true },
  render: LazyRender.render,
  play: async ({ canvasElement }) => {
    await waitFor(() =>
      expect(canvasElement.querySelectorAll("[data-tile-body-mounted]").length).toBe(40),
    );
  },
};

export const ContainersTabs: Story = {
  name: "Containers (tabs)",
  render: Flow24Columns.render,
  play: async ({ canvasElement }) => {
    const tab = await within(canvasElement).findByRole("tab", { name: "Throughput" });
    await userEvent.click(tab);
    await waitFor(() =>
      expect(canvasElement.querySelector('[data-tile-id="throughput"]')).not.toBeNull(),
    );
  },
};

export const NarrowContainer: Story = {
  name: "Narrow container",
  render: (args) => (
    <div className="w-full max-w-sm">
      <DashboardProvider spec={SALES} tiles={TILES}>
        <DashboardSheet {...args} />
      </DashboardProvider>
    </div>
  ),
  play: async ({ canvasElement }) => {
    // No definite host height: fit falls back to square cells.
    await waitFor(() =>
      expect(canvasElement.querySelector("[data-slot=dashboard-sheet]")).toHaveAttribute(
        "data-fill",
        "square",
      ),
    );
    await waitFor(() =>
      expect(canvasElement.querySelector('[data-tile-id="kpi-revenue"]')).toHaveAttribute(
        "data-density",
        "xs",
      ),
    );
  },
};

// Responsive (RM-084, R8-R9): the sheet's own width — a container query — resolves
// `spec.layouts.md`/`.sm`, falling back to `stackForNarrow` for `sm`. A local spec (not
// `sales-overview`) so the `md` override is easy to read at a glance.
const RESPONSIVE_SPEC: DashboardSpec = {
  version: 1,
  id: "responsive-demo",
  title: "Responsive demo",
  grid: { mode: "fit", columns: 24, rows: 12, gap: 8 },
  tiles: [
    { id: "left", kind: "chart", title: "Left", layout: { x: 0, y: 0, w: 12, h: 6 }, content: {} },
    {
      id: "right",
      kind: "chart",
      title: "Right",
      layout: { x: 12, y: 0, w: 12, h: 6 },
      content: {},
    },
  ],
  layouts: {
    // 900 px: still two columns, but stacked taller (a hand-tuned "md" override, R9).
    md: [
      { id: "left", x: 0, y: 0, w: 24, h: 4 },
      { id: "right", x: 0, y: 4, w: 24, h: 4 },
    ],
  },
};

// responsive layout — RM-084 follow-up 1: same tiles, but NO `spec.layouts.md` yet — so
// `ResponsiveEditTarget` below can show `moveTile` at `ui.layoutTarget: "md"` CREATING the
// override (seeded from the base layout, since `resolveBreakpointLayout` falls back to base
// when `layouts.md` is absent) rather than editing a pre-authored one.
const EDIT_TARGET_SPEC: DashboardSpec = {
  ...RESPONSIVE_SPEC,
  id: "responsive-edit-target-demo",
  layouts: undefined,
};

function responsiveStory(widthPx: number): Story {
  return {
    render: (args) => (
      <div className="h-[400px] w-full" style={{ maxWidth: widthPx }}>
        <DashboardProvider spec={RESPONSIVE_SPEC} tiles={TILES} mode="edit">
          <DashboardSheet {...args} />
        </DashboardProvider>
      </div>
    ),
    play: async ({ canvasElement }) => {
      const sheet = await within(canvasElement).findByRole("region", {
        name: RESPONSIVE_SPEC.title,
      });
      await waitFor(() => expect(sheet).toHaveAttribute("data-breakpoint"));
      // The sheet gates its first tile paint on its own ResizeObserver/IntersectionObserver
      // measurement round-trip — wait for both tiles to actually mount before reading order.
      await waitFor(() => expect(sheet.querySelectorAll("[data-tile-id]").length).toBe(2));
    },
  };
}

/**
 * responsive layout — RM-084 follow-up 1: `left`'s/`right`'s inline `transform: translate(x, y)`
 * and `width`/`height` (set from the resolved `cellRect`, `dashboard-tile.tsx`) read back as
 * numbers, so a play function can assert the ON-SCREEN rect at a breakpoint, not just DOM order.
 */
function tileRect(sheet: Element, id: string): { x: number; y: number; w: number; h: number } {
  const el = sheet.querySelector(`[data-tile-id="${id}"]`) as HTMLElement;
  const match = /translate\(([-\d.]+)px, ([-\d.]+)px\)/.exec(el.style.transform);
  return {
    x: match ? Number(match[1]) : NaN,
    y: match ? Number(match[2]) : NaN,
    w: Number.parseFloat(el.style.width),
    h: Number.parseFloat(el.style.height),
  };
}

/** Expected pixel rect for `cell` at the sheet's OWN measured width (`getBoundingClientRect`). */
function expectedRect(sheet: Element, cell: { x: number; y: number; w: number; h: number }) {
  const { width, height } = sheet.getBoundingClientRect();
  return cellRect(cell, RESPONSIVE_SPEC.grid, { width, height });
}

export const ResponsiveWide: Story = {
  ...responsiveStory(1200),
  name: "Responsive — 1200 px (lg, base layout)",
  play: async (context) => {
    await responsiveStory(1200).play?.(context);
    const sheet = context.canvasElement.querySelector('[data-slot="dashboard-sheet"]') as Element;
    await expect(sheet).toHaveAttribute("data-breakpoint", "lg");
    // Base layout: "left" then "right", side by side (same y, ascending x).
    const ids = Array.from(sheet.querySelectorAll("[data-tile-id]")).map((el) =>
      el.getAttribute("data-tile-id"),
    );
    await expect(ids).toEqual(["left", "right"]);
    // Base layout rects: left {x:0,y:0,w:12,h:6}, right {x:12,y:0,w:12,h:6} — side by side.
    const left = tileRect(sheet, "left");
    const right = tileRect(sheet, "right");
    const expectedLeft = expectedRect(sheet, { x: 0, y: 0, w: 12, h: 6 });
    const expectedRight = expectedRect(sheet, { x: 12, y: 0, w: 12, h: 6 });
    await expect(left.x).toBeCloseTo(expectedLeft.x, 0);
    await expect(left.y).toBeCloseTo(expectedLeft.y, 0);
    await expect(left.w).toBeCloseTo(expectedLeft.width, 0);
    await expect(right.x).toBeCloseTo(expectedRight.x, 0);
    await expect(right.y).toBeCloseTo(expectedRight.y, 0);
    // "right" starts where "left" ends: not stacked, not overlapping.
    await expect(right.x).toBeGreaterThan(left.x + left.w - 1);
  },
};

export const ResponsiveMedium: Story = {
  ...responsiveStory(900),
  name: "Responsive — 900 px (md, spec.layouts.md renders)",
  play: async (context) => {
    await responsiveStory(900).play?.(context);
    const sheet = context.canvasElement.querySelector('[data-slot="dashboard-sheet"]') as Element;
    await waitFor(() => expect(sheet).toHaveAttribute("data-breakpoint", "md"));
    // `spec.layouts.md`: left {x:0,y:0,w:24,h:4} above right {x:0,y:4,w:24,h:4} — full width, stacked.
    const left = tileRect(sheet, "left");
    const right = tileRect(sheet, "right");
    const expectedLeft = expectedRect(sheet, { x: 0, y: 0, w: 24, h: 4 });
    const expectedRight = expectedRect(sheet, { x: 0, y: 4, w: 24, h: 4 });
    await expect(left.x).toBeCloseTo(expectedLeft.x, 0);
    await expect(left.y).toBeCloseTo(expectedLeft.y, 0);
    await expect(left.w).toBeCloseTo(expectedLeft.width, 0);
    await expect(right.x).toBeCloseTo(expectedRight.x, 0);
    await expect(right.y).toBeCloseTo(expectedRight.y, 0);
    // "right" starts below "left" ends: stacked, not side by side.
    await expect(right.y).toBeGreaterThan(left.y + left.h - 1);
  },
};

export const ResponsiveNarrow: Story = {
  ...responsiveStory(500),
  name: "Responsive — 500 px (sm, stacked; Edit disabled)",
  play: async (context) => {
    await responsiveStory(500).play?.(context);
    const sheet = context.canvasElement.querySelector('[data-slot="dashboard-sheet"]') as Element;
    await waitFor(() => expect(sheet).toHaveAttribute("data-breakpoint", "sm"));
    // Edit mode (`mode="edit"` on the provider) is force-dropped to view rendering at "sm" —
    // the edit layer's always-on announcer never mounts, and no drag/resize chrome appears.
    await expect(
      context.canvasElement.querySelector('[data-slot="dashboard-edit-layer-announcer"]'),
    ).not.toBeInTheDocument();
    // `stackForNarrow`: one column, every tile `w === columns` (24), "left" then "right" stacked.
    const left = tileRect(sheet, "left");
    const right = tileRect(sheet, "right");
    const width = sheet.getBoundingClientRect().width;
    const cellW = (width - (24 - 1) * 8) / 24;
    await expect(left.w).toBeCloseTo(24 * cellW + 23 * 8, 0);
    await expect(right.w).toBeCloseTo(24 * cellW + 23 * 8, 0);
    await expect(left.x).toBeCloseTo(0, 0);
    await expect(right.x).toBeCloseTo(0, 0);
    await expect(right.y).toBeGreaterThan(left.y + left.h - 1);
  },
};

/**
 * responsive layout — RM-084 follow-up 1: `ui.layoutTarget` routes `moveTile` to `spec.layouts.md`
 * instead of the base `tile.layout`, still one history entry (`actions.batch` inside `place`/
 * `placeInLayoutTarget`, `core/store.ts`).
 */
function EditLayoutTargetDemo() {
  const actions = useDashboardActions();
  const target = useDashboard((s) => s.ui.layoutTarget);
  const baseLeft = useDashboard((s) => s.spec.tiles.find((t) => t.id === "left")?.layout);
  const mdLeft = useDashboard((s) => s.spec.layouts?.md?.find((c) => c.id === "left"));
  const historyPast = useDashboard((s) => s.history.past);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Button size="sm" onClick={() => actions.setLayoutTarget("md")}>
          Edit layout for: md
        </Button>
        <Button size="sm" onClick={() => actions.moveTile("left", { x: 2, y: 0 })}>
          Move left
        </Button>
      </div>
      <output data-testid="layout-target" className="text-caption font-mono">
        {`target: ${target}`}
      </output>
      <output data-testid="base-left" className="text-caption font-mono">
        {`base left: ${JSON.stringify(baseLeft)}`}
      </output>
      <output data-testid="md-left" className="text-caption font-mono">
        {`md left: ${JSON.stringify(mdLeft ?? null)}`}
      </output>
      <output data-testid="history-past" className="text-caption font-mono">
        {`history.past: ${historyPast}`}
      </output>
    </div>
  );
}

export const ResponsiveEditTarget: Story = {
  name: "Responsive — edit layout for: md (moveTile targets spec.layouts.md)",
  render: () => (
    <DashboardProvider spec={EDIT_TARGET_SPEC} tiles={TILES} mode="edit">
      <EditLayoutTargetDemo />
    </DashboardProvider>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const baseLeftBefore = await canvas.findByTestId("base-left");
    const mdLeftBefore = canvas.getByTestId("md-left");
    const historyBefore = canvas.getByTestId("history-past");
    // Before: no `layouts.md` override for "left" yet, base layout untouched, no history.
    await expect(baseLeftBefore).toHaveTextContent('base left: {"x":0,"y":0,"w":12,"h":6}');
    await expect(mdLeftBefore).toHaveTextContent("md left: null");
    await expect(historyBefore).toHaveTextContent("history.past: 0");

    await userEvent.click(canvas.getByRole("button", { name: "Edit layout for: md" }));
    await expect(canvas.getByTestId("layout-target")).toHaveTextContent("target: md");
    await userEvent.click(canvas.getByRole("button", { name: "Move left" }));

    // After: `spec.layouts.md` gained/changed "left" at the moved position, the BASE `tile.layout`
    // is untouched, and exactly one history entry was recorded for the move.
    await waitFor(() =>
      expect(canvas.getByTestId("md-left")).toHaveTextContent(
        'md left: {"id":"left","x":2,"y":0,"w":12,"h":6}',
      ),
    );
    await expect(canvas.getByTestId("base-left")).toHaveTextContent(
      'base left: {"x":0,"y":0,"w":12,"h":6}',
    );
    await expect(canvas.getByTestId("history-past")).toHaveTextContent("history.past: 1");
  },
};

// State persistence — RM-083

function SelectEmeaButton() {
  const actions = useDashboardActions();
  return (
    <Button size="sm" onClick={() => actions.select("Region", ["EMEA"], { replace: true })}>
      Select EMEA
    </Button>
  );
}

export const UrlState: Story = {
  name: "URL state",
  render: () => {
    function Demo() {
      const [reloadedFrom, setReloadedFrom] = useState<string | null>(null);
      const encodedRef = useRef("");
      return (
        <div className="flex flex-col gap-3">
          <DashboardProvider spec={SALES} tiles={TILES}>
            <div className="flex items-center gap-3">
              <SelectEmeaButton />
              <UrlStateBarCapture onEncoded={(v) => (encodedRef.current = v)} />
            </div>
            <DashboardSheet />
          </DashboardProvider>
          <Button size="sm" variant="outline" onClick={() => setReloadedFrom(encodedRef.current)}>
            Simulate reload with this URL
          </Button>
          {reloadedFrom ? (
            <div data-testid="reloaded-sheet" className="border-t border-border pt-3">
              {/* A distinct title: two `role="region"` landmarks (this one + the live sheet
               * above) need unique accessible names (axe `landmark-unique`). */}
              <DashboardProvider
                spec={{ ...SALES, title: `${SALES.title} (reloaded)` }}
                tiles={TILES}
                initialState={decodeDashboardState(reloadedFrom) ?? undefined}
              >
                <ReloadedSelectionProbe />
                <DashboardSheet />
              </DashboardProvider>
            </div>
          ) : null}
        </div>
      );
    }
    function UrlStateBarCapture({ onEncoded }: { onEncoded: (value: string) => void }) {
      const { encoded } = useDashboardUrlState();
      onEncoded(encoded);
      const params = new URLSearchParams({ d: encoded });
      return (
        <div className="flex flex-col gap-1">
          {/* The app-facing shape — a real host wires `params.toString()` to its router. */}
          <output data-slot="dashboard-url-state" className="text-caption font-mono">
            {`?${params.toString()}`}
          </output>
          {/* The raw `encodeDashboardState` value, exposed for the play function below — a
           * router's own percent-encoding (`URLSearchParams`, nuqs, …) is a second, separate
           * layer this component never needs to know about. */}
          <output data-testid="url-encoded" className="sr-only">
            {encoded}
          </output>
        </div>
      );
    }
    function ReloadedSelectionProbe() {
      // Surfaces the restored selection as text — decoupled from any one chart's own
      // dimmed-mark DOM — so the play function can assert `initialState` actually landed.
      const selection = useDashboard((s) => s.selection);
      const region = selection.fields.Region?.values.join(", ") ?? "";
      return (
        <output data-testid="reloaded-selection" className="text-caption font-mono">
          {`Region: ${region}`}
        </output>
      );
    }
    return <Demo />;
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const encodedEl = await canvas.findByTestId("url-encoded");
    // Nothing selected yet: no `s.Region=` segment.
    await expect(encodedEl.textContent).not.toContain("Region");
    await userEvent.click(canvas.getByRole("button", { name: "Select EMEA" }));
    await waitFor(() => expect(encodedEl.textContent).toContain("s.Region=s:EMEA"));
    await expect(decodeDashboardState(encodedEl.textContent ?? "")).toEqual(
      expect.objectContaining({ selection: { Region: ["EMEA"] } }),
    );

    await userEvent.click(canvas.getByRole("button", { name: "Simulate reload with this URL" }));
    const reloaded = await canvas.findByTestId("reloaded-sheet");
    // `initialState` restores the selection before first paint — the probe's text and every
    // chart tile's dimmed/selected marks (RM-071's tri-state `data-selection`) both read off
    // the same store, so asserting the probe is enough to know the dimming followed too.
    await waitFor(() =>
      expect(within(reloaded).getByTestId("reloaded-selection")).toHaveTextContent("Region: EMEA"),
    );
  },
};

/** `autosaveMs` debounces `onChange`: rapid edits within the window collapse into one call. */
export const Autosave: Story = {
  name: "Autosave",
  render: () => {
    function Demo() {
      const [calls, setCalls] = useState(0);
      const actionsRef = useRef<DashboardActions | null>(null);
      function ActionsProbe() {
        actionsRef.current = useDashboardActions();
        return null;
      }
      return (
        <div className="flex flex-col gap-3">
          <output data-testid="autosave-calls" className="text-caption font-mono">
            {`${calls} onChange call(s)`}
          </output>
          <DashboardProvider
            spec={SALES}
            tiles={TILES}
            autosaveMs={300}
            onChange={() => setCalls((n) => n + 1)}
          >
            <ActionsProbe />
            <DashboardSheet />
          </DashboardProvider>
          <Button
            size="sm"
            onClick={() => {
              for (let i = 0; i < 5; i++)
                actionsRef.current?.patchTile("kpi-revenue", { title: `Revenue ${i}` });
            }}
          >
            Move a tile 5 times rapidly
          </Button>
        </div>
      );
    }
    return <Demo />;
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Move a tile 5 times rapidly" }));
    await expect(canvas.getByTestId("autosave-calls")).toHaveTextContent("0 onChange call(s)");
    await waitFor(
      () => expect(canvas.getByTestId("autosave-calls")).toHaveTextContent("1 onChange call(s)"),
      { timeout: 2000 },
    );
  },
};

const PERSIST_RECIPE_STORAGE_KEY = "brand-ui-dashboard-sheet-persist-recipe";

/** Every storage access wrapped in try/catch — the storage rules ask for this because
 * `localStorage` can be disabled (private browsing) or full; a recipe, not a feature (D5,
 * README "State persistence" — brand-ui never owns persistence itself). */
function readPersistedSpec(fallback: DashboardSpec): DashboardSpec {
  try {
    const raw = window.localStorage.getItem(PERSIST_RECIPE_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as DashboardSpec) : fallback;
  } catch {
    return fallback;
  }
}

function writePersistedSpec(spec: DashboardSpec): void {
  try {
    window.localStorage.setItem(PERSIST_RECIPE_STORAGE_KEY, JSON.stringify(spec));
  } catch {
    // storage disabled or full — the sheet still works, it just will not persist.
  }
}

function clearPersistedSpec(): void {
  try {
    window.localStorage.removeItem(PERSIST_RECIPE_STORAGE_KEY);
  } catch {
    // ignore
  }
}

function RenameFirstTileButton() {
  const actions = useDashboardActions();
  return (
    <Button
      size="sm"
      onClick={() => actions.patchTile("kpi-revenue", { title: "Renamed via recipe" })}
    >
      Rename first tile
    </Button>
  );
}

export const PersistToLocalStorage: Story = {
  name: "Persist to localStorage (recipe)",
  render: () => {
    clearPersistedSpec();
    function Demo() {
      const [spec, setSpec] = useState(() => readPersistedSpec(SALES));
      return (
        <div className="flex flex-col gap-3">
          <DashboardProvider
            spec={spec}
            tiles={TILES}
            onChange={(next) => {
              setSpec(next);
              writePersistedSpec(next);
            }}
          >
            <RenameFirstTileButton />
            <DashboardSheet />
          </DashboardProvider>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              clearPersistedSpec();
              setSpec(SALES);
            }}
          >
            Reset
          </Button>
        </div>
      );
    }
    return <Demo />;
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Rename first tile" }));
    await waitFor(() => {
      const raw = window.localStorage.getItem(PERSIST_RECIPE_STORAGE_KEY);
      expect(raw).not.toBeNull();
      const stored = JSON.parse(raw as string) as DashboardSpec;
      expect(stored.tiles.find((t) => t.id === "kpi-revenue")?.title).toBe("Renamed via recipe");
    });
    clearPersistedSpec();
  },
};
