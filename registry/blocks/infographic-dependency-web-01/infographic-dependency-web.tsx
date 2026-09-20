"use client";

import { useMemo } from "react";
import { NetworkChart, TreeChart } from "@elabs-ai/components-charts";
import { Badge, Card, CardContent } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import { dependencyLinks, dependencyNodes, ownershipTree } from "./data/dependencies";

export interface InfographicDependencyWebProps {
  nodes?: typeof dependencyNodes;
  links?: typeof dependencyLinks;
  /** `force` lets clusters find their own shape; `circular` keeps every label readable. */
  layout?: "force" | "circular";
  className?: string;
}

/**
 * "What depends on what?" — the call graph as a network, the ownership as a tree. The
 * headline names the service most others lean on, counted from the links.
 */
export function InfographicDependencyWeb({
  nodes = dependencyNodes,
  links = dependencyLinks,
  layout = "force",
  className,
}: InfographicDependencyWebProps) {
  const busiest = useMemo(() => {
    const inbound = new Map<string, number>();
    for (const link of links) inbound.set(link.target, (inbound.get(link.target) ?? 0) + 1);
    const [id, count] = [...inbound.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
    const node = nodes.find((n) => n.id === id);
    return node && count ? { label: node.label, count } : null;
  }, [links, nodes]);

  return (
    <Card className={cn("@container", className)} data-slot="infographic-dependency-web">
      <CardContent className="flex flex-col gap-4 p-5">
        <div className="flex items-center justify-between gap-2">
          <span className="min-w-0 truncate text-body text-muted-foreground">
            Dispatch platform, service dependencies
          </span>
          <Badge className="shrink-0" variant="secondary">
            {nodes.length} services · {links.length} calls
          </Badge>
        </div>
        <h3 className="text-title text-balance text-foreground">
          {busiest
            ? `${busiest.count} services lean on ${busiest.label}: it is the one to keep standing`
            : "No service depends on another"}
        </h3>
        <div className="grid grid-cols-1 gap-6 @3xl:grid-cols-2">
          <div className="min-w-0">
            <NetworkChart
              accessibleDescription={`${nodes.length} services connected by ${links.length} calls, grouped by tier.`}
              layout={layout}
              plotHeight={360}
              links={links}
              nodes={nodes}
            />
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            <p className="text-meta font-medium text-muted-foreground">Who owns what</p>
            <div className="min-w-0 overflow-auto">
              <TreeChart accessibleLabel="Services grouped by owning tier" data={ownershipTree} />
            </div>
          </div>
        </div>
        <p className="text-caption text-muted-foreground">
          How to read it: a line is a call from one service to another; a larger node handles more
          traffic. Colour is the tier, the same three tiers as the tree.
        </p>
      </CardContent>
    </Card>
  );
}
