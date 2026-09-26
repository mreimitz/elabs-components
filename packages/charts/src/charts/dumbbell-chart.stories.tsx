import type { ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { contrastRgb, paintedSrgb } from "./on-mark-ink.story-measure";
import { DumbbellChart } from "./dumbbell-chart";

// #240 geometry locks — jsdom returns zeros for SVG text metrics, so these MUST
// be `play` functions running in a real browser (`@storybook/addon-vitest`),
// never jsdom unit tests. Assert on measured geometry, never on the margin
// constants — a test pinned to a constant re-encodes the bug as the spec.

function rectsIntersect(a: DOMRect, b: DOMRect): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

/**
 * Sub-pixel slack for the "label box lies inside the SVG" checks below.
 * `deriveDumbbellMargin` sizes the margin from `measure()` (canvas
 * `measureText`, chosen over `getBoundingClientRect` specifically to avoid
 * forcing sync SVG layout — see `use-text-measurer.ts`), then the label is
 * actually painted as real SVG `<text>` and read back via
 * `getBoundingClientRect`. The two engines shape/round the same string
 * independently, so on some font stacks (observed in CI, not reproducible on
 * every machine) the rendered box can land a hair outside the estimate — e.g.
 * `-0.011871337890625`px, roughly a hundredth of a device pixel and invisible
 * at any zoom. That is measurement noise between two engines, not the
 * component actually clipping a label; a real overflow would be many px, not
 * hundredths. Kept far below a visible half-pixel.
 */
const LABEL_BOUNDARY_TOLERANCE_PX = 0.5;

const meta = {
  title: "Charts/DumbbellChart",
  component: DumbbellChart,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "One track per category (a hairline) with a marker at `start` and one at `end`, " +
          "joined by a connector — the visible delta between two points, in rows or columns " +
          '(`orientation`), with an optional `variant="slope"` that draws one line per ' +
          "category across two value columns instead. A grouped `BarChart`, the previous " +
          "standing answer for two values per category, hides that delta behind two separate " +
          "bar heights the reader has to subtract themselves; with more than two points per " +
          "category, `BumpChart` reads the trajectory instead. See " +
          "[Choosing between similar components](?path=/docs/docs-choosing-between-similar-components--docs).",
      },
    },
  },
} satisfies Meta<typeof DumbbellChart>;

export default meta;
type Story = StoryObj<typeof meta>;

// ── F12: "Onboarding before/after" — hollow (before) -> filled (after), beads
// count the steps saved. ───────────────────────────────────────────────────
const onboardingSteps = [
  { step: "Sign up", before: 100, after: 100 },
  { step: "Verify email", before: 82, after: 94 },
  { step: "Add payment method", before: 41, after: 68 },
  { step: "Invite a teammate", before: 12, after: 39 },
  { step: "Ship first project", before: 19, after: 51 },
];

/** F12 Dumbbell Queue — hollow dot = before, ink dot = after, beads between count the units gained. */
export const Default: Story = {
  args: {
    data: onboardingSteps,
    category: "step",
    startKey: "before",
    endKey: "after",
    beads: { unit: 4 },
    showDelta: true,
  },
  render: (args) => (
    <div className="h-80 w-[640px]">
      <DumbbellChart {...args} />
    </div>
  ),
};

/** `status="loading"` (RM-185): a skeleton fills the same plot box the ready
 * chart would use, at every width, so nothing moves once the data lands. */
export const Loading: Story = {
  render: () => (
    <div className="flex w-[900px] max-w-full flex-col gap-6">
      {[380, 600, 900].map((width) => (
        <div className="w-full" key={width} style={{ maxWidth: width }}>
          <DumbbellChart
            category="step"
            data={onboardingSteps}
            endKey="after"
            startKey="before"
            status="loading"
          />
        </div>
      ))}
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const statuses = canvas.getAllByRole("status");
    await expect(statuses).toHaveLength(3);
    for (const status of statuses) {
      await expect(status).toHaveAttribute("aria-live", "polite");
      await expect(status).toHaveTextContent("Loading chart…");
      const skeleton = status.querySelector('[data-slot="skeleton"]');
      await expect(skeleton).toHaveAttribute("aria-hidden", "true");
    }
    await expect(canvasElement.querySelector("svg")).toBeNull();
  },
};

// ── F6: "This year vs last" — a slope pair per category. ───────────────────
const yearOverYear = [
  { channel: "Organic search", lastYear: 42000, thisYear: 51500 },
  { channel: "Paid social", lastYear: 18000, thisYear: 15200 },
  { channel: "Email", lastYear: 9800, thisYear: 12100 },
  { channel: "Referral", lastYear: 6400, thisYear: 7900 },
];

