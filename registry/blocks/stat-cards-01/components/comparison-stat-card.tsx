"use client";

import { Badge, Card, CardContent } from "@qlik-coe-emea/qlabs-components-ui";

/** A comparison tile — this period vs last, with the delta. */
export function ComparisonStatCard() {
  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <span className="text-body text-muted-foreground">Active users</span>
        <div className="flex items-end gap-3">
          <div className="text-kpi font-semibold tabular-nums text-foreground">18,402</div>
          <Badge variant="success" className="mb-1">
            ↑ 6.2%
          </Badge>
        </div>
        <div className="flex items-center justify-between text-meta text-muted-foreground">
          <span>This month</span>
          <span className="tabular-nums">prev 17,320</span>
        </div>
      </CardContent>
    </Card>
  );
}
