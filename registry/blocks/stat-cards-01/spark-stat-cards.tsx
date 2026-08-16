"use client";

import { MetricCard } from "@elabs-ai/components-ui";
import { Sparkline } from "@elabs-ai/components-charts";
import { ordersSeries, refundRateSeries, revenueSeries } from "./data/spark-series";

/** A row of KPI tiles with an inline trend `Sparkline` in the MetricCard `visual` slot. */
export function SparkStatCards() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <MetricCard
        label="Revenue"
        value="$48.2M"
        delta="12.4%"
        deltaDirection="up"
        description="vs $42.9M last quarter"
        visual={
          <Sparkline
            values={revenueSeries}
            variant="line"
            label="Revenue trend, last 8 weeks"
            width={160}
            height={40}
            className="w-full"
            style={{ color: "var(--chart-1)" }}
          />
        }
      />
      <MetricCard
        label="Orders"
        value="1,284"
        delta="8.1%"
        deltaDirection="up"
        description="last 7 days"
        visual={
          <Sparkline
            values={ordersSeries}
            variant="bar"
            label="Orders trend, last 8 weeks"
            width={160}
            height={40}
            className="w-full"
            style={{ color: "var(--chart-2)" }}
          />
        }
      />
      <MetricCard
        label="Refund rate"
        value="1.9%"
        delta="0.4 pp"
        deltaDirection="down"
        description="lower is better"
        positiveIsGood={false}
        visual={
          <Sparkline
            values={refundRateSeries}
            variant="line"
            label="Refund-rate trend"
            width={160}
            height={40}
            className="w-full"
            style={{ color: "var(--chart-4)" }}
          />
        }
      />
    </div>
  );
}
