"use client";

import { ComparisonStatCard } from "./comparison-stat-card";
import { GoalStatCard } from "./goal-stat-card";
import { SparkStatCards } from "./spark-stat-cards";

/**
 * Elevated KPI tiles beyond a flat number: MetricCard + inline Sparkline
 * (area/bar/line, coloured by a `--chart-*` token), a goal/progress tile, and
 * a this-vs-last comparison tile. Copy-ready compositions for dashboard
 * overviews.
 */
export function StatCards() {
  return (
    <div className="space-y-4">
      <SparkStatCards />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <GoalStatCard label="Quarterly target" value="$36.2k" target="$50k" pct={72} />
        <GoalStatCard label="Onboarding complete" value="184" target="250" pct={74} />
        <ComparisonStatCard />
      </div>
    </div>
  );
}
