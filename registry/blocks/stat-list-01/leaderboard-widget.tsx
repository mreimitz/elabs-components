"use client";

import {
  Avatar,
  AvatarFallback,
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@elabs-ai/components-ui";
import { PERFORMERS } from "./data/performers";

/** A leaderboard (Top performers) — rank + avatar + name/role + a tone Badge. */
export function LeaderboardWidget() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Weekly stats</CardTitle>
        <CardDescription>Average sales</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {PERFORMERS.map((p, i) => (
          <div key={p.name} className="flex items-center gap-3">
            <span className="w-4 shrink-0 text-meta tabular-nums text-muted-foreground">
              {i + 1}
            </span>
            <Avatar className="size-8">
              <AvatarFallback className="text-meta">{p.initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="truncate text-body font-medium text-foreground">{p.name}</div>
              <div className="truncate text-meta text-muted-foreground">{p.role}</div>
            </div>
            <Badge variant={p.tone}>{p.value}</Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
