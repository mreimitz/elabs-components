"use client";

import { useCallback, useMemo, useState, type KeyboardEvent } from "react";
import {
  AspectRatio,
  Badge,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  IconButton,
  Image,
  Media,
  Text,
  ToggleGroup,
  ToggleGroupItem,
  Video,
  formatMediaTime,
} from "@elabs-ai/components-ui";
import { cn } from "@elabs-ai/components-ui/lib/cn";
import { AudioLines, Camera, ChevronLeft, ChevronRight, Film, Play } from "lucide-react";
import { ITEMS, type MediaItem, type MediaKind } from "./data/items";

export type MediaGalleryFilter = MediaKind | "all";

export interface MediaGalleryProps {
  /** The set to show. Defaults to the sample. */
  items?: MediaItem[];
  /** The kind the filter starts on. Default `"all"`. */
  defaultFilter?: MediaGalleryFilter;
  title?: string;
  description?: string;
  className?: string;
}

const KIND_LABEL: Record<MediaKind, { one: string; many: string; icon: typeof Camera }> = {
  image: { one: "Photo", many: "Photos", icon: Camera },
  video: { one: "Video", many: "Video", icon: Film },
  audio: { one: "Audio", many: "Audio", icon: AudioLines },
};

/**
 * One gallery for every kind of file — photographs, films and recordings side
 * by side in a masonry of tiles, each marked by kind and length, filtered by
 * kind. Selecting a tile opens the lightbox with the right viewer for it: the
 * ui `Image` for a photo, the `Video` player for a film, and the `Media`
 * player for a recording, with its cover art above the waveform. Previous/next
 * and the arrow keys move through the filtered set.
 */
