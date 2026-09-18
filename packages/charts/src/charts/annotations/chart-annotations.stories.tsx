import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, waitFor } from "storybook/test";
import { AutoChart } from "../../auto-chart";
import type { ChartSpec } from "../../auto-chart/chart-spec";
import { Bar } from "../bar";
import { BarChart } from "../bar-chart";
import { BarYAxis } from "../bar-y-axis";
import { DumbbellChart } from "../dumbbell-chart";
import { Grid } from "../grid";
import { Line } from "../line";
import { LineChart } from "../line-chart";
import { WaterfallChart } from "../waterfall-chart";
import { XAxis } from "../x-axis";
import { YAxis } from "../y-axis";
import { type ChartAnnotation, withAnnotationDescription } from "./annotation-types";
import {
  BIKES_ANNOTATIONS,
  BIKES_DATA,
  BIKES_SERIES,
  BIKES_SPEC_ANNOTATIONS,
} from "./bikes-fixture";
import { ChartAnnotations } from "./chart-annotations";

const meta = {
  title: "Charts/Annotations",
  component: ChartAnnotations,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Declarative annotations (RM-111): text notes, ranges, reference lines and row notes in data units. At the narrow tier every note becomes a numbered marker listed by `AnnotationKey` under the plot; the figure description restates every note at every tier.",
      },
    },
  },
} satisfies Meta<typeof ChartAnnotations>;

export default meta;
type Story = StoryObj<typeof meta>;

const BIKES_DESCRIPTION =
  "Monthly cycle traffic in Paris, Berlin, London and New York, as the change against the same month of 2019.";

function BikesChart({ annotations }: { annotations: ChartAnnotation[] }) {
  return (
    <LineChart
      accessibleDescription={BIKES_DESCRIPTION}
      accessibleLabel="Cycle traffic against 2019"
      annotations={annotations}
      data={BIKES_DATA}
      xDataKey="date"
    >
      <Grid horizontal />
      {BIKES_SERIES.map((s) => (
        <Line dataKey={s.key} key={s.key} stroke={s.color} />
      ))}
      <XAxis />
      <YAxis valueFormat={{ sign: true, suffix: "%" }} />
    </LineChart>
  );
}

/**
 * The recipe: four series-coloured notes, the Covid-19 range and the ±0 line.
 * Wide: every note painted in place. Under 480 px: markers ①–④ and a key.
 */
export const BikesRecipe: Story = {
  args: { annotations: BIKES_ANNOTATIONS },
  render: (args) => <BikesChart annotations={[...args.annotations]} />,
  play: async ({ canvasElement }) => {
    await waitFor(() =>
      expect(canvasElement.querySelector('[data-slot="chart-annotations-line"]')).not.toBeNull(),
    );
    const figure = canvasElement.querySelector('[role="figure"]');
    const description = canvasElement.querySelector(
      `[id="${figure?.getAttribute("aria-describedby")}"]`,
    );
    await expect(description?.textContent).toContain("Paris opens 50 km");
    await expect(description?.textContent).toContain("New York slips back below 2019.");
  },
};

const localIsoDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const BIKES_SPEC: ChartSpec = {
  type: "line",
  title: "Cycle traffic against 2019",
  description: BIKES_DESCRIPTION,
  x: "date",
  data: BIKES_DATA.map((row) => ({
    ...row,
    // The local calendar day, not `toISOString()` (UTC), so no row shifts a day east of UTC.
    date: localIsoDay(row.date as Date),
  })),
  series: BIKES_SERIES.map((s) => ({ key: s.key, label: s.label, color: s.color })),
  annotations: BIKES_SPEC_ANNOTATIONS,
};

/** The same recipe from `ChartSpec.annotations`, rendered by `AutoChart`. */
export const BikesRecipeFromSpec: Story = {
  args: { annotations: BIKES_ANNOTATIONS },
  render: () => <AutoChart spec={BIKES_SPEC} />,
  play: async ({ canvasElement }) => {
    await waitFor(() =>
      expect(canvasElement.querySelector('[data-slot="chart-annotations-range"]')).not.toBeNull(),
    );
  },
};

/** `showAt={{ base: true, narrow: false }}`: gone at narrow (no marker, no key row), still described. */
export const DesktopOnlyNote: Story = {
  args: {
    annotations: [
      ...BIKES_ANNOTATIONS.slice(0, 2),
      {
        kind: "text",
        x: "2022-03-01",
        y: 62,
        text: "Desktop-only: the spring 2022 peak",
        width: 22,
        showAt: { base: true, narrow: false },
      },
    ],
  },
  render: (args) => <BikesChart annotations={[...args.annotations]} />,
};

/** A striped x range, a dashed y line and a dotted x line — every range and line in the furniture ink. */
export const RangesAndLines: Story = {
  args: {
    annotations: [
      {
        kind: "range",
        x1: "2021-01-01",
        x2: "2021-12-01",
        label: "Pilot year",
        pattern: "stripes",
      },
      { kind: "range", y1: -10, y2: 10, label: "Normal band" },
      { kind: "line", y: 40, label: "Target: +40%", style: "dashed" },
      { kind: "line", x: "2023-01-01", label: "New counters", style: "dotted", width: 1 },
    ],
  },
  render: (args) => <BikesChart annotations={[...args.annotations]} />,
};

