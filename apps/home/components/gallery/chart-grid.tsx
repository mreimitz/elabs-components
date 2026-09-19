"use client";
/**
 * One chart tile as a card — the container's name, the data shape it answers, the live chart,
 * and a link to its Storybook page — and the responsive grid that lays tiles out.
 */
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@elabs-ai/components-ui";
import { galleryCopy } from "../../content/copy";
import { CHART_RENDERS } from "./chart-tiles";
import type { ChartTileMeta } from "./chart-tile-meta";

export function ChartGrid({
  tiles,
  links,
}: {
  tiles: ChartTileMeta[];
  /** Detail-page hrefs by component name, resolved on the server from the catalogue. */
  links: Record<string, string | null>;
}) {
  return (
    <div className="grid grid-flow-row-dense grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {tiles.map((tile) => {
        const copy = galleryCopy.charts.tiles[tile.id];
        const href = links[tile.component] ?? null;
        return (
          <Card
            key={tile.id}
            data-chart-tile={tile.id}
            className={tile.wide ? "gap-3 md:col-span-2" : "gap-3"}
          >
            <CardHeader>
              <CardTitle>
                {href ? (
                  <a href={href} className="rounded-sm hover:underline focus-ring">
                    {tile.component}
                  </a>
                ) : (
                  tile.component
                )}
              </CardTitle>
              <CardDescription>{copy.shape}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className={tile.auto ? "w-full min-w-0" : "h-60 w-full min-w-0"}>
                {CHART_RENDERS[tile.id]()}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
