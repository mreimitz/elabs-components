"use client";
/**
 * One chart tile as a card — the container's name, the data shape it answers, the live chart,
 * and a link to its Storybook page — and the responsive grid that lays tiles out.
 */
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  return (
    <div className="grid grid-flow-row-dense grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {tiles.map((tile) => {
        const copy = galleryCopy.charts.tiles[tile.id];
        const href = links[tile.component] ?? null;
        return (
          <Card
            key={tile.id}
            data-chart-tile={tile.id}
            // The whole card opens the chart's page. A click handler rather than a stretched
            // link, so the chart underneath keeps its hover and tooltips; the title stays a
            // real link for the keyboard, assistive tech and "open in new tab".
            onClick={
              href
                ? (event) => {
                    if ((event.target as HTMLElement).closest("a, button")) return;
                    if (event.metaKey || event.ctrlKey) window.open(href, "_blank");
                    else router.push(href);
                  }
                : undefined
            }
            className={`gap-3 transition-shadow duration-fast ease-standard ${href ? "cursor-pointer hover:shadow-md" : ""} ${tile.wide ? "md:col-span-2" : ""}`}
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
                {CHART_RENDERS[tile.id]("card")}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
