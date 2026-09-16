import type { ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor } from "storybook/test";
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
  name: "High decoration (#257)",
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