/** F6 Paired Rungs — two value columns (last year / this year), one line per category. */
export const ThisYearVsLast: Story = {
  args: {
    data: yearOverYear,
    category: "channel",
    startKey: "lastYear",
    endKey: "thisYear",
    variant: "slope",
    valueFormat: "compact",
  },
  play: async ({ canvasElement }) => {
    // #240 (a) — the longest slope start-label ("Organic search …") used to
    // clip past the SVG's left edge because `SLOPE_MARGIN.left` was a bare
    // constant never checked against the rendered label. Every label's box
    // must now lie entirely inside the SVG.
    await waitFor(() => {
      const svg = canvasElement.querySelector("svg");
      expect(svg).not.toBeNull();
      const svgBox = svg!.getBoundingClientRect();
      const labels = svg!.querySelectorAll(
        '[data-slot="dumbbell-chart-slope-label-start"], [data-slot="dumbbell-chart-slope-label-end"]',
      );
      expect(labels.length).toBeGreaterThan(0);
      labels.forEach((label) => {
        const box = label.getBoundingClientRect();
        expect(box.left).toBeGreaterThanOrEqual(svgBox.left - LABEL_BOUNDARY_TOLERANCE_PX);
        expect(box.right).toBeLessThanOrEqual(svgBox.right + LABEL_BOUNDARY_TOLERANCE_PX);
      });
    });
  },
  render: (args) => (
    <div className="h-80 w-[640px]">
      <DumbbellChart {...args} />
    </div>
  ),
};

async function assertNoCategoryLabelOverlap(canvasElement: HTMLElement) {
  // #240 (b) — "Add payment method" and "Invite a teammate" used to render as
  // a run-on string because the vertical category axis's band pitch could be
  // narrower than the label. The chosen fallback is truncation (see
  // `dumbbell-chart.tsx`'s `categoryDisplay`), so no two boxes may intersect.
  await waitFor(() => {
    const labels = Array.from(
      canvasElement.querySelectorAll('[data-slot="dumbbell-chart-category-label"]'),
    );
    expect(labels.length).toBeGreaterThan(1);
    const boxes = labels.map((label) => label.getBoundingClientRect());
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        expect(rectsIntersect(boxes[i] as DOMRect, boxes[j] as DOMRect)).toBe(false);
      }
    }
  });
}

/** Vertical orientation — tracks run as columns instead of rows. */
export const VerticalOrientation: Story = {
  args: {
    data: onboardingSteps,
    category: "step",
    startKey: "before",
    endKey: "after",
    orientation: "vertical",
    showDelta: true,
  },
  play: async ({ canvasElement }) => {
    await assertNoCategoryLabelOverlap(canvasElement);
  },
  render: (args) => (
    <div className="h-[420px] w-[640px]">
      <DumbbellChart {...args} />
    </div>
  ),
};

/**
 * Same fixture at `data-density="spacious"` (#340: `text-meta` scales
 * +6.25%) — the density knob is what makes a pixel-constant label budget
 * unsafe, so the no-overlap guarantee must hold here too, not just at
 * `comfortable`.
 */
export const VerticalOrientationSpacious: Story = {
  args: VerticalOrientation.args,
  play: async ({ canvasElement }) => {
    await assertNoCategoryLabelOverlap(canvasElement);
  },
  render: (args) => (
    <div className="h-[420px] w-full max-w-[640px]" data-density="spacious">
      <DumbbellChart {...args} />
    </div>
  ),
};

// ── L7 Brand Spectrum — small competitor dots on the same track. ───────────
const brandSpectrum = [
  { metric: "Price", us: 40, target: 65, competitorA: 55, competitorB: 30 },
  { metric: "Ease of use", us: 30, target: 70, competitorA: 45, competitorB: 60 },
  { metric: "Support", us: 50, target: 85, competitorA: 40, competitorB: 35 },
];

/** L7 Brand Spectrum — extraKeys draws small competitor dots on the shared track. */
export const CompetitorDots: Story = {
  args: {
    data: brandSpectrum,
    category: "metric",
    startKey: "us",
    endKey: "target",
    extraKeys: ["competitorA", "competitorB"],
    markers: { start: "hollow", end: "filled" },
  },
  render: (args) => (
    <div className="h-72 w-[640px]">
      <DumbbellChart {...args} />
    </div>
  ),
};

// ── Slope past the 8-row soft cap — refuses (dev warning) but stays legible. ─
const manyCategories = Array.from({ length: 9 }, (_, i) => ({
  category: `Region ${i + 1}`,
  q1: 20 + i * 6,
  q2: 25 + ((i * 7) % 40),
}));

/**
 * Slope variant past the 8-row soft cap — dev-only console warning, still
 * renders every row with collision-spaced labels (the "legible fallback").
 */
export const SlopeOverflowWarning: Story = {
  args: {
    data: manyCategories,
    category: "category",
    startKey: "q1",
    endKey: "q2",
    variant: "slope",
    palette: "mono",
  },
  play: async ({ canvasElement }) => {
    // #240 (c) — the collision spacer's `minGap` was a bare `16` never
    // reconciled with the rendered line box, leaving ~2px of clear space
    // between adjacent labels. It is now `lineHeightPx * SLOPE_LABEL_GAP_RATIO`
    // — assert the real clear space, never the constant.
    await waitFor(() => {
      const labels = Array.from(
        canvasElement.querySelectorAll('[data-slot="dumbbell-chart-slope-label-end"]'),
      );
      expect(labels.length).toBeGreaterThan(1);
      const boxes = labels
        .map((label) => label.getBoundingClientRect())
        .sort((a, b) => a.top - b.top);
      for (let i = 1; i < boxes.length; i++) {
        const prev = boxes[i - 1] as DOMRect;
        const next = boxes[i] as DOMRect;
        expect(next.top - prev.bottom).toBeGreaterThanOrEqual(4);
      }
    });
  },
  render: (args) => (
    <div className="h-96 w-[640px]">
      <DumbbellChart {...args} />
    </div>
  ),
};