const TEAMS = [
  { team: "Lisbon", trips: 42 },
  { team: "Porto", trips: 67 },
  { team: "Braga", trips: 23 },
  { team: "Faro", trips: 51 },
];

/** Row notes on a horizontal bar chart follow their category through a re-sort. */
export const RowNotes: Story = {
  args: {
    annotations: [
      { kind: "row", category: "Porto", text: "Record year" },
      { kind: "line", y: 50, label: "Goal", style: "dashed" },
    ],
  },
  render: (args) => (
    <BarChart
      accessibleDescription={withAnnotationDescription("Trips per city.", args.annotations)}
      accessibleLabel="Trips per city"
      data={[...TEAMS].sort((a, b) => b.trips - a.trips)}
      orientation="horizontal"
      xDataKey="team"
    >
      <Grid vertical horizontal={false} />
      <Bar dataKey="trips" />
      <BarYAxis />
      <ChartAnnotations annotations={args.annotations} />
    </BarChart>
  ),
};

const COMMUTE = [
  { city: "Lisbon", y2019: 14, y2024: 22 },
  { city: "Porto", y2019: 9, y2024: 31 },
  { city: "Braga", y2019: 6, y2024: 11 },
  { city: "Faro", y2019: 12, y2024: 15 },
  { city: "Coimbra", y2019: 8, y2024: 19 },
];

const COMMUTE_ANNOTATIONS: ChartAnnotation[] = [
  { kind: "range", x1: 20, x2: 25, label: "EU target" },
  { kind: "line", x: 15, label: "National average", style: "dashed" },
  { kind: "row", category: "Coimbra", text: "**More than doubled**" },
  {
    kind: "text",
    x: 27,
    y: "Faro",
    text: "Faro barely moved",
    anchor: "w",
    width: 20,
  },
];

/**
 * Row notes on a `DumbbellChart`: the Coimbra note follows its row through the
 * `delta` sort (Coimbra sorts second), the target band sits behind the
 * tracks and the dashed average line over them.
 */
export const DumbbellRowNotes: Story = {
  args: { annotations: COMMUTE_ANNOTATIONS },
  render: (args) => (
    <DumbbellChart
      accessibleDescription="Share of commutes by bike, 2019 and 2024, per city."
      accessibleLabel="Cycling share of commutes"
      annotations={args.annotations}
      category="city"
      data={COMMUTE}
      endKey="y2024"
      sortBy="delta"
      startKey="y2019"
      valueFormat={{ suffix: "%" }}
    />
  ),
  play: async ({ canvasElement }) => {
    await waitFor(() =>
      expect(canvasElement.querySelector('[data-slot="chart-annotations-row"]')).not.toBeNull(),
    );
  },
};

/** The same dumbbell from `ChartSpec.annotations`, rendered by `AutoChart`. */
export const DumbbellFromSpec: Story = {
  args: { annotations: COMMUTE_ANNOTATIONS },
  render: () => (
    <AutoChart
      spec={{
        type: "dumbbell",
        title: "Cycling share of commutes",
        description: "Share of commutes by bike, 2019 and 2024, per city.",
        x: "city",
        data: COMMUTE,
        series: [
          { key: "y2019", label: "2019" },
          { key: "y2024", label: "2024" },
        ],
        annotations: [
          { kind: "range", x1: 20, x2: 25, label: "EU target" },
          { kind: "line", x: 15, label: "National average", style: "dashed" },
          { kind: "row", category: "Coimbra", text: "**More than doubled**" },
          { kind: "text", x: 27, y: "Faro", text: "Faro barely moved", anchor: "w", width: 20 },
        ],
      }}
    />
  ),
  play: async ({ canvasElement }) => {
    await waitFor(() =>
      expect(canvasElement.querySelector('[data-slot="chart-annotations-range"]')).not.toBeNull(),
    );
  },
};

/** A `WaterfallChart` hands its annotations to the inner bar chart: a row note, a note, a line. */
export const WaterfallNotes: Story = {
  args: {
    annotations: [
      { kind: "row", category: "Churn", text: "Worst quarter" },
      { kind: "line", y: 150, label: "Target", style: "dotted" },
      {
        kind: "text",
        x: "New",
        y: 190,
        text: "New logos led the year",
        anchor: "s",
        width: 25,
      },
    ],
  },
  render: (args) => (
    <WaterfallChart
      accessibleDescription="Annual recurring revenue from opening to closing, in € millions."
      accessibleLabel="ARR bridge"
      annotations={args.annotations}
      data={[
        { label: "Opening", value: 100, kind: "total" },
        { label: "New", value: 45 },
        { label: "Upsell", value: 30 },
        { label: "Churn", value: -38 },
        { label: "FX", value: -7 },
        { label: "Closing", value: 130, kind: "total" },
      ]}
    />
  ),
  play: async ({ canvasElement }) => {
    await waitFor(() =>
      expect(canvasElement.querySelector('[data-slot="chart-annotations-row"]')).not.toBeNull(),
    );
  },
};
