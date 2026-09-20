"use client";

/**
 * What the agent is ALLOWED to draw: every type in the catalog, where it comes from, whether it
 * takes children and which events it can bind. This is the same list `brand-ui a2ui catalog`
 * prints for the model's system prompt.
 */
import { Badge, Input, ScrollArea } from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import { useMemo, useState } from "react";
import { SHOWCASE_CATALOG_SCHEMA } from "@/components/a2ui-parts/catalog";

const shortSource = (source: string) =>
  source === "builtin" ? "layout" : source.replace("@elabs-ai/components-", "");

export function CatalogBrowser({ className }: { className?: string }) {
  const [query, setQuery] = useState("");
  const types = useMemo(
    () =>
      Object.entries(SHOWCASE_CATALOG_SCHEMA)
        .map(([name, schema]) => ({
          name,
          summary: schema.summary ?? "",
          source: shortSource(schema.source),
          events: Object.keys(schema.events ?? {}),
          props: Object.keys(schema.props ?? {}).length,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [],
  );
  const needle = query.trim().toLowerCase();
  const shown = needle
    ? types.filter((type) => `${type.name} ${type.summary}`.toLowerCase().includes(needle))
    : types;

  return (
    <div className={cn("flex h-full min-h-0 flex-col", className)}>
      <div className="flex items-center gap-2 border-b border-border p-3">
        <Input
          aria-label="Filter catalog types"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter types…"
          value={query}
        />
        <span className="shrink-0 text-meta tabular-nums text-muted-foreground">
          {shown.length} / {types.length}
        </span>
      </div>
      {/* Every row here is text and badges — nothing focusable — so without a tab stop on the
          scrolling viewport a keyboard-only user cannot reach the rest of the list at all
          (axe `scrollable-region-focusable`). */}
      <ScrollArea
        className="min-h-0 flex-1"
        viewportProps={{ tabIndex: 0, role: "group", "aria-label": "Scrollable catalog" }}
      >
        <ul aria-label="Catalog types" className="flex flex-col">
          {shown.map((type) => (
            <li
              className="flex flex-col gap-1 border-b border-border px-3 py-2 last:border-b-0"
              key={type.name}
            >
              <div className="flex flex-wrap items-center gap-1.5">
                <code className="text-code font-semibold text-foreground">{type.name}</code>
                <Badge variant="outline">{type.source}</Badge>
                {type.events.map((event) => (
                  <Badge key={event} variant="info">
                    on.{event}
                  </Badge>
                ))}
                <span className="ms-auto text-meta tabular-nums text-muted-foreground">
                  {type.props} props
                </span>
              </div>
              {type.summary ? (
                <p className="text-meta text-muted-foreground">{type.summary}</p>
              ) : null}
            </li>
          ))}
        </ul>
      </ScrollArea>
    </div>
  );
}