// `onboardingSteps`' deltas (0, 12, 27, 27, 32) are already ascending with a
// tie at 27, so an ascending-vs-descending sort bug can't show up against
// them and this story rendered identically to `Default` (#244). This fixture
// is tie-free, NOT already sorted either way, AND includes a decrease
// ("Reactivate trial", delta -60) whose |magnitude| beats every increase —
// sorting by |delta| puts it first; sorting by signed value would put it
// last, so this fixture also demonstrates the sort ranks by magnitude, not
// by signed value.
const sortDemoSteps = [
  { step: "Add payment method", before: 41, after: 68 }, // delta +27
  { step: "Sign up", before: 100, after: 100 }, // delta 0
  { step: "Ship first project", before: 19, after: 51 }, // delta +32
  { step: "Invite a teammate", before: 12, after: 24 }, // delta +12
  { step: "Verify email", before: 75, after: 94 }, // delta +19
  { step: "Reactivate trial", before: 80, after: 20 }, // delta -60 (|60|, the biggest mover)
];

/** Sorted by delta — the biggest movers surface first, by |delta| (a big decrease outranks a small increase). */
export const SortedByDelta: Story = {
  args: {
    data: sortDemoSteps,
    category: "step",
    startKey: "before",
    endKey: "after",
    sortBy: "delta",
    showDelta: true,
  },
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      const svgEl = canvasElement.querySelector("svg");
      expect(svgEl).not.toBeNull();
      const labels = svgEl!.querySelectorAll('[data-slot="dumbbell-chart-category-label"]');
      const order = Array.from(labels).map((l) => l.textContent);
      // Descending by |delta|: Reactivate trial (|-60| = 60, a decrease —
      // proves magnitude beats signed value), Ship first project (32), Add
      // payment method (27), Verify email (19), Invite a teammate (12),
      // Sign up (0).
      expect(order).toEqual([
        "Reactivate trial",
        "Ship first project",
        "Add payment method",
        "Verify email",
        "Invite a teammate",
        "Sign up",
      ]);
    });
  },
  render: (args) => (
    <div className="h-80 w-[640px]">
      <DumbbellChart {...args} />
    </div>
  ),
};

/** Accessible variant — announces label + description to screen readers on focus. */
export const WithAccessibleLabel: Story = {
  args: {
    data: onboardingSteps,
    category: "step",
    startKey: "before",
    endKey: "after",
    beads: { unit: 4 },
    accessibleLabel: "Onboarding completion rate, before and after the redesign",
    accessibleDescription:
      "Five onboarding steps, each showing completion rate before and after the redesign, with the point gain called out per step.",
  },
  render: (args) => (
    <div className="h-80 w-[640px]">
      <DumbbellChart {...args} />
    </div>
  ),
};

/**
 * `rowColor` — an "argument, not a chart" infographic emphasises the one or
 * two rows that are the story (a status tone) while the rest stay on the
 * shared palette. Returning `undefined` for a row keeps it on the resolved
 * `palette`, so this is additive: unset, the chart is byte-identical to
 * `Default`.
 */
export const RowColorOverride: Story = {
  args: {
    data: onboardingSteps,
    category: "step",
    startKey: "before",
    endKey: "after",
    showDelta: true,
    rowColor: (row) => (row.category === "Ship first project" ? "var(--destructive)" : undefined),
  },
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      const markers = canvasElement.querySelectorAll('[data-slot="dumbbell-chart-marker-end"]');
      expect(markers.length).toBe(onboardingSteps.length);
      const fills = Array.from(markers).map((m) => m.getAttribute("fill"));
      // Exactly one row (the emphasised one) draws in the destructive token;
      // the rest keep their palette colour, none of which is that token.
      expect(fills.filter((f) => f === "var(--destructive)")).toHaveLength(1);
    });
  },
  render: (args) => (
    <div className="h-80 w-full max-w-[640px]">
      <DumbbellChart {...args} />
    </div>
  ),
};

/** The series-pattern channel (ADR 0011) rendered: `bp-series-*` defs + marks filled from them. */
function expectSeriesPatterns(root: Element, markSelector: string, minPatterns: number) {
  expect(root.querySelectorAll('pattern[id^="bp-series-"]').length).toBeGreaterThanOrEqual(
    minPatterns,
  );
  const patterned = [...root.querySelectorAll(markSelector)].filter((mark) =>
    (mark.getAttribute("fill") ?? "").startsWith("url(#bp-series-"),
  );
  expect(patterned.length).toBeGreaterThan(0);
}

