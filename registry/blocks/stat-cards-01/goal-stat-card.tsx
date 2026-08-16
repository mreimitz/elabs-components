"use client";

import { Badge, Card, CardContent, Progress } from "@elabs/components-ui";

export interface GoalStatCardProps {
  label: string;
  value: string;
  target: string;
  /** Percent of target reached, 0-100. */
  pct: number;
}

/** A goal tile — current value against a target, with a progress bar. */
export function GoalStatCard({ label, value, target, pct }: GoalStatCardProps) {
  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-body text-muted-foreground">{label}</span>
          <Badge variant="secondary" className="tabular-nums">
            {pct}%
          </Badge>
        </div>
        <div className="text-kpi font-semibold tabular-nums text-foreground">{value}</div>
        <Progress value={pct} aria-label={`${label}: ${pct}% of target`} />
        <p className="text-meta text-muted-foreground">
          <span className="tabular-nums">{value}</span> of{" "}
          <span className="tabular-nums">{target}</span> goal
        </p>
      </CardContent>
    </Card>
  );
}
