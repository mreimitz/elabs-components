/**
 * Opt-out fixtures for the RM-073 selection input (#437). Every family renders
 * here with ONLY props that existed before RM-073, so the same file renders at
 * the pre-change base (9d119df6) — where the committed `<family>.html`
 * baselines were generated — and on today's branch, where
 * `chart-selection.test.tsx` compares against them byte-for-byte. Extra props
 * (`selectionStates`, …) are spread last by the tests that paint states.
 *
 * Test-only: imported by `chart-selection.test.tsx`, never by package source.
 */

import type { ReactElement } from "react";

import { Area } from "../../area";
import { AreaChart } from "../../area-chart";
import { Bar } from "../../bar";
import { BarChart } from "../../bar-chart";
import { ComposedChart } from "../../composed-chart";
import { DumbbellChart } from "../../dumbbell-chart";
import { HeatmapChart } from "../../heatmap";
import { Line } from "../../line";
import { LineChart } from "../../line-chart";
import { PieChart } from "../../pie-chart";
import PieSlice from "../../pie-slice";
import Ring from "../../ring";
import { RingChart } from "../../ring-chart";
import { Scatter } from "../../scatter";
import { ScatterChart } from "../../scatter-chart";
import { TreemapChart } from "../../treemap";
import { UnitChart } from "../../unit-chart";

export const selectionFixtureData = [
  { region: "EMEA", sales: 12 },
  { region: "APAC", sales: 24 },
  { region: "AMER", sales: 8 },
];

const regionRows = selectionFixtureData.map((d) => ({
  label: d.region,
  value: d.sales,
  maxValue: 30,
}));

export type FixtureProps = Record<string, unknown>;

export interface SelectionFixture {
  /** Baseline file stem: `<name>.html`. */
  name: string;
  /** Needs `getBoundingClientRect` stubbed to 600×300 to lay out in jsdom. */
  measured: boolean;
  render: (props: FixtureProps) => ReactElement;
}

export const SELECTION_FIXTURES: SelectionFixture[] = [
  {
    name: "bar-chart",
    measured: false,
    render: (props) => (
      <BarChart animationDuration={0} data={selectionFixtureData} xDataKey="region" {...props}>
        <Bar animate={false} dataKey="sales" />
      </BarChart>
    ),
  },
  {
    name: "line-chart",
    measured: false,
    render: (props) => (
      <LineChart
        animationDuration={0}
        data={selectionFixtureData}
        xDataKey="region"
        xScale="band"
        {...props}
      >
        <Line animate={false} dataKey="sales" />
      </LineChart>
    ),
  },
  {
    name: "area-chart",
    measured: false,
    render: (props) => (
      <AreaChart
        animationDuration={0}
        data={selectionFixtureData}
        xDataKey="region"
        xScale="band"
        {...props}
      >
        <Area animate={false} dataKey="sales" />
      </AreaChart>
    ),
  },
  {
    name: "composed-chart",
    measured: false,
    render: (props) => (
      <ComposedChart
        animationDuration={0}
        data={selectionFixtureData}
        xDataKey="region"
        xScale="band"
        {...props}
      >
        <Line animate={false} dataKey="sales" />
      </ComposedChart>
    ),
  },
  {
    name: "pie-chart",
    measured: false,
    render: (props) => (
      <PieChart data={regionRows} size={240} {...props}>
        {regionRows.map((row, index) => (
          <PieSlice animate={false} index={index} key={row.label} />
        ))}
      </PieChart>
    ),
  },
  {
    name: "ring-chart",
    measured: false,
    render: (props) => (
      <RingChart data={regionRows} size={240} {...props}>
        {regionRows.map((row, index) => (
          <Ring animate={false} index={index} key={row.label} />
        ))}
      </RingChart>
    ),
  },
  {
    name: "scatter-chart",
    measured: true,
    render: (props) => (
      <ScatterChart
        data={selectionFixtureData.map((d, index) => ({ ...d, step: index + 1 }))}
        xDataKey="step"
        xScale="linear"
        {...props}
      >
        <Scatter animate={false} dataKey="sales" />
      </ScatterChart>
    ),
  },
  {
    name: "treemap-chart",
    measured: true,
    render: (props) => (
      <div style={{ height: 300, width: 600 }}>
        <TreemapChart
          data={{
            name: "Sales",
            children: selectionFixtureData.map((d) => ({ name: d.region, value: d.sales })),
          }}
          depth={1}
          {...props}
        />
      </div>
    ),
  },
  {
    name: "unit-chart",
    measured: true,
    render: (props) => (
      <UnitChart
        data={selectionFixtureData.map((d) => ({ label: d.region, value: d.sales }))}
        layout="waffle"
        {...props}
      />
    ),
  },
  {
    name: "dumbbell-chart",
    measured: true,
    render: (props) => (
      <DumbbellChart
        category="region"
        data={selectionFixtureData.map((d) => ({ ...d, target: d.sales + 5 }))}
        endKey="target"
        startKey="sales"
        {...props}
      />
    ),
  },
  {
    name: "heatmap-chart",
    measured: true,
    render: (props) => (
      <HeatmapChart
        data={["Q1", "Q2"].flatMap((quarter, q) =>
          selectionFixtureData.map((d) => ({ quarter, region: d.region, sales: d.sales + q })),
        )}
        valueKey="sales"
        x="region"
        y="quarter"
        {...props}
      />
    ),
  },
];