/**
 * High decoration (ADR 0011, #257) — each filled (“after”) marker draws its row
 * colour’s series pattern inside a solid hairline outline; hollow (“before”)
 * markers stay hollow.
 */
export const HighDecoration: Story = {
  tags: ["!dev"],
  name: "High decoration",
  globals: { decoration: "10" },
  args: {
    data: onboardingSteps,
    category: "step",
    startKey: "before",
    endKey: "after",
    showDelta: true,
  },
  render: (args) => (
    <div className="h-80 w-full max-w-[640px]" data-decoration="10">
      <DumbbellChart {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(() =>
      expectSeriesPatterns(canvasElement, '[data-slot="dumbbell-chart-marker-end"]', 2),
    );
  },
};

/**
 * `bothEndsLabeled` — the end of each slope line also carries its category
 * name, not just the bare value, so a reader can tell which line is which
 * without tracing it back to the start label. Default (unset) keeps the end
 * label value-only.
 */
export const SlopeBothEndsLabeled: Story = {
  args: {
    data: yearOverYear,
    category: "channel",
    startKey: "lastYear",
    endKey: "thisYear",
    variant: "slope",
    valueFormat: "compact",
    bothEndsLabeled: true,
  },
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      const endLabels = canvasElement.querySelectorAll(
        '[data-slot="dumbbell-chart-slope-label-end"]',
      );
      expect(endLabels.length).toBeGreaterThan(0);
      endLabels.forEach((label) => expect(label.textContent).toMatch(/[A-Za-z]/));
    });
  },
  render: (args) => (
    <div className="h-80 w-full max-w-[640px]">
      <DumbbellChart {...args} />
    </div>
  ),
};

// ── Gap-to-benchmark: one labelled reference line + light value ticks ──────
const depotVsBenchmark = [
  { depot: "Berlin", actual: 97.3, benchmark: 95 },
  { depot: "Munich", actual: 95.8, benchmark: 95 },
  { depot: "Hamburg", actual: 94.3, benchmark: 95 },
  { depot: "Nuremberg", actual: 83.8, benchmark: 95 },
];

/**
 * `referenceLine` + `showValueAxis` — one labelled vertical benchmark line
 * plus light value ticks along the shared scale, in place of repeating the
 * benchmark as a marker on every row. `deltaLabelFormat` shows the gap with a
 * true minus sign and a unit the default `formatValue` sign convention can't.
 */
export const BenchmarkReferenceLine: Story = {
  args: {
    data: depotVsBenchmark,
    category: "depot",
    startKey: "benchmark",
    endKey: "actual",
    showDelta: true,
    valueFormat: "number",
    referenceLine: { value: 95, label: "Industry benchmark 95%" },
    showValueAxis: true,
    deltaLabelFormat: (delta) => `${delta > 0 ? "+" : "−"}${Math.abs(delta).toFixed(1)}pp`,
  },
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      expect(
        canvasElement.querySelector('[data-slot="dumbbell-chart-reference-line"]'),
      ).not.toBeNull();
      expect(canvasElement.querySelector('[data-slot="dumbbell-chart-value-axis"]')).not.toBeNull();
    });
  },
  render: (args) => (
    <div className="h-80 w-full max-w-[640px]">
      <DumbbellChart {...args} />
    </div>
  ),
};

// Selection states — RM-073
type SelectionStateName = "selected" | "associated" | "excluded";
const SELECTION_BY_REGION: Record<string, SelectionStateName> = {
  EMEA: "selected",
  APAC: "associated",
  AMER: "excluded",
};
const selectionByRegion = (category: string | number | Date): SelectionStateName =>
  SELECTION_BY_REGION[String(category)] ?? "associated";

/**
 * Asserts the three states read apart AS SEEN (#442, #445, #446), in whatever
 * theme the story runs under: every chart copy has real width; a selected
 * mark’s compound outline clears 3:1 against the chart surface, and its better
 * band clears 3:1 against every series fill and the mark’s own painted fill; an
 * excluded mark is dimmed while its dashed frame paints at full opacity and
 * clears 3:1 against the surface.
 */
