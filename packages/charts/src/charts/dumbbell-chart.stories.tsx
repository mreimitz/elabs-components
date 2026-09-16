import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor } from "storybook/test";
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
