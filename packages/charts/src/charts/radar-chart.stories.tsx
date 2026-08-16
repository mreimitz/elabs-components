import type { Meta, StoryObj } from "@storybook/react-vite";
import { RadarChart } from "./radar-chart";
import { RadarGrid } from "./radar-grid";
import { RadarAxis } from "./radar-axis";
import { RadarLabels } from "./radar-labels";
import { RadarArea } from "./radar-area";
import type { RadarData, RadarMetric } from "./radar-context";

const meta = {
  title: "Charts/RadarChart",
  component: RadarChart,
  tags: ["autodocs"],
} satisfies Meta<typeof RadarChart>;

export default meta;
type Story = StoryObj<typeof meta>;

const metrics: RadarMetric[] = [
  { key: "speed", label: "Speed" },
  { key: "reliability", label: "Reliability" },
  { key: "comfort", label: "Comfort" },
  { key: "safety", label: "Safety" },
  { key: "efficiency", label: "Efficiency" },
];

const data: RadarData[] = [
  {
    label: "Product A",
    values: { speed: 80, reliability: 70, comfort: 60, safety: 90, efficiency: 75 },
  },
];

export const Default: Story = {
  render: () => (
    <div className="h-72 w-[560px]">
      <RadarChart data={data} metrics={metrics} size={288} animate={false}>
        <RadarGrid />
        <RadarAxis />
        <RadarLabels fontSize={11} offset={20} />
        {data.map((_, i) => (
          <RadarArea key={i} index={i} />
        ))}
      </RadarChart>
    </div>
  ),
};

const multiData: RadarData[] = [
  {
    label: "Product A",
    values: { speed: 80, reliability: 70, comfort: 60, safety: 90, efficiency: 75 },
  },
  {
    label: "Product B",
    values: { speed: 55, reliability: 85, comfort: 78, safety: 65, efficiency: 90 },
  },
];

export const MultiSeries: Story = {
  render: () => (
    <div className="h-72 w-[560px]">
      <RadarChart data={multiData} metrics={metrics} size={288} animate={false}>
        <RadarGrid />
        <RadarAxis />
        <RadarLabels fontSize={11} offset={20} />
        {multiData.map((_, i) => (
          <RadarArea key={i} index={i} />
        ))}
      </RadarChart>
    </div>
  ),
};

/** Accessible variant — announces label + description to screen readers on focus. */
export const WithAccessibleLabel: Story = {
  render: () => (
    <div className="h-72 w-[560px]">
      <RadarChart
        data={data}
        metrics={metrics}
        size={288}
        animate={false}
        accessibleLabel="Product A performance radar chart"
        accessibleDescription="Speed 80, Reliability 70, Comfort 60, Safety 90, Efficiency 75."
      >
        <RadarGrid />
        <RadarAxis />
        <RadarLabels fontSize={11} offset={20} />
        {data.map((_, i) => (
          <RadarArea key={i} index={i} />
        ))}
      </RadarChart>
    </div>
  ),
};