async function expectSelectionStates(root: HTMLElement) {
  await waitFor(() =>
    expect(root.querySelectorAll('[data-selection="excluded"]').length).toBeGreaterThan(0),
  );
  expect(root.querySelectorAll('[data-selection="associated"]').length).toBeGreaterThan(0);
  const charts = new Set(
    Array.from(root.querySelectorAll("[data-selection]"), (node) => node.closest("svg")),
  );
  for (const svg of charts) {
    expect(svg?.getBoundingClientRect().width ?? 0).toBeGreaterThan(0);
  }
  const style = getComputedStyle(root.querySelector("[data-selection]") as Element);
  const surface = style.getPropertyValue("--chart-background").trim();
  const ground = paintedSrgb(surface, surface);
  const painted = (paint: string) => paintedSrgb(paint, surface);
  const stroke = (el: Element | null) => {
    expect(el).not.toBeNull();
    return painted(getComputedStyle(el as Element).stroke);
  };
  const palette = Array.from({ length: 12 }, (_, i) =>
    style.getPropertyValue(`--chart-${i + 1}`).trim(),
  ).filter(Boolean);
  expect(palette.length).toBeGreaterThanOrEqual(8);
  for (const node of root.querySelectorAll('[data-selection="selected"]')) {
    const outer = stroke(node.querySelector('[data-slot$="-outline"]'));
    const core = stroke(node.querySelector('[data-slot$="-outline-core"]'));
    expect(contrastRgb(outer, ground)).toBeGreaterThanOrEqual(3);
    const own = Array.from(
      node.querySelectorAll(":not([data-slot*='-outline'])"),
      (el) => getComputedStyle(el).fill,
    ).filter((fill) => /^(rgb|oklch|#)/.test(fill) && !/rgba\(0, 0, 0, 0\)/.test(fill));
    for (const fill of [...palette, ...own]) {
      const mark = painted(fill);
      expect(Math.max(contrastRgb(outer, mark), contrastRgb(core, mark))).toBeGreaterThanOrEqual(3);
    }
  }
  for (const node of root.querySelectorAll('[data-selection="excluded"]')) {
    expect(node.querySelector('[data-slot$="-dim"], [data-slot$="-veil"]')).not.toBeNull();
    const frame = node.querySelector('[data-slot$="-frame"]');
    for (let el = frame; el && el !== root; el = el.parentElement) {
      expect(Number(getComputedStyle(el).opacity)).toBe(1);
    }
    expect(contrastRgb(stroke(frame), ground)).toBeGreaterThanOrEqual(3);
  }
}

/** The chart twice, side by side: as authored, then in greyscale (#445). */
function SelectionProof({ children, className }: { children: ReactNode; className: string }) {
  return (
    <div className="grid w-full gap-6 md:grid-cols-2">
      <figure className="m-0 flex min-w-0 flex-col gap-2">
        <figcaption className="text-caption text-muted-foreground">Colour</figcaption>
        <div className={className}>{children}</div>
      </figure>
      <figure className="m-0 flex min-w-0 flex-col gap-2">
        <figcaption className="text-caption text-muted-foreground">Greyscale</figcaption>
        <div className={className} style={{ filter: "grayscale(1)" }}>
          {children}
        </div>
      </figure>
    </div>
  );
}

const selectionRegionData = [
  { region: "EMEA", step: 1, revenue: 42, target: 50 },
  { region: "APAC", step: 2, revenue: 31, target: 36 },
  { region: "AMER", step: 3, revenue: 55, target: 48 },
];

/**
 * `selectionStates` paints the host’s tri-state on rows: selected marks carry a
 * compound foreground/background outline, excluded marks dim AND carry a full-opacity dashed frame, so the three
 * states stay distinguishable in greyscale.
 */
export const SelectionStates: Story = {
  name: "Selection states",
  parameters: { layout: "padded" },
  args: {
    accessibleLabel: "Revenue against target by region with a selection applied",
    category: "region",
    data: selectionRegionData,
    endKey: "target",
    selectionStates: selectionByRegion,
    startKey: "revenue",
  },
  render: (args) => (
    <SelectionProof className="w-full max-w-[560px]">
      <DumbbellChart {...args} />
    </SelectionProof>
  ),
  play: async ({ canvasElement }) => {
    await expectSelectionStates(canvasElement);
  },
};

// ── RM-116 validator fix-round-1/round-2 (#491): no painted text may ──────
// ── intersect, at the width a real browser viewport actually gives it ─────

/** Minimum clear px between any two painted text boxes — the validator's bar
 *  (round-2: ≥ 1px, down from round-1's 2px — the acceptance bar itself, not
 *  a margin this test re-encodes as the spec). */
const TEXT_OVERLAP_MIN_GAP_PX = 1;

/**
 * Storybook's `layout: "centered"` parameter (this story's `meta.parameters`)
 * pads the preview ~16px each side (`sb-main-centered`, applied inside the
 * SAME iframe a real browser viewport renders — not manager-UI chrome, so it
 * is not an artifact of running headless) — 32px total. A real page viewport
 * of `W` px therefore hands `[data-testid="dumbbell-story-wrapper"]`
 * `W - SB_CENTERED_PADDING_PX` px, capped at the wrapper's own
 * `max-w-[640px]`.
 */
const SB_CENTERED_PADDING_PX = 32;
/** The wrapper's own `max-w-[640px]` (every render below in this file). */
const STORY_MAX_WIDTH_PX = 640;
/**
 * The validator's real browser viewport widths (Playwright
 * `page.setViewportSize`, `iframe.html?id=…` at 380/600/900px) — kept here so
 * `REAL_VIEWPORT_CONTENT_WIDTHS_PX` documents its own derivation instead of
 * three bare content-width constants.
 */
const VALIDATOR_VIEWPORT_WIDTHS_PX = [380, 600, 900];
/**
 * Round-2 (#491) fix for round-1's actual bug: `assertNoTextOverlapAtWidths`
 * resized only this wrapper — directly to 380/600/900 — while the vitest
 * browser project's OWN viewport stayed fixed and wide, so the chart got
 * MORE width than a real 380/600/900px page viewport ever would (Storybook's
 * centered-layout padding + this wrapper's own width cap both still apply at
 * a real viewport, never inside this test). That let round-1's fix pass here
 * while a real narrow viewport still overlapped. These are the PROVEN
 * equivalent widths instead — a real Playwright page at 380/600/900px reads
 * the exact same `[data-chart-breakpoint]` container `clientWidth` (348,
 * 568, 640) that resizing this wrapper to these numbers produces; both
 * readings are quoted side by side in the round-2 result file
 * (`RM-116-result.md`).
 */
const REAL_VIEWPORT_CONTENT_WIDTHS_PX = VALIDATOR_VIEWPORT_WIDTHS_PX.map((width) =>
  Math.min(width - SB_CENTERED_PADDING_PX, STORY_MAX_WIDTH_PX),
);

/**
 * True nearest-edge Euclidean distance between two axis-aligned rects: 0 when
 * they intersect/touch, else the straight-line gap between their closest
 * corners/edges. `min(gapX, gapY)` — the first version of this helper —
 * UNDER-reports a diagonal pair: two boxes offset by a large `gapY` and a
 * small `gapX` (e.g. a group header's own label and an unrelated row's delta
 * label two bands below it) are nowhere near touching, but the min-of-axes
 * read flags the small `gapX` alone. `Math.hypot(dx, dy)` is the honest
 * distance a reader would actually perceive between the two boxes.
 */
function rectGapPx(a: DOMRect, b: DOMRect): number {
  const dx = Math.max(0, b.left - a.right, a.left - b.right);
  const dy = Math.max(0, b.top - a.bottom, a.top - b.bottom);
  return Math.hypot(dx, dy);
}

/**
 * Fails on the pre-fix geometry (validator fix-round-1, #491): at 380px a
 * `groupBy` header band got no more room than a single row, so a group
 * header's own `HaloText` painted on top of the first row's delta label in
 * its group ("Referral" intersecting "+46.7%"). Every SVG `<text>` in the
 * chart PLUS the dot-plot's HTML colour-key legend (the requirement's fourth
 * text kind) must clear every other by `TEXT_OVERLAP_MIN_GAP_PX` — measured
 * with `getBoundingClientRect`, the way the validator measured it, never
 * against a margin/offset constant (that re-encodes the bug as the spec).
 */
async function assertNoPaintedTextOverlap(canvasElement: HTMLElement): Promise<void> {
  await waitFor(() => {
    const svgTexts = Array.from(canvasElement.querySelectorAll("svg text"));
    const legendItems = Array.from(
      canvasElement.querySelectorAll('[data-slot="dumbbell-chart-dot-legend"] > span'),
    );
    const elements = [...svgTexts, ...legendItems];
    expect(elements.length).toBeGreaterThan(0);
    const boxes = elements.map((el) => el.getBoundingClientRect());
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i] as DOMRect;
        const b = boxes[j] as DOMRect;
        const gap = rectGapPx(a, b);
        expect(rectsIntersect(a, b)).toBe(false);
        expect(gap).toBeGreaterThanOrEqual(TEXT_OVERLAP_MIN_GAP_PX);
      }
    }
  });
}

