"use client";

import { Plus } from "lucide-react";
import { Button, SectionHeader } from "@elabs/components-ui";
import { INTEGRATIONS } from "./data/integrations";
import { IntegrationCard } from "./integration-card";

/**
 * A responsive grid of integration cards (icon + name + description +
 * connect/manage action + connection status) under a page header with an
 * Add action — the canonical "connect your tools" surface. Logos are
 * consumer-supplied (Lucide placeholders here).
 */
export function IntegrationGrid() {
  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Settings"
        title="Integrations"
        description="Connect the tools your team already uses."
        actions={
          <Button size="sm">
            <Plus className="size-4" aria-hidden="true" />
            Add integration
          </Button>
        }
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {INTEGRATIONS.map((i) => (
          <IntegrationCard key={i.id} integration={i} />
        ))}
      </div>
    </div>
  );
}
