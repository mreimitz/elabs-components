import type { Meta, StoryObj } from "@storybook/react-vite";
import { DashboardIcon } from "./dashboard";
import { ChatIcon } from "./chat";
import { TableIcon } from "./table";
import { FlowIcon } from "./flow";
import { SparklesIcon } from "./sparkles";
import { SearchIcon } from "./search";
import { ChartBarIcon } from "./chart-bar";
import { ChartLineIcon } from "./chart-line";
import { ChartAreaIcon } from "./chart-area";
import { ChartPieIcon } from "./chart-pie";
import { ChartScatterIcon } from "./chart-scatter";
import { ChartComboIcon } from "./chart-combo";
import { GaugeIcon } from "./gauge";
import { DatasetIcon } from "./dataset";
import { DimensionIcon } from "./dimension";
import { MeasureIcon } from "./measure";
import { PivotIcon } from "./pivot";
import { DataModelIcon } from "./data-model";
import { DataConnectionIcon } from "./data-connection";
import { PipelineIcon } from "./pipeline";
import { SheetIcon } from "./sheet";
import { StoryIcon } from "./story";
import { BookmarkIcon } from "./bookmark";
import { KpiIcon } from "./kpi";
import { InsightIcon } from "./insight";
import { FilterPaneIcon } from "./filter-pane";
import { TrendUpIcon } from "./trend-up";
import { TrendDownIcon } from "./trend-down";

/**
 * A gallery of all sample icons shipped with @elabs-ai/components-icons. Each icon is created
 * via the `createIcon` factory so they all share the same size, stroke-width,
 * color-inheritance and accessibility behaviour as the base `Icon` component.
 *
 * These are **product-vocabulary** icons for the analytics/BI/data domain — not
 * generic UI glyphs. Generic glyphs (chevron, X, search, bell, …) come from
 * `lucide-react` per the icons rule.
 */

// Use DashboardIcon as the representative component for autodocs; the gallery
// render overrides what is actually shown.
const meta = {
  title: "Icons/Gallery",
  component: DashboardIcon,
  tags: ["autodocs"],
} satisfies Meta<typeof DashboardIcon>;
export default meta;
type Story = StoryObj<typeof meta>;

const FOUNDATION_ICONS = [
  { name: "DashboardIcon", Icon: DashboardIcon },
  { name: "ChatIcon", Icon: ChatIcon },
  { name: "TableIcon", Icon: TableIcon },
  { name: "FlowIcon", Icon: FlowIcon },
  { name: "SparklesIcon", Icon: SparklesIcon },
  { name: "SearchIcon", Icon: SearchIcon },
] as const;

const CHART_ICONS = [
  { name: "ChartBarIcon", Icon: ChartBarIcon },
  { name: "ChartLineIcon", Icon: ChartLineIcon },
  { name: "ChartAreaIcon", Icon: ChartAreaIcon },
  { name: "ChartPieIcon", Icon: ChartPieIcon },
  { name: "ChartScatterIcon", Icon: ChartScatterIcon },
  { name: "ChartComboIcon", Icon: ChartComboIcon },
  { name: "GaugeIcon", Icon: GaugeIcon },
] as const;

const DATA_ICONS = [
  { name: "DatasetIcon", Icon: DatasetIcon },
  { name: "DimensionIcon", Icon: DimensionIcon },
  { name: "MeasureIcon", Icon: MeasureIcon },
  { name: "PivotIcon", Icon: PivotIcon },
  { name: "DataModelIcon", Icon: DataModelIcon },
  { name: "DataConnectionIcon", Icon: DataConnectionIcon },
  { name: "PipelineIcon", Icon: PipelineIcon },
] as const;

const SURFACE_ICONS = [
  { name: "SheetIcon", Icon: SheetIcon },
  { name: "StoryIcon", Icon: StoryIcon },
  { name: "BookmarkIcon", Icon: BookmarkIcon },
  { name: "KpiIcon", Icon: KpiIcon },
  { name: "InsightIcon", Icon: InsightIcon },
  { name: "FilterPaneIcon", Icon: FilterPaneIcon },
] as const;

const TREND_ICONS = [
  { name: "TrendUpIcon", Icon: TrendUpIcon },
  { name: "TrendDownIcon", Icon: TrendDownIcon },
] as const;

const ALL_ICONS = [
  ...FOUNDATION_ICONS,
  ...CHART_ICONS,
  ...DATA_ICONS,
  ...SURFACE_ICONS,
  ...TREND_ICONS,
];

function IconGrid({
  icons,
}: {
  icons: ReadonlyArray<{ name: string; Icon: (typeof ALL_ICONS)[number]["Icon"] }>;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
        gap: "24px",
      }}
    >
      {icons.map(({ name, Icon }) => (
        <div
          key={name}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <Icon size={24} title={name} />
          <span style={{ fontSize: "11px", color: "var(--color-muted-foreground)" }}>{name}</span>
        </div>
      ))}
    </div>
  );
}

/** All sample icons at 24 px (default) with their export name. */
export const Default: Story = {
  render: () => <IconGrid icons={ALL_ICONS} />,
};

/** Chart-type icons — bar, line, area, pie, scatter, combo, gauge. */
export const ChartTypes: Story = {
  render: () => <IconGrid icons={CHART_ICONS} />,
};

/** Data / model vocabulary — dataset, dimension, measure, pivot, data-model, data-connection, pipeline. */
export const DataVocabulary: Story = {
  render: () => <IconGrid icons={DATA_ICONS} />,
};

/** Analytics surfaces — sheet, story, bookmark, kpi, insight, filter-pane. */
export const AnalyticsSurfaces: Story = {
  render: () => <IconGrid icons={SURFACE_ICONS} />,
};

/** Trend indicators — up and down. */
export const Trends: Story = {
  render: () => <IconGrid icons={TREND_ICONS} />,
};

/** Icons at larger size (32 px) to verify stroke quality scales cleanly. */
export const Large: Story = {
  render: () => (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "24px" }}>
      {ALL_ICONS.map(({ name, Icon }) => (
        <Icon key={name} size={32} title={name} />
      ))}
    </div>
  ),
};

/** Icons in a muted color context — confirms currentColor inheritance. */
export const MutedColor: Story = {
  render: () => (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: "24px",
        color: "var(--color-muted-foreground)",
      }}
    >
      {ALL_ICONS.map(({ name, Icon }) => (
        <Icon key={name} size={24} title={name} />
      ))}
    </div>
  ),
};

/** Primary color context. */
export const PrimaryColor: Story = {
  render: () => (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: "24px",
        color: "var(--color-primary)",
      }}
    >
      {ALL_ICONS.map(({ name, Icon }) => (
        <Icon key={name} size={24} title={name} />
      ))}
    </div>
  ),
};