/**
 * Resizes the story's own wrapper (not the browser viewport — the vitest
 * browser project runs one fixed viewport) to each width in turn and asserts
 * no painted text overlaps at any of them. `ChartPlotRoot`'s `ResizeObserver`
 * reflows the chart on the width change; `waitFor` inside the assertion
 * absorbs that latency. Pass `REAL_VIEWPORT_CONTENT_WIDTHS_PX`, never the raw
 * validator viewport widths — see its docblock (round-2, #491).
 *
 * Always restores the wrapper's ORIGINAL inline `width`/`maxWidth` in a
 * `finally`, success or failure (round-2, #491): a `play` function's own DOM
 * mutations survive after it returns — CSF3 runs `play` on every preview
 * load, including a bare `iframe.html` visit with no interactions-addon
 * channel — so a resize left dangling here is exactly what made round-1's
 * validator read a real 600px viewport as `narrow`: the story's own play
 * function had stuck the wrapper at its FIRST swept width and never let go.
 */
async function assertNoTextOverlapAtWidths(
  canvasElement: HTMLElement,
  widths: number[],
): Promise<void> {
  const wrapper = canvasElement.querySelector<HTMLElement>(
    '[data-testid="dumbbell-story-wrapper"]',
  );
  expect(wrapper).not.toBeNull();
  const originalWidth = wrapper!.style.width;
  const originalMaxWidth = wrapper!.style.maxWidth;
  try {
    for (const width of widths) {
      wrapper!.style.width = `${width}px`;
      wrapper!.style.maxWidth = `${width}px`;
      await assertNoPaintedTextOverlap(canvasElement);
    }
  } finally {
    wrapper!.style.width = originalWidth;
    wrapper!.style.maxWidth = originalMaxWidth;
  }
}

/**
 * #547: resizes the story wrapper to each width and asserts every row's delta
 * label box shares no pixels with its OWN arrow head (one of each per row, in
 * the same DOM order). Restores the wrapper's width in a `finally`, like
 * `assertNoTextOverlapAtWidths`.
 */
