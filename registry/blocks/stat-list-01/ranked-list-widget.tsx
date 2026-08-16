"use client";

import {
  Avatar,
  AvatarFallback,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Progress,
} from "@elabs-ai/components-ui";
import { COUNTRIES } from "./data/countries";

/** A ranked list (Sales by country) — code + label + share bar + delta. */
export function RankedListWidget() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sales by country</CardTitle>
        <CardDescription>This year</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {COUNTRIES.map((c) => (
          <div key={c.code} className="flex items-center gap-3">
            <Avatar className="size-8">
              <AvatarFallback className="text-meta font-medium">{c.code}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-body font-medium text-foreground">{c.name}</span>
                <span className="tabular-nums text-body font-semibold text-foreground">
                  {c.value}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <Progress value={c.share} className="h-1.5 flex-1" aria-label={`${c.name} share`} />
                <span
                  className={[
                    "shrink-0 text-meta tabular-nums",
                    c.delta >= 0 ? "text-success-text" : "text-destructive-text",
                  ].join(" ")}
                >
                  {c.delta >= 0 ? "+" : ""}
                  {c.delta}%
                </span>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
