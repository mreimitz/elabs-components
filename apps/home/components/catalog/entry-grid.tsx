/**
 * EntryGrid — catalogue entries as cards: a live thumbnail of the entry's first story, its name,
 * what it is for, and how many examples its page holds. The whole card is one link.
 */
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@elabs-ai/components-ui";
import { hrefOf, type CatalogEntry } from "../../lib/catalog-index";
import { catalogCopy } from "../../content/copy";
import { StoryThumb } from "./story-thumb";
import { BlockThumb } from "./block-renders";
import { isNativeBlock } from "./block-render-meta";
import type { ThumbCrop } from "./thumb-crop";

export function EntryCard({
  entry,
  thumb = true,
  thumbWidth = 720,
  crop,
  ratio,
  className,
}: {
  entry: CatalogEntry;
  thumb?: boolean;
  thumbWidth?: number;
  /** Show a window of the live thumbnail instead of the whole frame (`thumb-crop.ts`). */
  crop?: ThumbCrop;
  /** Height / width of the thumbnail box. */
  ratio?: number;
  className?: string;
}) {
  return (
    <Card
      className={`group relative gap-0 overflow-hidden p-0 transition-shadow duration-fast ease-standard hover:shadow-md ${className ?? ""}`}
    >
      {thumb && isNativeBlock(entry.block) ? (
        <div className="border-b border-border">
          <BlockThumb name={entry.block} crop={crop} ratio={ratio} />
        </div>
      ) : thumb && entry.first ? (
        <div className="border-b border-border">
          <StoryThumb id={entry.first} width={thumbWidth} crop={crop} ratio={ratio} />
        </div>
      ) : null}
      <CardHeader className="p-4">
        {entry.question ? (
          <p className="text-caption font-medium text-muted-foreground">{entry.question}</p>
        ) : null}
        <CardTitle className="text-subtitle">
          <a href={hrefOf(entry)} className="rounded-sm after:absolute after:inset-0 focus-ring">
            {entry.name}
          </a>
        </CardTitle>
        {entry.summary ? (
          <CardDescription className="line-clamp-2">{entry.summary}</CardDescription>
        ) : null}
      </CardHeader>
      <CardContent className="px-4 pb-4 text-caption text-muted-foreground">
        {catalogCopy.index.examples(entry.stories)}
      </CardContent>
    </Card>
  );
}

export function EntryGrid({
  entries,
  thumb,
  thumbWidth,
  columns = "default",
}: {
  entries: CatalogEntry[];
  thumb?: boolean;
  thumbWidth?: number;
  columns?: "default" | "wide";
}) {
  return (
    <div
      className={
        columns === "wide"
          ? "grid grid-cols-1 gap-4 md:grid-cols-2"
          : "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
      }
    >
      {entries.map((entry) => (
        <EntryCard
          key={`${entry.section}/${entry.package}/${entry.slug}`}
          entry={entry}
          thumb={thumb}
          thumbWidth={thumbWidth}
        />
      ))}
    </div>
  );
}

export function IndexHeader({
  title,
  lead,
  count,
}: {
  title: string;
  lead: string;
  count?: number;
}) {
  return (
    <header className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="text-display font-semibold text-balance">{title}</h1>
        {count !== undefined ? (
          <span className="text-meta text-muted-foreground tabular-nums">
            {catalogCopy.index.count(count)}
          </span>
        ) : null}
      </div>
      <p className="max-w-prose text-subtitle text-muted-foreground">{lead}</p>
    </header>
  );
}

export function GroupHeading({ id, label, count }: { id: string; label: string; count: number }) {
  return (
    <h2 id={id} className="flex scroll-mt-24 items-baseline gap-2 text-title">
      {label}
      <span className="text-meta font-normal text-muted-foreground tabular-nums">{count}</span>
    </h2>
  );
}