async function assertDeltaLabelsClearArrowHeadsAtWidths(
  canvasElement: HTMLElement,
  widths: number[],
): Promise<void> {
  const wrapper = canvasElement.querySelector<HTMLElement>(
    '[data-testid="dumbbell-story-wrapper"]',
  );
  expect(wrapper).not.toBeNull();
  const originalWidth = wrapper!.style.width;
  const originalMaxWidth = wrapper!.style.maxWidth;
  try {
    for (const width of widths) {
      wrapper!.style.width = `${width}px`;
      wrapper!.style.maxWidth = `${width}px`;
      await waitFor(() => {
        const svgEl = canvasElement.querySelector("svg");
        expect(Math.round(svgEl!.getBoundingClientRect().width)).toBeLessThanOrEqual(width);
        const heads = svgEl!.querySelectorAll('[data-slot="dumbbell-chart-arrow-head"]');
        const labels = svgEl!.querySelectorAll('text[data-slot="dumbbell-chart-delta-label"]');
        expect(labels).toHaveLength(heads.length);
        heads.forEach((head, i) => {
          const headBox = head.getBoundingClientRect();
          const labelBox = (labels[i] as Element).getBoundingClientRect();
          expect(rectsIntersect(headBox, labelBox)).toBe(false);
        });
      });
    }
  } finally {
    wrapper!.style.width = originalWidth;
    wrapper!.style.maxWidth = originalMaxWidth;
  }
}

// ── RM-116: arrow / dots plots — Datawrapper parity §2.14–2.16 ─────────────

// 12 rows, 3 channels (4 metrics each) — a marketing-funnel move per channel,
// mixed positive/negative, deliberately not already sorted by anything.
const funnelChangeByChannel = [
  { metric: "Signups", channel: "Paid", before: 120, after: 180 },
  { metric: "Trials", channel: "Paid", before: 300, after: 210 },
  { metric: "Conversions", channel: "Paid", before: 40, after: 52 },
  { metric: "Churn", channel: "Paid", before: 18, after: 9 },
  { metric: "Signups", channel: "Organic", before: 220, after: 260 },
  { metric: "Trials", channel: "Organic", before: 410, after: 380 },
  { metric: "Conversions", channel: "Organic", before: 70, after: 95 },
  { metric: "Churn", channel: "Organic", before: 25, after: 30 },
  { metric: "Signups", channel: "Referral", before: 60, after: 45 },
  { metric: "Trials", channel: "Referral", before: 90, after: 130 },
  { metric: "Conversions", channel: "Referral", before: 15, after: 22 },
  { metric: "Churn", channel: "Referral", before: 8, after: 5 },
];

/**
 * `variant="arrow"` — an arrow head at `endKey`, coloured by sign (the
 * diverging positive/negative pair), grouped by channel with a header +
 * separator per group, sorted by `%` change. Head direction is the
 * second (non-hue) channel a signed reading needs (conventions.md, WCAG
 * 1.4.1) — a decrease still reads in greyscale as an arrow pointing left.
 */
export const ArrowPlot: Story = {
  name: "Arrow plot",
  args: {
    data: funnelChangeByChannel,
    category: "metric",
    startKey: "before",
    endKey: "after",
    variant: "arrow",
    groupBy: "channel",
    sortBy: "deltaPercent",
    delta: { show: true, mode: "percent" },
  },
  render: (args) => (
    // No fixed height (validator round-2, #491): a grouped chart's own height
    // floor (`groupHeaderBandFloorPx`, `dumbbell-chart.tsx`) can now grow past
    // any height this story pins, so the wrapper only bounds width — the
    // chart sizes itself.
    <div className="w-full max-w-[640px]" data-testid="dumbbell-story-wrapper">
      <DumbbellChart {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      const svgEl = canvasElement.querySelector("svg");
      expect(svgEl).not.toBeNull();
      // Every row still draws its own head — grouping only adds bands.
      const heads = svgEl!.querySelectorAll('[data-slot="dumbbell-chart-arrow-head"]');
      expect(heads).toHaveLength(funnelChangeByChannel.length);
      const headFills = new Set(Array.from(heads).map((h) => h.getAttribute("fill")));
      expect(headFills.has("var(--chart-div-pos-2)")).toBe(true);
      expect(headFills.has("var(--chart-div-neg-2)")).toBe(true);
      // Three groups, one header each — group order is first-seen in the
      // resolved SORT order (deltaPercent here), not the input order, so
      // only the set of names (not their sequence) is asserted.
      const headers = svgEl!.querySelectorAll('[data-slot="dumbbell-chart-group-header"]');
      expect(new Set(Array.from(headers).map((h) => h.textContent))).toEqual(
        new Set(["Paid", "Organic", "Referral"]),
      );
      const deltaLabels = svgEl!.querySelectorAll('[data-slot="dumbbell-chart-delta-label"]');
      expect(deltaLabels).toHaveLength(funnelChangeByChannel.length);
      for (const label of Array.from(deltaLabels)) {
        expect(label.textContent).toMatch(/^[+-]\d+(\.\d+)?%$/);
      }
    });
    // #547: at the narrowest supported width (and every real viewport width)
    // no row's delta label paints over its own arrow head.
    await assertDeltaLabelsClearArrowHeadsAtWidths(canvasElement, [
      380,
      ...REAL_VIEWPORT_CONTENT_WIDTHS_PX,
    ]);
    // Validator fix-round-1/round-2 (#491): grouped bands are the densest
    // geometry this component draws — sweep the widths a real narrowed
    // browser viewport actually gives the chart.
    await assertNoTextOverlapAtWidths(canvasElement, REAL_VIEWPORT_CONTENT_WIDTHS_PX);
  },
};