export function MediaGallery({
  items = ITEMS,
  defaultFilter = "all",
  title = "From the two days",
  description = "Photographs, films and recordings from the harbour, in the order they were taken.",
  className,
}: MediaGalleryProps) {
  const [filter, setFilter] = useState<MediaGalleryFilter>(defaultFilter);
  const [activeId, setActiveId] = useState<string | null>(null);

  const counts = useMemo(() => {
    const out: Record<MediaKind, number> = { image: 0, video: 0, audio: 0 };
    for (const item of items) out[item.kind] += 1;
    return out;
  }, [items]);
  const visible = useMemo(
    () => (filter === "all" ? items : items.filter((item) => item.kind === filter)),
    [items, filter],
  );
  const activeIndex = visible.findIndex((item) => item.id === activeId);
  const active = activeIndex >= 0 ? visible[activeIndex] : null;

  const step = useCallback(
    (delta: number) => {
      const next = visible[activeIndex + delta];
      if (next) setActiveId(next.id);
    },
    [visible, activeIndex],
  );
  const onLightboxKey = (event: KeyboardEvent<HTMLDivElement>) => {
    // The players own Space and the letter keys; only the arrows move between items.
    if (event.key === "ArrowRight") {
      event.preventDefault();
      step(1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      step(-1);
    }
  };

  return (
    <section
      data-slot="media-gallery"
      aria-labelledby="media-gallery-heading"
      className={cn("flex flex-col gap-5", className)}
    >
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="media-gallery-heading" className="text-title font-semibold text-foreground">
            {title}
          </h2>
          <Text tone="muted" className="max-w-prose text-pretty">
            {description}
          </Text>
        </div>
        <ToggleGroup
          type="single"
          variant="segmented"
          size="sm"
          value={filter}
          onValueChange={(value) => value && setFilter(value as MediaGalleryFilter)}
          aria-label="Kind"
        >
          <ToggleGroupItem value="all">
            All <span className="tabular-nums text-muted-foreground">{items.length}</span>
          </ToggleGroupItem>
          {(Object.keys(KIND_LABEL) as MediaKind[]).map((kind) => {
            const Icon = KIND_LABEL[kind].icon;
            return (
              <ToggleGroupItem key={kind} value={kind}>
                <Icon className="size-3.5" aria-hidden="true" />
                {KIND_LABEL[kind].many}{" "}
                <span className="tabular-nums text-muted-foreground">{counts[kind]}</span>
              </ToggleGroupItem>
            );
          })}
        </ToggleGroup>
      </header>

      <ul className="columns-2 gap-3 sm:columns-3 lg:columns-4">
        {visible.map((item, i) => (
          <li key={item.id} className="mb-3 break-inside-avoid">
            <Tile
              item={item}
              index={i}
              total={visible.length}
              onOpen={() => setActiveId(item.id)}
            />
          </li>
        ))}
      </ul>

      <Dialog open={active !== null} onOpenChange={(open) => !open && setActiveId(null)}>
        {active ? (
          <DialogContent size="xl" className="max-w-5xl" onKeyDown={onLightboxKey}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <KindMark kind={active.kind} />
                {active.title}
              </DialogTitle>
              <DialogDescription>{active.caption}</DialogDescription>
            </DialogHeader>
            {/* `key` remounts the viewer per item so a player starts fresh. */}
            <Viewer key={active.id} item={active} />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-meta text-muted-foreground">
                {active.taken}
                {active.kind !== "image" ? (
                  <>
                    {" "}
                    · <span className="tabular-nums">{formatMediaTime(active.seconds)}</span>
                  </>
                ) : null}
              </p>
              <div className="flex items-center gap-2">
                <IconButton
                  variant="outline"
                  size="icon-sm"
                  label="Previous item"
                  icon={<ChevronLeft />}
                  disabled={activeIndex <= 0}
                  onClick={() => step(-1)}
                />
                <span className="text-meta tabular-nums text-muted-foreground">
                  {activeIndex + 1} / {visible.length}
                </span>
                <IconButton
                  variant="outline"
                  size="icon-sm"
                  label="Next item"
                  icon={<ChevronRight />}
                  disabled={activeIndex >= visible.length - 1}
                  onClick={() => step(1)}
                />
              </div>
            </div>
          </DialogContent>
        ) : null}
      </Dialog>
    </section>
  );
}

function KindMark({ kind }: { kind: MediaKind }) {
  const Icon = KIND_LABEL[kind].icon;
  return (
    <Badge variant="secondary" className="gap-1">
      <Icon className="size-3" aria-hidden="true" />
      {KIND_LABEL[kind].one}
    </Badge>
  );
}

interface TileProps {
  item: MediaItem;
  index: number;
  total: number;
  onOpen: () => void;
}

function Tile({ item, index, total, onOpen }: TileProps) {
  const ratio = item.kind === "image" ? item.ratio : item.kind === "video" ? 16 / 9 : 1;
  const length = item.kind === "image" ? "" : `, ${formatMediaTime(item.seconds)}`;
  const verb = item.kind === "image" ? "View" : item.kind === "video" ? "Play" : "Listen to";
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${verb} ${item.title}${length} (${index + 1} of ${total})`}
      data-slot="media-gallery-tile"
      data-kind={item.kind}
      className="group/tile flex w-full flex-col gap-1.5 rounded-lg text-start focus-ring"
    >
      <AspectRatio ratio={ratio} className="overflow-hidden rounded-lg border bg-muted shadow-xs">
        <Image
          src={item.kind === "image" ? item.src : item.kind === "video" ? item.poster : item.cover}
          alt=""
          fit="cover"
          showSkeleton={false}
          loading="lazy"
          className="size-full transition-transform duration-base ease-standard group-hover/tile:scale-[1.03] motion-reduce:transition-none"
        />
        {item.kind !== "image" ? (
          <>
            {/* The play mark: decorative — the button's name already says what happens. */}
            <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center">
              <span className="flex size-11 items-center justify-center rounded-full bg-background/80 text-foreground shadow-sm backdrop-blur transition-transform duration-base ease-standard group-hover/tile:scale-110 motion-reduce:transition-none">
                {item.kind === "video" ? (
                  <Play className="size-5 fill-current" />
                ) : (
                  <AudioLines className="size-5" />
                )}
              </span>
            </span>
            <Badge variant="secondary" className="absolute bottom-2 end-2 tabular-nums">
              {formatMediaTime(item.seconds)}
            </Badge>
          </>
        ) : null}
        <span
          aria-hidden="true"
          className="absolute start-2 top-2 flex size-6 items-center justify-center rounded-md bg-background/80 text-muted-foreground shadow-xs backdrop-blur"
        >
          {item.kind === "image" ? (
            <Camera className="size-3.5" />
          ) : item.kind === "video" ? (
            <Film className="size-3.5" />
          ) : (
            <AudioLines className="size-3.5" />
          )}
        </span>
      </AspectRatio>
      <span className="flex min-w-0 flex-col px-0.5">
        <span className="truncate text-body font-medium text-foreground">{item.title}</span>
        <span className="truncate text-meta text-muted-foreground">{item.taken}</span>
      </span>
    </button>
  );
}

/** The right viewer for the item's kind. */
function Viewer({ item }: { item: MediaItem }) {
  if (item.kind === "image") {
    return (
      <div className="flex justify-center overflow-hidden rounded-lg border bg-muted">
        <Image
          src={item.src}
          alt={item.alt}
          fit="contain"
          showSkeleton={false}
          className="max-h-[70dvh] w-auto max-w-full"
        />
      </div>
    );
  }
  if (item.kind === "video") {
    return (
      <Video
        // The sample file is sound standing in for a film; a real film needs no `kind`.
        kind="video"
        src={item.src}
        poster={item.poster}
        aspectRatio={16 / 9}
        preload="metadata"
        label={item.title}
        tracks={
          item.captions
            ? [{ src: item.captions, kind: "captions", srclang: "en", label: "English" }]
            : []
        }
      />
    );
  }
  return (
    <Media
      kind="audio"
      src={item.src}
      poster={item.cover}
      fit="cover"
      aspectRatio={16 / 9}
      preload="metadata"
      label={item.title}
    />
  );
}
