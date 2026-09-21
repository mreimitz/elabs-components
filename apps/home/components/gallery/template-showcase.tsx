/**
 * TemplateShowcase — the home page's templates, curated rather than tiled: ONE template at a
 * size where its screen can actually be read, and the others beside and under it as tighter
 * crops (`thumb-crop.ts`) — the working area of each app, not its whole frame at postage-stamp
 * size. Each card carries the template's one-line pitch (`templatePitch`); the wiring detail
 * stays on the template's own page. Server component; the live thumbnails are the islands.
 */
import { ArrowRight } from "lucide-react";
import { Badge, Card } from "@elabs-ai/components-ui";
import { EntryCard } from "../catalog/entry-grid";
import { StoryThumb } from "../catalog/story-thumb";
import { BlockThumb } from "../catalog/block-renders";
import { isNativeBlock } from "../catalog/block-render-meta";
import type { ThumbCrop } from "../catalog/thumb-crop";
import { hrefOf, type CatalogEntry } from "../../lib/catalog-index";
import { catalogCopy, featuredTemplateCopy } from "../../content/copy";

/** A workspace-shell screen drawn at 1440: skip the navigation and the top bar, keep the page.
 *  Measured from the shell's content area, so it holds when the navigation collapses. */
const SCREEN_CROP: ThumbCrop = { anchor: '[data-slot="sidebar-inset"]', x: 8, y: 52, width: 900 };
/** Per-template windows where the default would miss what the screen is about. */
const CROPS: Record<string, ThumbCrop> = {};
const CROP_RATIO = 0.56;
/** The featured frame is a little taller than 16:10, so its card ends level with the two crops
 *  stacked beside it on a wide screen. */
const FEATURED_RATIO = 0.66;

function FeaturedTemplate({ entry }: { entry: CatalogEntry }) {
  return (
    <Card className="group relative gap-0 overflow-hidden p-0 transition-shadow duration-fast ease-standard hover:shadow-md sm:col-span-2 xl:row-span-2">
      <div className="border-b border-border">
        {isNativeBlock(entry.block) ? (
          <BlockThumb name={entry.block} ratio={FEATURED_RATIO} />
        ) : entry.first ? (
          <StoryThumb id={entry.first} width={1440} ratio={FEATURED_RATIO} />
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-6">
        {entry.question ? (
          <p className="text-caption font-medium text-muted-foreground">{entry.question}</p>
        ) : null}
        <h3 className="text-title text-foreground">
          <a href={hrefOf(entry)} className="rounded-sm after:absolute after:inset-0 focus-ring">
            {entry.name}
          </a>
        </h3>
        {entry.summary ? (
          <p className="max-w-prose text-subtitle font-normal text-pretty text-muted-foreground">
            {entry.summary}
          </p>
        ) : null}
        <ul aria-label={featuredTemplateCopy.partsLabel} className="flex flex-wrap gap-1.5 pt-1">
          {featuredTemplateCopy.parts.map((part) => (
            <li key={part}>
              <Badge variant="outline">{part}</Badge>
            </li>
          ))}
        </ul>
        <p className="mt-auto flex items-center justify-between gap-3 pt-3 text-caption text-muted-foreground">
          <span>{catalogCopy.index.examples(entry.stories)}</span>
          <span
            aria-hidden="true"
            className="inline-flex items-center gap-1.5 font-medium text-foreground"
          >
            {featuredTemplateCopy.open}
            <ArrowRight className="size-4 transition-transform duration-fast ease-standard group-hover:translate-x-0.5 motion-reduce:transition-none" />
          </span>
        </p>
      </div>
    </Card>
  );
}

export function TemplateShowcase({
  featured,
  entries,
}: {
  featured: CatalogEntry | undefined;
  entries: CatalogEntry[];
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {featured ? <FeaturedTemplate entry={featured} /> : null}
      {entries.map((entry) => (
        <EntryCard
          key={entry.slug}
          entry={entry}
          thumbWidth={1440}
          crop={CROPS[entry.slug] ?? SCREEN_CROP}
          ratio={CROP_RATIO}
        />
      ))}
    </div>
  );
}