// Three competing scores per product on a shared axis — a spread reading, not
// a before/after — plus the extremes bridged by a range bar.
const productScores = [
  { product: "Alpha", us: 42, rivalA: 58, rivalB: 71 },
  { product: "Beta", us: 66, rivalA: 49, rivalB: 55 },
  { product: "Gamma", us: 30, rivalA: 35, rivalB: 28 },
  { product: "Delta", us: 80, rivalA: 62, rivalB: 74 },
];

/**
 * `variant="dots"` — N `valueKeys` per row as dots on the shared axis
 * (Datawrapper's dot plot), `range` drawing a bar between each row's
 * extremes; the colour key outside the plot lists the three keys.
 */
export const DotsPlot: Story = {
  name: "Dot plot with range",
  args: {
    data: productScores,
    category: "product",
    startKey: "us",
    endKey: "rivalB",
    variant: "dots",
    valueKeys: ["us", "rivalA", "rivalB"],
    range: true,
  },
  render: (args) => (
    <div className="h-80 w-full max-w-[640px]" data-testid="dumbbell-story-wrapper">
      <DumbbellChart {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      const svgEl = canvasElement.querySelector("svg");
      expect(svgEl).not.toBeNull();
      const dots = svgEl!.querySelectorAll('[data-slot="dumbbell-chart-dot"]');
      expect(dots).toHaveLength(productScores.length * 3);
      const bars = svgEl!.querySelectorAll('[data-slot="dumbbell-chart-range-bar"]');
      expect(bars).toHaveLength(productScores.length);
    });
    for (const key of ["us", "rivalA", "rivalB"]) {
      expect(canvasElement.textContent).toContain(key);
    }
    // Validator fix-round-1/round-2 (#491): the colour-key legend is the
    // fourth painted-text kind the acceptance bar names alongside category/
    // delta/group-header labels; sweep the widths a real narrowed browser
    // viewport actually gives the chart.
    await assertNoTextOverlapAtWidths(canvasElement, REAL_VIEWPORT_CONTENT_WIDTHS_PX);
  },
};

// Legend engine (RM-118): placement + hover only, no toggle (a dumbbell row
// is a category, not a series — there is nothing per-key to hide).
/**
 * `legend` replaces the always-on corner colour key above with the shared
 * container-legend engine — same three rows, now placement-aware and with a
 * real hover: pointing at a row dims every OTHER key's dots, on every row.
 */
export const LegendPlacement: Story = {
  name: "Legend, placement and hover",
  args: {
    data: productScores,
    category: "product",
    startKey: "us",
    endKey: "rivalB",
    variant: "dots",
    valueKeys: ["us", "rivalA", "rivalB"],
    legend: true,
  },
  render: (args) => (
    <div className="h-80 w-full max-w-[640px]" data-testid="dumbbell-story-wrapper">
      <DumbbellChart {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    await waitFor(() => {
      expect(canvasElement.querySelector('[data-slot="container-legend-root"]')).not.toBeNull();
    });
    // The shared engine REPLACES RM-116's own corner badge — never both.
    expect(
      canvasElement.querySelector('[data-slot="dumbbell-chart-dot-legend"]'),
    ).not.toBeInTheDocument();
    const legend = canvasElement.querySelector(".legend-container");
    for (const key of ["us", "rivalA", "rivalB"]) {
      expect(legend?.textContent).toContain(key);
    }
    // No TOGGLE affordance (R3) — no `aria-pressed` button. #607: the rows
    // ARE real `<button>`s now (keyboard path to the hover highlight), just
    // not toggles.
    expect(canvasElement.querySelectorAll(".legend-container button[aria-pressed]")).toHaveLength(
      0,
    );

    // #607: hover-only rows are real focusable `<button>`s, not `<div>`s.
    const rows = canvasElement.querySelectorAll(".legend-container > button");
    await userEvent.hover(rows[0] as Element);
    await waitFor(() => {
      const dots = canvasElement.querySelectorAll('[data-slot="dumbbell-chart-dot"]');
      // "us" is the hovered (first) key — its own dots carry no `opacity`
      // attribute at all (full opacity, the default), every other key's
      // dots on every row dim.
      for (const dot of dots) {
        const isUs = dot.getAttribute("data-dot-key") === "us";
        expect(dot.getAttribute("opacity")).toBe(isUs ? null : "0.35");
      }
    });
  },
};
