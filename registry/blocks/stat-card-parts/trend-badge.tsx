"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import { Badge } from "@elabs/components-ui";
import { cn } from "@elabs/components-ui/lib/cn";

export function TrendBadge({ value, className }: { value: number; className?: string }) {
  const positive = value >= 0;
  const Icon = positive ? ArrowUp : ArrowDown;
  return (
    <Badge
      variant={positive ? "outline" : "destructive"}
      className={cn(positive && "border-success/20 bg-success/10 text-success-text", className)}
    >
      <Icon className="size-3" aria-hidden="true" />
      {positive ? "+" : ""}
      {value.toFixed(1)}%
    </Badge>
  );
}
