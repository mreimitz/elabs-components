"use client";
/**
 * Client entry points the server sections mount: the home page's featured charts, the `/charts`
 * explorer with its group filter, the block examples, and `/components`' categorised tiles.
 */
import { useState } from "react";
import { ToggleGroup, ToggleGroupItem } from "@elabs-ai/components-ui";
import { galleryCopy } from "../../content/copy";
import { KpiMovers } from "../blocks/kpi-movers-01/kpi-movers";
import { KpiStatusThreshold } from "../blocks/kpi-status-threshold-01/kpi-status-threshold";
import { InfographicCohortRetention } from "../blocks/infographic-cohort-retention-01/infographic-cohort-retention";
import { ChartGrid } from "./chart-grid";
import { CHART_RENDERS } from "./chart-tiles";
import {
  CHART_GROUP_IDS,
  CHART_TILE_META,
  type ChartGroupId,
  type ChartTileId,
} from "./chart-tile-meta";
import { TileColumns } from "./component-wall";
import { COMPONENT_TILE_META, type ComponentCategoryId } from "./component-tile-meta";

type Links = Record<string, string | null>;

export function FeaturedCharts({ links }: { links: Links }) {
  return <ChartGrid tiles={CHART_TILE_META.filter((tile) => tile.featured)} links={links} />;
}

export function ChartsExplorer({ links }: { links: Links }) {
  const copy = galleryCopy.charts;
  const [group, setGroup] = useState<ChartGroupId | "all">("all");
  const tiles =
    group === "all" ? CHART_TILE_META : CHART_TILE_META.filter((tile) => tile.group === group);
  return (
    <div className="flex flex-col gap-6">
      <ToggleGroup
        type="single"
        variant="outline"
        value={group}
        onValueChange={(next) => {
          if (next) setGroup(next as ChartGroupId | "all");
        }}
        aria-label={copy.filterLabel}
        className="flex-wrap justify-start"
      >
        <ToggleGroupItem value="all">{copy.all}</ToggleGroupItem>
        {CHART_GROUP_IDS.map((id) => (
          <ToggleGroupItem key={id} value={id}>
            {copy.groups[id]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <ChartGrid tiles={tiles} links={links} />
    </div>
  );
}

export function BlockExamples() {
  return (
    <div className="columns-1 gap-4 md:columns-2 xl:columns-3">
      <div className="mb-4 break-inside-avoid">
        <InfographicCohortRetention />
      </div>
      <div className="mb-4 break-inside-avoid">
        <KpiStatusThreshold />
      </div>
      <div className="mb-4 flex break-inside-avoid flex-col gap-4">
        <KpiMovers />
      </div>
    </div>
  );
}

export function CategoryTiles({ category }: { category: ComponentCategoryId }) {
  return <TileColumns tiles={COMPONENT_TILE_META.filter((tile) => tile.category === category)} />;
}

/** One question's chart types, live — a group of the `/charts` chooser. */
export function ChartGroup({ group, links }: { group: ChartGroupId; links: Links }) {
  return <ChartGrid tiles={CHART_TILE_META.filter((tile) => tile.group === group)} links={links} />;
}

/** A chart type's native render as its detail page's hero. */
export function ChartHero({ id }: { id: ChartTileId }) {
  const tile = CHART_TILE_META.find((t) => t.id === id);
  return (
    <div className={tile?.auto ? "w-full min-w-0" : "mx-auto h-96 w-full max-w-3xl min-w-0"}>
      {CHART_RENDERS[id]()}
    </div>
  );
}
